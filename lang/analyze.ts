import {parser} from './parser.js'
import {readFile, readdir} from 'fs/promises'
import path from 'path'
import type {SyntaxNode, SyntaxNodeRef} from '@lezer/common'
import {type Table, txt, TABLE_MAP, type Query, type Join, type Diagnostic, type Expression, type Field} from './core.ts'
import {extractLeadingMetadata} from './metadata.ts'
import malloy from '../node_modules/@malloydata/malloy/dist/model/index.js'

export type {Query, Table, Diagnostic} from './core.ts'

let diagnostics: Diagnostic[] = []
let queryModelContents: Record<string, any> = {}

function diag (node: SyntaxNode | SyntaxNodeRef, message: string): void {
  diagnostics.push({from: node.from, to: node.to, message, severity: 'error'})
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

function registerTable (t: SyntaxNode) {
  let name = txt(t.firstChild?.nextSibling)
  let query = t.getChild('QueryStatement')
  let table = TABLE_MAP[name] = {
    type: query ? 'query_source' : 'table',
    name,
    fields: [],
    analyzed: false,
    syntaxNode: t,
    metadata: extractLeadingMetadata(t),
  } as Table
  return table
}

// Parses a table (model) declaration. Most analysis is done lazily, so this just gets the tables name and fields.
function analyzeTable (table: Table) {
  if (table.analyzed) return
  table.analyzed = true
  table.connection = 'duckdb'
  table.dialect = 'duckdb'
  table.tablePath = table.name

  queryModelContents[table.name] = table

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

// QuerySource is the result of a query that we can treat like a table.
// It's used to support subqueries, as well as `table foo as (select * from bar)` style tables
function constructQuerySource (name: string, node: SyntaxNode) {
  if (node.name != 'QueryStatement') throw new Error('Expected a QueryStatement')
  // let query = analyzeQuery(node)

  // modelsToUse.push({
  //   type: 'query_source',
  //   name,
  //   fields: [],
  //   analyzed: false,
  //   syntaxNode: node,
  // })
}

// Walks each part of the query checking types, rendering sql
// NB that this creates a scope for the query, and function like analyzeExpression and lookup operate within that scope, which is crucial for subquery support.
function analyzeQuery (queryNode: SyntaxNode): Query | void {
  let froms = queryNode.getChild('FromClause')?.getChildren('TablePrimary') || []
  if (froms.find(f => f.name == 'JoinClause')) diag(froms[0], 'Query joins not yet supported')
  if (froms.length == 0) diag(queryNode, 'No tables in FROM clause')
  if (froms.length > 1) diag(froms[0], 'Multiple tables/joins in FROM clause not yet supported')

  let structRef: string
  let baseTable: Table
  if (froms[0].name == 'Subquery') {
    // Malloy doesn't support subqueries in FROM, so we need to construct a querySource for it
    let alias = txt(froms[0].getChild('Alias')) || 'subquery'
    let subq = froms[0].getChild('SubqueryExpression')?.getChild('QueryStatement')
    baseTable = constructQuerySource(alias, subq!)
    structRef = alias
  } else {
    // from a regular table
    structRef = txt(froms[0].getChild('Identifier'))
    baseTable = TABLE_MAP[structRef]
    if (!baseTable) return diag(froms[0], `Could not find table ${structRef}`)
    analyzeTable(baseTable)
  }

  // TODO: build up an array of all the columns this query wiil return (including wildcard expansion)
  let selects = queryNode.getChild('SelectClause')?.getChildren('SelectItem') || []
  let queryFields: Field[] = []
  selects.forEach(s => {
    let alias = txt(s.getChild('Alias'))
    let expr = analyzeExpression(s.getChild('Expression')!, baseTable)
    if (expr.node == 'field') {
      // TODO: malloy ignores this name, but it'd be great to use it. Maybe we should just not use fieldref?
      // In malloy if you alias `name as name2` you'll get an expression that refers to name as a "field"
      let name = alias || expr.path.join('_')
      queryFields.push({type: 'fieldref', name, path: expr.path, isAgg: expr.isAgg})
    } else {
      let name = alias || `col_${queryFields.length}`
      queryFields.push({type: expr.type, name, e: expr, isAgg: expr.isAgg})
    }
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
    type: 'query',
    fields: queryFields,
    malloyQuery: {
      structRef,
      pipeline: [{
        type: queryFields.find(f => f.isAgg) ? 'reduce' : 'project',
        queryFields,
        filterList,
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
    case 'Wildcard':
      // I think this is just implied in there are no selects?
      throw new Error('Wildcard not yet supported')
    case 'ColumnRef':
      let path = expr.getChildren('Identifier').map(i => txt(i))
      let field = lookup(expr.getChildren('Identifier'), scope)
      return {node: 'field', path, type: field?.type || 'unknown', isAgg: field?.isAgg}
    case 'FunctionCall':
      let name = txt(expr.getChild('Identifier')).toLowerCase()
      let args = expr.getChildren('Expression').map(e => analyzeExpression(e, scope))
      if (isAggregate(name)) {
        if (name == 'count' && args.length == 0) args.push({node: ''} as unknown as Expression) // hack for `count()`
        return {node: 'aggregate', function: name.toLowerCase(), e: args[0], type: 'number'}
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
function lookup (pathNodes: SyntaxNode[], table: Table): Field | void {
  let curr = table
  for (let part of pathNodes.slice(0, -1)) {
    let name = txt(part)
    let next = curr.fields.find(f => f.name == name)

    if (!next)                return diag(part, `Join ${name} does not exist on table ${curr.name}`)
    if (next.type != 'table') return diag(part, `${name} is not a join on ${curr.name}`)

    let table = TABLE_MAP[(next as Join).tablePath || '']
    if (!table) throw new Error('Following valid join but we couldnt find the table')
    curr = table
  }

  let last = pathNodes[pathNodes.length - 1]
  let fieldName = txt(last)
  let field = curr.fields.find(f => f.name == fieldName)
  if (!field) return diag(last, `Could not find ${txt(last)} on ${curr.name}`)
  if (field.type == 'table') return diag(last, `${fieldName} is a join, but is used as a colum here`)

  return field as Field
}

function isAggregate (name: string): boolean {
  return ['avg', 'sum', 'min', 'max', 'count'].includes(name.toLowerCase())
}

function convertDataType (dataType: string): string {
  switch (dataType.toUpperCase()) {
    case 'INT': return 'number'
    case 'TEXT': return 'string'
    case 'VARCHAR': return 'string'
    case 'INTEGER': return 'number'
    case 'FLOAT': return 'number'
    case 'BOOLEAN': return 'boolean'
    case 'DATE': return 'date'
    case 'DATETIME': return 'datetime'
    case 'TIME': return 'time'
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

