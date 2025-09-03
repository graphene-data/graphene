import {NodeWeakMap, type SyntaxNode, type SyntaxNodeRef} from '@lezer/common'
import type {Table, Query, Join, Expression, Field, ColumnField, FieldType, Scope, FileInfo, Diagnostic} from './types.ts'
import {type AggregateFunctionType, type StructRef, type AggregateExpr, type FieldnameNode, type OutputFieldNode, type FunctionOverloadDef} from './node_modules/@malloydata/malloy/dist/model/index.js'
import {GlobalNameSpace} from './node_modules/@malloydata/malloy/dist/lang/ast/types/global-name-space.js'
import {DialectNameSpace} from './node_modules/@malloydata/malloy/dist/lang/ast/types/dialect-name-space.js'
import {getDialect} from './node_modules/@malloydata/malloy/dist/dialect/dialect_map.js'
import {txt, compact, getFile, getPosition} from './util.ts'
import {extractLeadingMetadata} from './metadata.ts'
import {config} from './config.ts'

export let FILE_MAP: Record<string, FileInfo> = {}
export let diagnostics: Diagnostic[] = []

// Because table objects are sent to Malloy, I want to avoid putting large objects on it that Malloy isn't expecting.
let TABLE_NODE_MAP = new WeakMap<Table, SyntaxNode>()
let NODE_ENTITY_MAP = new NodeWeakMap<any>()

// Creates tables without analyzing them.
// We need to know all the tables before we can analyze any table, since they refer to each other.
export function findTables (file: FileInfo): Table[] {
  file.tree!.topNode.cursor().iterate(n => {
    if (n.type.isError) diag(n.node, 'Syntax error')
  })

  let tn = file.tree!.topNode
  let nodes = tn.getChildren('TableStatement').concat(tn.getChildren('ViewStatement'))
  return nodes.map(syntaxNode => {
    let name = txt(syntaxNode.firstChild?.nextSibling)
    let type = syntaxNode.getChild('QueryStatement') ? 'query_source' : 'table' as 'query_source' | 'table'
    let metadata = extractLeadingMetadata(syntaxNode)
    let table: Table = {type, name, metadata, fields: []}
    TABLE_NODE_MAP.set(table, syntaxNode)
    return table
  })
}

// Parses a table (model) declaration. Most analysis is done lazily, so this just gets the tables name and fields.
// TODO: detect cycles. It's possible for two tables to refer to each other. For joins that's ok, for measures it's problematic.
// if tableA.measureA depends on tableB.measureB, but measureB depends on tableA.measureC, we can't compute the type right now.
export function analyzeTable (table: Table) {
  if (table.analyzed) return
  table.analyzed = true
  table.connection = config.dialect
  table.dialect = config.dialect
  table.tableName = table.name
  table.tablePath = config.namespace ? `${config.namespace}.${table.name}` : table.name
  table.fields = []

  if (table.type == 'table') analyzeDatabaseTable(table)
  else analyzeQueryTable(table)
}

