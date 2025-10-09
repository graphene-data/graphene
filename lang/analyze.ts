import {NodeWeakMap, type SyntaxNode, type SyntaxNodeRef} from '@lezer/common'
import type {Table, Query, Join, Expression, Field, ColumnField, FieldType, Scope, FileInfo, Diagnostic} from './types.ts'
import {isExtractUnit, isTemporalType, type TemporalTypeDef, type AggregateFunctionType, type StructRef, type AtomicTypeDef} from './node_modules/@malloydata/malloy/dist/model/index.js'
import {txt, compact, getFile, getPosition, walkExpression} from './util.ts'
import {extractLeadingMetadata} from './metadata.ts'
import {config, dialectKeyword} from './config.ts'
import {findOverloads} from './functions.ts'
import {inferParamTypes} from './params.ts'

export let FILE_MAP: Record<string, FileInfo> = {}
export let diagnostics: Diagnostic[] = []

// Because table objects are sent to Malloy, I want to avoid putting large objects on it that Malloy isn't expecting.
let TABLE_NODE_MAP = new WeakMap<Table, SyntaxNode>()
let NODE_ENTITY_MAP = new NodeWeakMap<any>()

const errorExpression: Expression = {node: 'error', type: 'error'}

// Creates tables without analyzing them.
// We need to know all the tables before we can analyze any table, since they refer to each other.
export function findTables (fi: FileInfo): Table[] {
  let tn = fi.tree!.topNode
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
    let type = convertDataType(txt(cn.getChild('DataType')))
    if (!type) return diag(cn, `Unsupported data type: ${txt(cn.getChild('DataType'))}`)

    table.fields.push({name, type, metadata: extractLeadingMetadata(cn)})
  })

  // joins, like `join_one orders as order ON order.id = item.order_id`
  // NB that in Malloy, a join contains the entire target table in the join object.
  node.getChildren('JoinDef').forEach(jn => {
    let target = lookupTable(txt(jn.getChild('Identifier')), jn)
    if (!target) return diag(jn, 'Unknown table to join')
    if (!target.analyzed) analyzeTable(target)
    let name = txt(jn.getChild('Alias')) || target.name
    let joinType = {'join_many': 'many', 'join_one': 'one'}[txt(jn.getChild('JoinType'))]
    if (!joinType) return diag(jn, 'Unknown join type')

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
    if (!scope.table) return diag(froms[0], `could not find table "${structRef}"`)
    if (!scope.table.analyzed) analyzeTable(scope.table)
    NODE_ENTITY_MAP.set(froms[0], {entityType: 'table', table: scope.table})
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
  isAgg ||= !!groupBys.length
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
    let field = txt(o.getChild('Identifier')) || Number(txt(o.getChild('Number')))
    let dir = txt(o.getChild('Kw')).toLowerCase() == 'desc' ? 'desc' : 'asc' as 'asc' | 'desc'
    return {field, dir}
  })

  // LIMIT / OFFSET
  let limts = queryNode.getChild('LimitClause')?.getChildren('Number') || []
  let queryLimit = limts[0] ? Number(txt(limts[0])) : undefined
  let queryOffset = limts[1] ? Number(txt(limts[1])) : undefined
  if (queryOffset) diag(limts[1], 'OFFSET is not supported yet')

  // Queries without a SELECT are implicitly `select *`
  if (scope.outputFields.length == 0) {
    scope.table.fields.forEach(f => {
      if (isJoin(f) || f.isAgg) return
      scope.outputFields.push({...f, e: {node: 'field', path: [f.name], type: f.type}})
    })
  }

  let q = {
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
  } satisfies Query

  inferParamTypes(q.malloyQuery)
  return q
}

