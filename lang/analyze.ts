import {parser} from './parser.js'
import {readFile, readdir} from 'fs/promises'
import path from 'path'
import type {SyntaxNode, SyntaxNodeRef} from '@lezer/common'
import {type Table, txt, type Query, type Join, type Diagnostic, type Expression, type Field, type ColumnField, type FieldType, type Scope} from './core.ts'
import {extractLeadingMetadata} from './metadata.ts'
import malloy, {type AggregateFunctionType, type StructRef, type AggregateExpr, type FieldnameNode, type OutputFieldNode} from '../node_modules/@malloydata/malloy/dist/model/index.js'


export type {Query, Table, Diagnostic} from './core.ts'

let TABLE_MAP: Record<string, Table> = {}
let FILE_MAP: Record<string, string> = {}
let diagnostics: Diagnostic[] = []
let queryModelContents: Record<string, any> = {}
let currentFile: string = ''

function diag<T> (node: SyntaxNode | SyntaxNodeRef, message: string, defaultReturn?: T): T {
  diagnostics.push({from: node.from, to: node.to, message, severity: 'error', file: currentFile})
  return defaultReturn!
}

export function clearWorkspace () {
  FILE_MAP = {}
  TABLE_MAP = {}
  diagnostics = []
  queryModelContents = {}
}

export function getTable (name: string) { return TABLE_MAP[name] }
export function getDiagnostics () { return diagnostics }
export function getFile (name: string) { return FILE_MAP[name] }