// Actual table with columns that lives in the database
function analyzeDatabaseTable (table: Table) {
  let node = TABLE_NODE_MAP.get(table)!
  // regular columns in the db, like `full_name VARCHAR`
  node.getChildren('ColumnDef').forEach(cn => {
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
  node.getChildren('JoinDef').forEach(jn => {
    let target = lookupTable(txt(jn.getChild('Identifier')), jn)
    if (!target) return diag(jn, 'Unknown table to join')
    if (!target.analyzed) analyzeTable(target)
    let name = txt(jn.getChild('Alias')) || target.name
    let joinType = {'join_many': 'many', 'join_one': 'one'}[txt(jn.getChild('JoinType'))]
    if (!joinType) throw new Error(`Unknown join type: ${txt(jn.getChild('JoinType'))}`)

    // Malloy does this bonkers thing where a JoinField contains both the details of that join, and the entire target table.
    // This clone is important, otherwise two tables that join each other create an infinite loop when we give them to Malloy.
    let clone = structuredClone(target)
    let join = {...clone, name, join: joinType} as Join

    // It's important we add the join before processing its expression, since the expression will refer to it
    table.fields.push(join)
    join.onExpression = analyzeExpression(jn.getChild('Expression')!, {table, outputFields: []})
  })

  // measures/dimensions, like `sum(price) as total_price`
  // malloy represents them as just a regular field, plus an expression
  // TODO: I think one measure can ref another, so we need to process these bottom up to resolve types
  node.getChildren('ComputedDef').forEach(cn => {
    let expression = analyzeExpression(cn.getChild('Expression')!, {table, outputFields: []})
    table.fields.push({
      name: txt(cn.getChild('Alias')),
      type: expression.type,
      metadata: extractLeadingMetadata(cn),
      e: expression,
      isAgg: expression.isAgg,
    })
  })
}

function analyzeQueryTable (table: Table) {
  let node = TABLE_NODE_MAP.get(table)!
  let query = analyzeQuery(node.getChild('QueryStatement')!)
  if (!query) return

  table.fields = query.fields.map(f => ({type: f.type as FieldType, name: f.name, metadata: (f as any).metadata}))
  table.query = query.malloyQuery

  // another crazy malloyism. Seems like this should always be a string, but if it is, malloy will hit an error
  // if it happens to load a query_source before the table it depends on.
  // I also experimented with forcing queryModelContents to be an array in the correct order (ie dependencies first),
  // which seems to work, but I opted for this because it's what malloy does normally.
  if (typeof table.query.structRef == 'string') {
    table.query.structRef = lookupTable(table.query.structRef, node) as StructRef
  }
}

// Walks each part of the query checking types, rendering sql
// NB that this creates a scope for the query, and function like analyzeExpression and lookup operate within that scope, which is crucial for subquery support.
export function analyzeQuery (queryNode: SyntaxNode): Query | void {
  let structRef: string
  let scope: Scope = {table: null as any, outputFields: []}
  let isAgg = false
  let subQuerySources: Table[] = []

  if (!txt(queryNode)) return // lezer sometimes parses an empty string as a query, if the file doesn't have one.

  // FROM
  // For now, we only support queries with exactly one table in the FROM clause.
  let froms = queryNode.getChild('FromClause')?.getChildren('TablePrimary') || []
  if (froms.find(f => f.name == 'JoinClause')) diag(froms[0], 'Query joins not yet supported')
  if (froms.length == 0) diag(queryNode, 'No tables in FROM clause')
  if (froms.length > 1) diag(froms[0], 'Multiple tables/joins in FROM clause not yet supported')

  // First, figure out the base table we're querying from.
  if (froms[0].name == 'Subquery') {
    // Malloy doesn't support subqueries in FROM. We could either add the subquery to the pipeline, or create a "query_source" table for it.
    // I'm opting for query_source, because it's easier to reason about how multiple subqueries might work.
    structRef = txt(froms[0].getChild('Alias')) || 'subquery'
    scope.table = {type: 'query_source', name: structRef} as Table
    TABLE_NODE_MAP.set(scope.table, froms[0].getChild('SubqueryExpression')!)
    analyzeTable(scope.table)
    subQuerySources.push(scope.table)
  } else { // from a regular table
    structRef = txt(froms[0].getChild('Identifier'))
    scope.table = lookupTable(structRef, froms[0])!
    NODE_ENTITY_MAP.set(froms[0], {entityType: 'table', table: scope.table})
    if (!scope.table) return diag(froms[0], `could not find table ${structRef}`)
  }

  // SELECT
  // Next, get the columns this query will return (including wildcard expansion)
  let selects = queryNode.getChild('SelectClause')?.getChildren('SelectItem') || []
  let isSelectDistinct = queryNode.getChild('SelectClause')?.getChildren('Kw').find(n => txt(n).toLowerCase() == 'distinct')
  isAgg ||= !!isSelectDistinct // select distinct makes the query a reduction
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

  // WHERE / HAVING
  // In Malloy, `where` and `having` are both in the `filterList`, just the `expressionType` is different.
  // We want to allow you to write both pre- and post-agg filters in the `where`, clause, which seems mostly safe if they're and-ed together.
  // We also support explicit `having` clauses, for users who know that's a thing and want to use it.
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

  // GROUP BY
  // In Malloy, non-agg fields in a reduction query are implicitly grouped by.
  // In Graphene, we allow you say `group by BLAH` without having to `select BLAH`.
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

  // LIMIT / OFFSET
  let limts = queryNode.getChild('LimitClause')?.getChildren('Number') || []
  let queryLimit = limts[0] ? Number(txt(limts[0])) : undefined
  let queryOffset = limts[1] ? Number(txt(limts[1])) : undefined
  if (queryOffset) diag(limts[1], 'OFFSET is not supported yet')

  return {
    fields: scope.outputFields,
    subQuerySources,
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
        limit: queryLimit,
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
      return analyzeFunctionCall(expr, scope)
    }
    case 'Parenthetical': {
      return analyzeExpression(expr.getChild('Expression')!, scope)
    }
    case 'BinaryExpression': {
      let left = analyzeExpression(expr.firstChild!, scope)
      let right = analyzeExpression(expr.lastChild!, scope)
      let op = txt(expr.firstChild?.nextSibling).toLowerCase()
      return {node: op as any, kids: {left, right}, type: 'boolean', isAgg: left.isAgg || right.isAgg}
    }
    case 'NullTestExpression': {
      let node = expr.getChildren('Kw').find(n => txt(n).toLowerCase() == 'not') ? 'is-not-null' : 'is-null'
      let e = analyzeExpression(expr.firstChild!, scope)
      return {node: node as "is-not-null" | "is-null", type: 'boolean', isAgg: e.isAgg, e}
    }
    case 'UnaryExpression': {
      let opTxt = txt(expr.firstChild).toLowerCase()
      let child = analyzeExpression(expr.lastChild!, scope)
      if (opTxt === 'not') return {node: 'not', e: child, type: 'boolean', isAgg: child.isAgg}
      if (opTxt === '-') return {node: 'unary-', e: child, type: child.type, isAgg: child.isAgg}
      if (opTxt === '+') return {node: '()', e: child, type: child.type, isAgg: child.isAgg}
      throw new Error(`Unknown unary operator: ${opTxt}`)
    }
    case 'CaseExpression': {
      let caseValue = expr.getChild('Expression')
      let whens = expr.getChildren('WhenClause')
      let els = expr.getChild('ElseClause')
      let kids: any = {
        caseValue: caseValue ? analyzeExpression(caseValue, scope) : undefined,
        caseElse: els ? analyzeExpression(els.getChild('Expression')!, scope) : undefined,
        caseWhen: whens.map(w => analyzeExpression(w.getChildren('Expression')[0]!, scope)),
        caseThen: whens.map(w => analyzeExpression(w.getChildren('Expression')[1]!, scope)),
      }
      let thenType = (kids.caseThen[0]?.type) || 'string' // TODO ensure that all thens have the same type
      return {node: 'case', kids: compact(kids), type: thenType as FieldType, isAgg: false}
    }
    case 'InExpression': {
      let not = !!expr.getChild('Kw<"not">')
      let eNode = analyzeExpression(expr.firstChild!, scope)
      // Values list or subquery
      let oneOf: Expression[] = []
      let valueList = expr.getChild('InValueList')
      if (valueList) {
        oneOf = valueList.getChildren('Expression').map(v => analyzeExpression(v, scope))
      } else {
        // Subquery variant: use genericSQLExpr as a placeholder
        oneOf = [{node: 'genericSQLExpr', kids: {args: []}, type: 'array'} as any]
      }
      let isAgg = eNode.isAgg || oneOf.some(v => (v as any).isAgg)
      return {node: 'in', not, kids: {e: eNode as any, oneOf: oneOf as any}, type: 'boolean', isAgg} as any
    }
    case 'SubqueryExpression':
    default:
      throw new Error(`Unsupported expression: ${txt(expr)}`)
  }
}

function analyzeFunctionCall (expr: SyntaxNode, scope: Scope): Expression {
  let name = txt(expr.getChild('Identifier')).toLowerCase() as AggregateFunctionType
  let args = expr.getChildren('Expression').map(e => analyzeExpression(e, scope))
  if (name == 'count') {
    if (args.length == 0) args.push({node: ''} as unknown as Expression) // hack for `count()`
    if (args[0].node) name = 'distinct' // anything besides `count()` or `count(*)` is a distinct count
    return {node: 'aggregate', function: name, e: args[0], type: 'number', isAgg: true}
  }

  if (isAggregate(name)) {
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
  }

  let entry = new GlobalNameSpace().getEntry(name)
  let dialect = getDialect(config.dialect)
  let dialectEntry = new DialectNameSpace(dialect).getEntry(name)
  let overloads = ((dialectEntry || entry)?.entry as any)?.overloads || []

  // check out malloy's `findOverload` for picking the right one
  let overload: FunctionOverloadDef = overloads.find(o => {
    return o.params.length == args.length || !!o.params.find(p => p.isVariadic)
  })
  if (!overload) return diag(expr, `Unknown function: ${name}`, {} as Expression)

  let type: FieldType
  if (overload.returnType.type == 'null') type = 'string'
  else if (overload.returnType.type == 'generic') type = args[0]?.type || 'string'
  else if (overload.returnType.type == 'turtle') throw new Error('Turtle functions not supported')
  else if (overload.returnType.type == 'composite') throw new Error('Composite functions not supported')
  else if (overload.returnType.type == 'filter expression') throw new Error('Filter expressions not supported')
  else if (overload.returnType.type == 'sql native') throw new Error('SQL native functions not supported')
  else if (overload.returnType.type == 'regular expression') throw new Error('Regular expression functions not supported')
  else if (overload.returnType.type == 'table') throw new Error('Table functions not supported')
  else if (overload.returnType.type == 'sql_select') throw new Error('SQL select functions not supported')
  else if (overload.returnType.type == 'query_source') throw new Error('Query source functions not supported')
  else if (overload.returnType.type == 'duration') throw new Error('Duration functions not supported')
  else type = overload.returnType.type

  return {
    node: 'function_call',
    type,
    name,
    overload,
    expressionType: overload.returnType.expressionType || 'scalar',
    kids: {args: args as any},
    isAgg: overload.returnType.expressionType == 'aggregate',
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

    curr = {table: lookupTable(next.tableName || '', part)!, outputFields: []}
    if (!curr.table) throw new Error('Following valid join but we couldnt find the table')
    NODE_ENTITY_MAP.set(part, {entityType: 'table', table: curr.table})
  }

  // TODO: this code is weird. The fields are only in the output if there's no pathNodes, so can we simplify `curr`?

  // now that we have the right table, get the field(s) that match. First handle wildcards
  if (ref.name == 'Wildcard') {
    return {fields: curr.table.fields.filter(f => !isJoin(f) && !f.isAgg) as ColumnField[], inOutput: false}
  }

  // otherwise, look for a field in the current table
  let field = curr.table.fields.find(f => f.name == fieldName)
  if (field) {
    if (isJoin(field)) return diag(last!, `${fieldName} is a join, but is used as a colum here`, def)
    NODE_ENTITY_MAP.set(last!, {entityType: 'field', field, table: curr.table})
    return {fields: [field], inOutput: false}
  }

  // finally, look at the output fields in the query. This is lower precedence than fields on the table.
  let outField = curr.outputFields.find(f => f.name == fieldName)
  if (outField) {
    return {fields: [outField], inOutput: true}
  }

  return diag(ref, `Could not find ${fieldName} on ${curr.table.name}`, def)
}

function lookupTable (name: string, node: SyntaxNode): Table | void {
  let currentUri = getFile(node).path

  for (let file of Object.values(FILE_MAP)) {
    if (file.path.endsWith('.gsql') || file.path == currentUri) {
      let match = file.tables.find(t => t.name == name)
      if (match) return match
    }
  }
}

export function clearWorkspace () {
  FILE_MAP = {}
  TABLE_NODE_MAP = new WeakMap()
  diagnostics = []
}
export function clearDiagnostics () {
  diagnostics = []
}

export function getNodeEntity (node: SyntaxNode): any {
  return NODE_ENTITY_MAP.get(node)
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

function diag<T> (node: SyntaxNode | SyntaxNodeRef, message: string, defaultReturn?: T): T {
  let file = getFile(node)
  let from = getPosition(node.from, file)
  let to = getPosition(node.to, file)
  diagnostics.push({from, to, message, severity: 'error', file: file.path})
  return defaultReturn!
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
    case 'INT64': return 'number'
    case 'TEXT': return 'string'
    case 'STRING': return 'string'
    case 'VARCHAR': return 'string'
    case 'INTEGER': return 'number'
    case 'FLOAT': return 'number'
    case 'FLOAT64': return 'number'
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
    case 'GEOGRAPHY': return 'string'
    default: throw new Error(`Unknown data type: ${dataType}`)
  }
}

