import {parser} from './parser.js'
import {readFile, readdir} from 'fs/promises'
import path from 'path'
import type {SyntaxNode, SyntaxNodeRef} from '@lezer/common'
import {type Table, txt, type Query, type Join, type Diagnostic, type Expression, type Field, type ColumnField, FieldType} from './core.ts'
import {extractLeadingMetadata} from './metadata.ts'
import malloy, {AggregateFunctionType, type StructRef} from '../node_modules/@malloydata/malloy/dist/model/index.js'

export type {Query, Table, Diagnostic} from './core.ts'

let TABLE_MAP: Record<string, Table> = {}
let diagnostics: Diagnostic[] = []
let queryModelContents: Record<string, any> = {}

function diag (node: SyntaxNode | SyntaxNodeRef, message: string): void {
  diagnostics.push({from: node.from, to: node.to, message, severity: 'error'})
}

export function clearWorkspace () {
  TABLE_MAP = {}
  diagnostics = []
  queryModelContents = {}
}

// Loads and parses all gsql files within a directory
export async function loadWorkspace (dir:string) {
  for (let f of await readdir(dir)) {
    if (!f.endsWith('.gsql')) continue
    let contents = await readFile(path.join(dir, f), 'utf-8')
    analyze(contents)
  }
}

export function toSql (query: Query): string {
  Object.values(queryModelContents).forEach(t => t.dialect = 'duckdb')
  let qm = new malloy.QueryModel({
    name: 'generated_model',
    contents: queryModelContents,
    queryList: [],
    dependencies: {},
    exports: [],
  })
  let compiled = qm.compileQuery(query.malloyQuery)
  return compiled.sql
}

export function analyze (source:string): {queries: Query[], diagnostics: Diagnostic[]} {
  let tree = parser.parse(source)
  tree.rawText = source

  // Collect syntax errors within the source.
  diagnostics = []
  tree.topNode.cursor().iterate(n => {
    if (n.type.isError) diag(n, 'Syntax error')
  })

  tree.topNode.getChildren('TableStatement').forEach(registerTable)
  tree.topNode.getChildren('ViewStatement').forEach(registerTable)
  let queries = tree.topNode.getChildren('QueryStatement').map(analyzeQuery).filter(q => !!q)
  return {queries, diagnostics: Array.from(diagnostics)}
}

// Stores the table without analyzing it, since we don't
function registerTable (syntaxNode: SyntaxNode) {
  let name = txt(syntaxNode.firstChild?.nextSibling)
  let query = syntaxNode.getChild('QueryStatement')
  let type = query ? 'query_source' : 'table'
  let metadata = extractLeadingMetadata(syntaxNode)
  return TABLE_MAP[name] = {type, name, syntaxNode, metadata, fields: []} as Table
}

// Parses a table (model) declaration. Most analysis is done lazily, so this just gets the tables name and fields.
function analyzeTable (table: Table) {
  if (table.analyzed) return
  table.analyzed = true
  table.connection = 'duckdb'
  table.dialect = 'duckdb'
  table.tablePath = table.name
  table.fields = []
  queryModelContents[table.name] = table

  if (table.type == 'table') analyzeDatabaseTable(table)
  else analyzeQueryTable(table)
}

// Actual table with columns that lives in the database
function analyzeDatabaseTable (table: Table) {
  // regular columns in the db, like `full_name VARCHAR`
  table.syntaxNode.getChildren('ColumnDef').forEach(cn => {
    table.fields.push({
      name: txt(cn.getChild('Identifier')),
      type: convertDataType(txt(cn.getChild('DataType'))),
      metadata: extractLeadingMetadata(cn),
    })
  })

  // joins, like `join_one orders as order ON order.id = item.order_id`
  // NB that in Malloy, a join contains the entire target table in the join object.
  table.syntaxNode.getChildren('JoinDef').forEach(jn => {
    let target = TABLE_MAP[txt(jn.getChild('Identifier'))]
    if (!target) diag(jn, 'Unknown table to join')
    if (!target.analyzed) analyzeTable(target)
    let name = txt(jn.getChild('Alias')) || target.name

    // Malloy does this bonkers thing where a JoinField contains both the details of that join, and the entire target table.
    // This clone is important, otherwise two tables that join each other create an infinite loop when we give them to Malloy.
    let clone = structuredClone(target)
    let join = {...clone, name, join: 'one'} as Join

    // It's important we add the join before processing its expression, since the expression will refer to it
    table.fields.push(join)
    join.onExpression = analyzeExpression(jn.getChild('Expression')!, table)
  })

  // measures/dimensions, like `measure total_price AS SUM(price)`
  // malloy represents them as just a regular field, plus an expression
  // TODO: I think one measure can ref another, so we need to process these bottom up to resolve types
  table.syntaxNode.getChildren('ComputedDef').forEach(cn => {
    let expression = analyzeExpression(cn.getChild('Expression')!, table)
    table.fields.push({
      name: txt(cn.getChild('Identifier')),
      type: expression.type,
      metadata: extractLeadingMetadata(cn),
      e: expression,
      isAgg: expression.node == 'aggregate',
    })
  })
}