// Loads and parses all gsql files within a directory
export async function loadWorkspace (dir:string) {
  for (let f of await readdir(dir)) {
    if (!f.endsWith('.gsql')) continue
    let contents = await readFile(path.join(dir, f), 'utf-8')
    analyze(contents, f)
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

export function analyze (source:string, file: string = 'input'): Query[] {
  currentFile = file
  let tree = parser.parse(source)
  FILE_MAP[file] = tree.rawText = source

  // Collect syntax errors within the source.
  tree.topNode.cursor().iterate(n => {
    if (n.type.isError) diag(n, 'Syntax error')
  })

  tree.topNode.getChildren('TableStatement').forEach(registerTable)
  tree.topNode.getChildren('ViewStatement').forEach(registerTable)
  let queries = tree.topNode.getChildren('QueryStatement').map(analyzeQuery).filter(q => !!q)
  return queries
}

// Stores the table without analyzing it. We need to know all the tables before we can analyze any table, since they refer to each other.
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
    let name = txt(cn.getChild('Identifier'))

    if (cn.getChild('PrimaryKey')) {
      if (table.primaryKey) diag(cn, `Table ${table.name} has multiple primary keys`)
      table.primaryKey = name
    }

    table.fields.push({
      name,
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
    let joinType = jn.getChild('JoinType')?.name == 'join_many' ? 'many' : 'one'

    // Malloy does this bonkers thing where a JoinField contains both the details of that join, and the entire target table.
    // This clone is important, otherwise two tables that join each other create an infinite loop when we give them to Malloy.
    let clone = structuredClone(target)
    let join = {...clone, name, join: joinType} as Join

    // It's important we add the join before processing its expression, since the expression will refer to it
    table.fields.push(join)
    join.onExpression = analyzeExpression(jn.getChild('Expression')!, {table, outputFields: []})
  })

  // measures/dimensions, like `measure total_price AS SUM(price)`
  // malloy represents them as just a regular field, plus an expression
  // TODO: I think one measure can ref another, so we need to process these bottom up to resolve types
  table.syntaxNode.getChildren('ComputedDef').forEach(cn => {
    let expression = analyzeExpression(cn.getChild('Expression')!, {table, outputFields: []})
    table.fields.push({
      name: txt(cn.getChild('Identifier')),
      type: expression.type,
      metadata: extractLeadingMetadata(cn),
      e: expression,
      isAgg: expression.isAgg,
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
  let scope: Scope = {table: null as any, outputFields: []}
  let isAgg = false

  if (!txt(queryNode)) return // lezer sometimes parses an empty string as a query, if the file doesn't have one.

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
    scope.table = TABLE_MAP[structRef] = {type: 'query_source', name: structRef, syntaxNode} as Table
  } else { // from a regular table
    structRef = txt(froms[0].getChild('Identifier'))
    scope.table = TABLE_MAP[structRef]
    if (!scope.table) return diag(froms[0], `could not find table ${structRef}`)
  }
  analyzeTable(scope.table)

  // Next, get the columns this query will return (including wildcard expansion)
  let selects = queryNode.getChild('SelectClause')?.getChildren('SelectItem') || []
  selects.forEach(s => {
    if (s.getChild('Wildcard')) {
      let path = s.getChild('Wildcard')?.getChildren('Identifier').map(i => txt(i)) || []
      let {fields} = lookup(s.getChild('Wildcard')!, scope)
      fields.forEach(f => {
        scope.outputFields.push({...f,  e: {node: 'field', path: [...path, f.name], type: f.type}})
      })
    } else {
      let expr = analyzeExpression(s.getChild('Expression')!, scope)
      let name = nameExpression(expr, scope, s.getChild('Alias'))
      isAgg ||= !!expr.isAgg
      let metadata = {}

      if (expr.isAgg) {
        scope.outputFields.push({type: expr.type, name, metadata, e: expr, expressionType: 'aggregate', isAgg: true})
      } else {
        scope.outputFields.push({type: expr.type, name, metadata, e: expr})
      }
    }
  })

  // In Malloy, `where` and `having` are both in the `filterList`, just the `expressionType` is different
  let where = queryNode.getChild('WhereClause')?.getChild('Expression')
  let having = queryNode.getChild('HavingClause')?.getChild('Expression')
  let filterList = [where, having].flatMap(node => {
    if (!node) return []
    let ands = unpackAnds(analyzeExpression(node, scope))
    return ands.map(e => ({
      node: 'filterCondition',
      expressionType: e.isAgg ? 'aggregate' : 'scalar',
      e: e,
    }))
  })

  // In Malloy, group by's are just query fields. If you specify a `group by` that isn't in your `select`, we'll auto-add it.
  let groupBys = queryNode.getChild('GroupByClause')?.getChildren('SelectItem') || []
  groupBys.forEach(g => {
    let expr = analyzeExpression(g.getChild('Expression')!, scope)
    let name = nameExpression(expr, scope, g.getChild('Alias'))
    if (expr.isAgg) return diag(g, 'Cannot group by aggregate expressions')
    if (scope.outputFields.find(f => f.name == name)) return // do nothing, it's already in there
    scope.outputFields.unshift({type: expr.type, name, metadata: {}, e: expr})
  })

  // ORDER BY
  let orderBys = queryNode.getChild('OrderByClause')?.getChildren('OrderItem') || []
  let orderByList = orderBys.map(o => {
    let field = txt(o.getChild('Identifier'))
    let dir = txt(o.getChild('Kw')).toLowerCase() == 'desc' ? 'desc' : 'asc' as 'asc' | 'desc'
    return {field, dir}
  })

  return {
    fields: scope.outputFields,
    malloyQuery: {
      type: 'query',
      structRef,
      pipeline: [{
        type: isAgg ? 'reduce' : 'project',
        queryFields: scope.outputFields as any,
        filterList: filterList as any,
        outputStruct: null as any,
        isRepeated: false,
        orderBy: orderByList.length ? orderByList : undefined,
      }],
    },
  }
}

// Called for each expression in a query, recursively for complex expressions, including computed columns.
// This reports errors and warnings for symantic issues, as well as generating the final SQL.
// Scope is used to track the current table we're operating within when analyzing measures. If it's null, the scope is the entire query.
function analyzeExpression (expr:SyntaxNode, scope:Scope): Expression {
  if (expr.type.isError) {
    diag(expr, 'Invalid expression')
    return {} as Expression
  }

  switch (expr.name) {
    case 'Literal': {
      let raw = txt(expr)
      if (raw.startsWith("'")) return {node: 'stringLiteral', literal: raw.slice(1, -1), type: 'string'}
      if (/^\d+(\.\d+)?$/.test(raw)) return {node: 'numberLiteral', literal: raw, type: 'number'}
      diag(expr, `Unknown literal type: ${raw}`)
      return {node: 'stringLiteral', literal: raw, type: 'string'}
    }
    case 'Wildcard': {
      return {node: ''} as Expression // what malloy expects for count(*)
    }
    case 'ColumnRef': {
      let path = expr.getChildren('Identifier').map(i => txt(i))
      let {fields, inOutput} = lookup(expr, scope)
      if (inOutput && fields[0].isAgg) {
        return {node: 'outputField', name: path[0], type: fields[0].type, isAgg: fields[0].isAgg} as Expression & OutputFieldNode
      } else {
        return {node: 'field', path, type: fields[0]?.type || 'unknown', isAgg: fields[0]?.isAgg} as Expression & FieldnameNode
      }
    }
    case 'FunctionCall': {
      let name = txt(expr.getChild('Identifier')).toLowerCase() as AggregateFunctionType
      let args = expr.getChildren('Expression').map(e => analyzeExpression(e, scope))
      if (name == 'count') {
        if (args.length == 0) args.push({node: ''} as unknown as Expression) // hack for `count()`
        if (args[0].node) name = 'distinct' // anything besides `count()` or `count(*)` is a distinct count
        return {node: 'aggregate', function: name, e: args[0], type: 'number', isAgg: true}
      } else if (isAggregate(name)) {
        let res = {node: 'aggregate', function: name, e: args[0], type: 'number', isAgg: true} as Expression & AggregateExpr

        // Aggregates need a `structPath`, which in malloy is the `users` in `users.avg(age)`. We'd rather you write `avg(users.age)`, so we
        // need to get that path from the arguments, and pass it to malloy as the structPath.
        // NB that malloy is unhappy if structPath is undefined or empty, so only set it if we have one.
        // TODO this assumes args[0] is a ColumnRef, so `avg(users.age / 2)` wouldn't work. We should make that work.
        if (isAsymmetricAggregate(name)) {
          if (args[0]?.node !== 'field') diag(expr, 'Aggregate requires a column or expression')
          let path = (args[0] as FieldnameNode).path
          if (path.length > 1) {
            res.structPath = path.slice(0, -1)
          }
        }

        return res
      } else {
        throw new Error(`Unknown function: ${name}`)
      }
    }
    case 'Parenthetical': {
      return analyzeExpression(expr.getChild('Expression')!, scope)
    }
    case 'BinaryExpression': {
      let left = analyzeExpression(expr.firstChild!, scope)
      let right = analyzeExpression(expr.lastChild!, scope)
      let op = txt(expr.firstChild?.nextSibling).toLowerCase()
      return {node: op as any, kids: {left, right}, type: 'boolean', isAgg: left.isAgg || right.isAgg}
    case 'UnaryExpression':
    case 'ExistsExpression':
    case 'CaseExpression':
    case 'SubqueryExpression':
    case 'InExpression':
    default:
      throw new Error(`Unsupported expression: ${txt(expr)}`)
  }
}

// Get the field that a ColumnRef refers to.
// This could be a column on a table, the alias of a column in the query, or a wildcard. We'll also follow dotted paths to traverse joins.
// The lookup is redundant with Malloy, but doing it means we get type info and metadata on all fields.
function lookup (ref: SyntaxNode, scope: Scope): {fields: ColumnField[], inOutput: boolean} {
  let curr = scope
  let pathNodes = ref.getChildren('Identifier')
  let last = ref.name == 'Wildcard' ? null : pathNodes.pop()
  let fieldName = txt(last)
  let def = {fields: [] as ColumnField[], inOutput: false}

  // first step through all the parts of the dotted path (except the last one) to get the right table
  for (let part of pathNodes) {
    let name = txt(part)
    let next = curr.table.fields.find(f => f.name == name)

    if (!next)         return diag(part, `Join ${name} does not exist on table ${curr.table.name}`, def)
    if (!isJoin(next)) return diag(part, `${name} is not a join on ${curr.table.name}`, def)

    curr = {table: TABLE_MAP[next.tablePath || ''], outputFields: []}
    if (!curr) throw new Error('Following valid join but we couldnt find the table')
  }

  // now that we have the right table, get the field(s) that match. First handle wildcards
  if (ref.name == 'Wildcard') {
    return {fields: curr.table.fields.filter(f => !isJoin(f) && !f.isAgg) as ColumnField[], inOutput: false}
  }

  // otherwise, look for a field in the current table
  let field = curr.table.fields.find(f => f.name == fieldName)
  if (field) {
    if (isJoin(field)) return diag(last!, `${fieldName} is a join, but is used as a colum here`, def)
    return {fields: [field], inOutput: false}
  }

  // finally, look at the output fields in the query. This is lower precedence than fields on the table.
  let outField = curr.outputFields.find(f => f.name == fieldName)
  if (outField) {
    return {fields: [outField], inOutput: true}
  }

  return diag(ref, `Could not find ${fieldName} on ${curr.table.name}`, def)
}

// Pick a sensible name for a column
// If a select is pointing to a field (ie `tableA.name`) malloy will use {type: 'fieldref', path: ['tableA', 'name']}
// This kinda sucks, because it will always call the field `name` and throw an error if you select another column called `name` from a different join.
// Instead, we're opting to pass this to malloy as an expression field, which lets us control the field's name.
// The one minor downside I'm aware of is that malloy sometimes renders extra parenthesis it doesn't need in this case.
function nameExpression (expr: Expression, scope: Scope, aliasNode: SyntaxNode | null) {
  if (aliasNode) return txt(aliasNode)
  if (expr.node == 'field') return expr.path.join('_')
  return `col_${scope.outputFields.length}`
}

// turn `a and b and c` into `[a, b, c]`
function unpackAnds (expr: Expression): Expression[] {
  if (expr.node == 'and') {
    return [expr.kids.left as Expression, expr.kids.right as Expression].flatMap(unpackAnds)
  }
  return [expr]
}

function isAsymmetricAggregate (name: string): boolean {
  return ['avg', 'sum'].includes(name.toLowerCase())
}

function isAggregate (name: string): boolean {
  return ['count', 'min', 'max', 'avg', 'sum'].includes(name.toLowerCase())
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