// Called for each expression in a query (recursively for complex expressions) including computed columns.
// This reports errors and warnings for symantic issues, as well as generating the final SQL.
// Scope is used to track the current table we're operating within when analyzing measures.
function analyzeExpression (expr:SyntaxNode, scope:Scope): Expression {
  if (expr.type.isError) {
    diag(expr, 'Invalid expression')
    return {} as Expression
  }

  switch (expr.name) {
    case 'Number': return {node: 'numberLiteral', literal: txt(expr), type: 'number'}
    case 'Boolean': return {node: txt(expr).toLowerCase() == 'true' ? 'true' : 'false', type: 'boolean'}
    case 'Null': return {node: 'null', type: 'string'}
    case 'String': return {node: 'stringLiteral', literal: txt(expr).slice(1, -1), type: 'string'}
    case 'Param': return {node: 'parameter', path: [txt(expr).slice(1)], type: 'string'}
    case 'Ref': {
      // Refs are tokens that usually point to a column name, but can also be keywords in some dialects
      if (dialectKeyword(txt(expr))) {
        return {node: 'genericSQLExpr', kids: {args: []}, type: 'string', src: [txt(expr)]} as any
      }

      let path = expr.getChildren('Identifier').map(i => txt(i))
      let {fields, inOutput} = lookup(expr, scope)
      let type = fields[0]?.type || 'unknown'
      let base = inOutput && fields[0].isAgg ? {node: 'outputField' as const, name: path[0]} : {node: 'field' as const, path}

      // malloy stores additional typeDef info on query fields for certain types (dates, array, records)
      let typeDef: AtomicTypeDef | null = null
      if (type === 'date' || type === 'timestamp') typeDef = {type} as TemporalTypeDef

      return {...base, type, ...(typeDef ? {typeDef} : {}), isAgg: fields[0]?.isAgg}
    }
    case 'ExtractExpression': {
      let e = analyzeExpression(expr.getChild('Expression')!, scope)
      if (!isTemporalType(e.type) || !e.typeDef) return diag(expr, 'Expression must be a date or timestamp', errorExpression)

      let units = txt(expr.getChild('ExtractUnit')!).replace(/^['"]|['"]$/g, '').toLowerCase()
      if (!isExtractUnit(units)) return diag(expr, 'Not a valid unit to extract', errorExpression)

      return {node: 'extract', type: 'number', units, e: e as any, isAgg: false}
    }
    case 'FunctionCall': return analyzeFunctionCall(expr, scope)
    case 'Parenthetical': return analyzeExpression(expr.getChild('Expression')!, scope)
    case 'Count': {
      let countExpr = expr.getChild('Expression')
      if (countExpr) {
        let e = analyzeExpression(countExpr, scope)
        return {node: 'aggregate', function: 'distinct', e, type: 'number', isAgg: true}
      } else {
        return {node: 'aggregate', function: 'count', e: {node: ''}, type: 'number', isAgg: true}
      }
    }
    case 'BinaryExpression': {
      let left = analyzeExpression(expr.firstChild!, scope)
      let right = analyzeExpression(expr.lastChild!, scope)
      let op = txt(expr.firstChild?.nextSibling).toLowerCase()
      return {node: op as any, kids: {left, right}, type: left.type, isAgg: left.isAgg || right.isAgg}
    }
    case 'NullTestExpression': {
      let node = expr.getChildren('Kw').find(n => txt(n).toLowerCase() == 'not') ? 'is-not-null' : 'is-null'
      let e = analyzeExpression(expr.firstChild!, scope)
      return {node: node as 'is-not-null' | 'is-null', type: 'boolean', isAgg: e.isAgg, e}
    }
    case 'UnaryExpression': {
      let opTxt = txt(expr.firstChild).toLowerCase()
      let child = analyzeExpression(expr.lastChild!, scope)
      if (opTxt === 'not') return {node: 'not', e: child, type: 'boolean', isAgg: child.isAgg}
      if (opTxt === '-') return {node: 'unary-', e: child, type: child.type, isAgg: child.isAgg}
      if (opTxt === '+') return {node: '()', e: child, type: child.type, isAgg: child.isAgg}
      return diag(expr, `Unknown unary operator: ${opTxt}`, {} as Expression)
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
      return diag(expr, `Unsupported expression "${expr.name}": ${txt(expr)}`, {} as Expression)
  }
}

function analyzeFunctionCall (expr: SyntaxNode, scope: Scope): Expression {
  let name = txt(expr.getChild('Identifier')).toLowerCase() as AggregateFunctionType
  let args = expr.getChildren('Expression').map(e => analyzeExpression(e, scope))
  let ret: Expression

  // get the right overload for the args. Also check out malloy's `findOverload` for picking the right one
  let overload = findOverloads(name, config.dialect).find(o => {
    return o.params.length == args.length || !!o.params.find(p => p.isVariadic)
  })

  let type = overload?.returnType.type
  if (type == 'generic') type = args[0]?.type as any || 'string'
  if (type && !isSupportedType(type)) {
    return diag(expr, `Unsupported function return type ${type} from function ${name}`, errorExpression)
  }

  // Aggregates need a `structPath`, which in malloy is the `orders.users` in `orders.users.avg(age)`.
  // We'd rather you write `avg(orders.users.age)`, so we need to extract that path from the arguments.
  // These paths can be buried in complex expressions, so go find all of them.
  let structPaths = new Set<string>()
  args.forEach(a => walkExpression(a, e => {
    if (e.node != 'field') return
    structPaths.add(e.path.slice(0, -1).join('.') || scope.table.name)
  }))

  if (['count', 'min', 'max', 'avg', 'sum'].includes(name.toLowerCase())) {
    // malloy has a special node type for built-in aggregates
    ret = {node: 'aggregate', function: name, e: args[0], type: 'number', isAgg: true}
  } else if (overload && type) {
    // if we have an overload, it's a function call
    ret = {
      node: 'function_call', type, name, overload,
      expressionType: overload.returnType.expressionType || 'scalar',
      kids: {args: args as any},
      isAgg: overload.returnType.expressionType == 'aggregate' || args.some(a => a.isAgg),
    }
  } else {
    return diag(expr, `Unknown function: ${name}`, errorExpression)
  }

  // Right now, we only support a single structPath in aggregate functions
  if (structPaths.size > 1 && (ret.node == 'aggregate' || ret.expressionType == 'aggregate')) {
    return diag(expr, 'Graphene only supports a single table within aggregates. This one has: ' + Array.from(structPaths).join(', '), errorExpression)
  }

  // Malloy is unhappy if structPath is undefined or empty, so only set it if we have one. Malloy also doesn't consider the base table as a structPath.
  let foriegnPaths = Array.from(structPaths).filter(p => p != scope.table.name)
  if (foriegnPaths.length > 0) ret.structPath = foriegnPaths[0].split('.')

  return ret
}

function isSupportedType (value: string): value is FieldType {
  let supported = ['string', 'number', 'boolean', 'date', 'timestamp', 'json', 'sql native', 'error', 'array', 'record', 'null', 'generic']
  return supported.includes(value)
}

// Get the field that a Ref refers to.
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

    if (name == curr.table.name) continue // expression (unnecessarily) refers to the current table
    if (!next)         return diag(part, `Join ${name} does not exist on table ${curr.table.name}`, def)
    if (!isJoin(next)) return diag(part, `${name} is not a join on ${curr.table.name}`, def)

    curr = {table: lookupTable(next.tableName || '', part)!, outputFields: []}
    if (!curr.table) return diag(part, 'Following valid join but we couldnt find the table', def)
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

// Logs that we found an issue in the parse tree. The optional return lets return IR and try to continue the analysis.
// The alternative is we throw an error, but then we wouldn't see other errors later in the tree.
function diag<T> (node: SyntaxNode | SyntaxNodeRef, message: string, defaultReturn?: T): T {
  let file = getFile(node)
  let from = getPosition(node.from, file)
  let to = getPosition(node.to, file)
  diagnostics.push({from, to, message, severity: 'error', file: file.path})
  return defaultReturn!
}

export function recordSyntaxErrors (fi: FileInfo) {
  fi.tree!.topNode.cursor().iterate(n => {
    if (n.type.isError) diag(n.node, 'Syntax error')
  })
}

// turn `a and b and c` into `[a, b, c]`
function unpackAnds (expr: Expression): Expression[] {
  if (expr.node == 'and') {
    return [expr.kids.left as Expression, expr.kids.right as Expression].flatMap(unpackAnds)
  }
  return [expr]
}

function isJoin (field: Field): field is Join {
  // I think the types here are a bit wrong. Join says it can only point
  return field.type == 'table' || (field as any).type == 'query_source'
}

function convertDataType (dataType: string): FieldType | null {
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
    default: return null
  }
}