function analyzeQueryTable (table: Table) {
  let query = analyzeQuery(table.syntaxNode.getChild('QueryStatement')!)
  if (!query) return

  table.fields = query.fields.map(f => ({type: f.type as FieldType, name: f.name, metadata: (f as any).metadata}))
  table.query = query.malloyQuery

  // another crazy malloyism. Seems like this should always be a string, but if it is, malloy will hit an error
  // if it happens to load a query_source before the table it depends on.
  // I also experimented with forcing queryModelContents to be an array in the correct order (ie dependencies first),
  // which seems to work, but I opted for this because it's what malloy does normally.
  if (typeof table.query.structRef == 'string') {
    table.query.structRef = TABLE_MAP[table.query.structRef] as StructRef
  }

  queryModelContents[table.name] = table
}

// Walks each part of the query checking types, rendering sql
// NB that this creates a scope for the query, and function like analyzeExpression and lookup operate within that scope, which is crucial for subquery support.
function analyzeQuery (queryNode: SyntaxNode): Query | void {
  let structRef: string
  let baseTable: Table
  let queryFields: ColumnField[] = []
  let isAgg = false

  // For now, we only support queries with exactly one table in the FROM clause.
  let froms = queryNode.getChild('FromClause')?.getChildren('TablePrimary') || []
  if (froms.find(f => f.name == 'JoinClause')) diag(froms[0], 'Query joins not yet supported')
  if (froms.length == 0) diag(queryNode, 'No tables in FROM clause')
  if (froms.length > 1) diag(froms[0], 'Multiple tables/joins in FROM clause not yet supported')

  // First, figure out the base table we're querying from.
  if (froms[0].name == 'Subquery') {
    // Malloy doesn't support subqueries in FROM, so we need to construct a querySource for it
    let syntaxNode = froms[0].getChild('SubqueryExpression')!
    structRef = txt(froms[0].getChild('Alias')) || 'subquery'
    baseTable = TABLE_MAP[structRef] = {type: 'query_source', name: structRef, syntaxNode} as Table
  } else { // from a regular table
    structRef = txt(froms[0].getChild('Identifier'))
    baseTable = TABLE_MAP[structRef]
    if (!baseTable) return diag(froms[0], `could not find table ${structRef}`)
  }
  analyzeTable(baseTable)

  // Next, get the columns this query will return (including wildcard expansion)
  let selects = queryNode.getChild('SelectClause')?.getChildren('SelectItem') || []
  selects.forEach(s => {
    if (s.getChild('Wildcard')) {
      let expandedFields = lookup(s.getChild('Wildcard')!, baseTable) || []
      expandedFields.forEach(f => queryFields.push(f))
      return
    }

    let alias = txt(s.getChild('Alias'))
    let expr = analyzeExpression(s.getChild('Expression')!, baseTable)
    isAgg ||= !!expr.isAgg
    let metadata = {}
    let name = alias || (expr.node == 'field' ? expr.path.join('_') : `col_${queryFields.length}`)

    // If a select is pointing to a field (ie `tableA.name`) malloy will use {type: 'fieldref', path: ['tableA', 'name']}
    // This kinda sucks, because it will always call the field `name` and throw an error if you select another column called `name` from a different join.
    // Instead, we're opting to pass this to malloy as an expression field, which lets us control the field's name.
    // The one minor downside I'm aware of is that malloy sometimes renders extra parenthesis it doesn't need in this case.
    queryFields.push({type: expr.type, name, e: expr, metadata})
  })

  let where = queryNode.getChild('WhereClause')?.getChildren('Expression') || []
  let filterList = where.map(w => ({
    node: 'filterCondition',
    expressionType: 'scalar',
    e: analyzeExpression(w, baseTable),
  }))

  // let groupBys = queryNode.getChild('GroupByClause')?.getChildren('Expression') || []
  // groupBys.forEach(g => {
  //   // TODO if an expression isn't also in `selects`, add it
  //   analyzeExpression(g, query, null)
  // })

  // let orderBys = queryNode.getChild('OrderByClause')?.getChildren('OrderItem') || []
  // orderBys.forEach(o => {
  //   analyzeExpression(o.getChild('Expression')!, query, null)
  // })

  return {
    fields: queryFields,
    malloyQuery: {
      type: 'query',
      structRef,
      pipeline: [{
        type: isAgg ? 'reduce' : 'project',
        queryFields: queryFields as any,
        filterList: filterList as any,
        outputStruct: null as any,
        isRepeated: false,
      }],
    },
  }
}

// Called for each expression in a query, recursively for complex expressions, including computed columns.
// This reports errors and warnings for symantic issues, as well as generating the final SQL.
// Scope is used to track the current table we're operating within when analyzing measures. If it's null, the scope is the entire query.
function analyzeExpression (expr:SyntaxNode, scope:Table): Expression {
  if (expr.type.isError) {
    diag(expr, 'Invalid expression')
    return {} as Expression
  }

  switch (expr.name) {
    case 'Literal':
      let raw = txt(expr)
      if (raw.startsWith("'")) return {node: 'stringLiteral', literal: raw.slice(1, -1), type: 'string'}
      if (/^\d+(\.\d+)?$/.test(raw)) return {node: 'numberLiteral', literal: raw, type: 'number'}
      diag(expr, `Unknown literal type: ${raw}`)
      return {node: 'stringLiteral', literal: raw, type: 'string'}
    case 'ColumnRef':
      let path = expr.getChildren('Identifier').map(i => txt(i))
      let field = (lookup(expr, scope) || [])[0]
      return {node: 'field', path, type: field?.type || 'unknown', isAgg: field?.isAgg}
    case 'FunctionCall':
      let name = txt(expr.getChild('Identifier')).toLowerCase()
      let args = expr.getChildren('Expression').map(e => analyzeExpression(e, scope))
      if (isAggregate(name)) {
        if (name == 'count' && args.length == 0) args.push({node: ''} as unknown as Expression) // hack for `count()`
        return {node: 'aggregate', function: name.toLowerCase() as AggregateFunctionType, e: args[0], type: 'number'}
      } else {
        throw new Error(`Unknown function: ${name}`)
      }
    case 'Parenthetical':
      return analyzeExpression(expr.getChild('Expression')!, scope)
    case 'BinaryExpression':
      let left = analyzeExpression(expr.firstChild!, scope)
      let right = analyzeExpression(expr.lastChild!, scope)
      let op = txt(expr.firstChild?.nextSibling).toLowerCase()
      return {node: op as any, kids: {left, right}, type: 'boolean'}
    case 'UnaryExpression':
    case 'ExistsExpression':
    case 'CaseExpression':
    case 'SubqueryExpression':
    case 'InExpression':
    default:
      throw new Error(`Unsupported expression: ${txt(expr)}`)
  }
}

// Follow a dotted path to get the field it refers to.
// Malloy does this when rendering SQL, but we do it earlier to give type diagnostics
// This also handles wildcards, returning all fields that match the path
function lookup (ref: SyntaxNode, table: Table): ColumnField[] | void {
  let curr = table
  let pathNodes = ref.getChildren('Identifier')
  for (let part of pathNodes.slice(0, -1)) {
    let name = txt(part)
    let next = curr.fields.find(f => f.name == name)

    if (!next)                return diag(part, `Join ${name} does not exist on table ${curr.name}`)
    if (!isJoin(next))        return diag(part, `${name} is not a join on ${curr.name}`)

    let table = TABLE_MAP[next.tablePath || '']
    if (!table) throw new Error('Following valid join but we couldnt find the table')
    curr = table
  }

  let last = pathNodes[pathNodes.length - 1]
  let fieldName = txt(last)
  if (ref.name == 'Wildcard') {
    return curr.fields.filter(f => !isJoin(f)) as ColumnField[]
  } else {
    let field = curr.fields.find(f => f.name == fieldName)
    if (!field)                return diag(last, `Could not find ${fieldName} on ${curr.name}`)
    if (isJoin(field)) return diag(last, `${fieldName} is a join, but is used as a colum here`)
    return [field]
  }
}

function isAggregate (name: string): boolean {
  return ['avg', 'sum', 'min', 'max', 'count'].includes(name.toLowerCase())
}

function isJoin (field: Field): field is Join {
  // I think the types here are a bit wrong. Join says it can only point
  return field.type == 'table' || (field as any).type == 'query_source'
}

function convertDataType (dataType: string): FieldType {
  switch (dataType.toUpperCase()) {
    case 'INT': return 'number'
    case 'TEXT': return 'string'
    case 'VARCHAR': return 'string'
    case 'INTEGER': return 'number'
    case 'FLOAT': return 'number'
    case 'BOOLEAN': return 'boolean'
    case 'DATE': return 'date'
    case 'DATETIME': return 'timestamp'
    case 'TIME': return 'timestamp'
    case 'TIMESTAMP': return 'timestamp'
    case 'DECIMAL': return 'number'
    case 'DOUBLE': return 'number'
    case 'BIGINT': return 'number'
    case 'SMALLINT': return 'number'
    case 'TINYINT': return 'number'
    case 'BYTEINT': return 'number'
    case 'BIGDECIMAL': return 'number'
    default: throw new Error(`Unknown data type: ${dataType}`)
  }
}

