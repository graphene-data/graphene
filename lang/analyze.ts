import {NodeWeakMap, type SyntaxNode, type SyntaxNodeRef} from '@lezer/common'
import type {Table, Query, Join, Expression, Field, ColumnField, FieldType, Scope, FileInfo, Diagnostic} from './types.ts'
import {isExtractUnit, isTemporalType, type StructRef, type AtomicTypeDef, type TimestampUnit} from '@graphenedata/malloy'
import {txt, compact, getFile, getPosition} from './util.ts'
import {extractLeadingMetadata} from './metadata.ts'
import {config} from './config.ts'
import {analyzeFunctionCall} from './functions.ts'
import {inferParamTypes} from './params.ts'
import {parseTemporalLiteral, parseIntervalLiteral, parseTemporal} from './temporalLiterals.ts'

export let FILE_MAP: Record<string, FileInfo> = {}
export let diagnostics: Diagnostic[] = []

// Because table objects are sent to Malloy, I want to avoid putting large objects on it that Malloy isn't expecting.
let TABLE_NODE_MAP = new WeakMap<Table, SyntaxNode>()
let FIELD_NODE_MAP = new WeakMap<Field, SyntaxNode>()
let NODE_ENTITY_MAP = new NodeWeakMap<any>()

// Creates tables without analyzing them.
// We need to know all the tables before we can analyze any table, since they refer to each other.
export function findTables (fi: FileInfo) {
  let tn = fi.tree!.topNode
  fi.tables = []
  let nodes = tn.getChildren('TableStatement').concat(tn.getChildren('ViewStatement'))
  for (let syntaxNode of nodes) {
    let name = txt(syntaxNode.getChild('Ref'))

    if (Object.values(FILE_MAP).find(f => f.tables.find(t => t.name == name))) {
      diag(syntaxNode.getChild('Ref')!, `Table "${name}" is already defined`)
    }

    let table = makeTable(name, syntaxNode.getChild('QueryStatement') ? 'query_source' : 'table')
    table.metadata = extractLeadingMetadata(syntaxNode)

    syntaxNode.getChildren('ColumnDef').forEach(cn => addColumnField(table, cn))
    syntaxNode.getChildren('JoinDef').forEach(jn => addJoinField(table, jn))
    syntaxNode.getChildren('ComputedDef').forEach(cn => addComputedField(table, cn))

    TABLE_NODE_MAP.set(table, syntaxNode)
    fi.tables.push(table)
  }
}

function makeTable (name: string, type: 'query_source' | 'table'): Table {
  let tablePath = config.namespace ? `${config.namespace}.${name}` : name
  return {name, type, fields: [], connection: config.dialect, dialect: config.dialect, tableName: name, tablePath, metadata: {}}
}

function addColumnField (table: Table, node: SyntaxNode) {
  let name = txt(node.getChild('Identifier'))

  if (node.getChild('PrimaryKey')) {
    if (table.primaryKey) diag(node, `Table ${table.name} has multiple primary keys`)
    table.primaryKey = name
  }
  let type = convertDataType(txt(node.getChild('DataType')))!
  if (!type) return diag(node, `Unsupported data type: ${txt(node.getChild('DataType'))}`)
  addFieldToTable(table, {name, type, metadata: extractLeadingMetadata(node)}, node)
}

function addJoinField (table: Table, node: SyntaxNode) {
  // If no explicit alias, default to the last part of the Ref (table name without namespace)
  let nameNode = node.getChild('Alias') || node.getChild('Ref')!.getChildren('Identifier').pop()
  return addFieldToTable(table, {name: txt(nameNode)}, node)
}

function addComputedField (table: Table, node: SyntaxNode) {
  let name = txt(node.getChild('Alias'))
  addFieldToTable(table, {name, metadata: extractLeadingMetadata(node)}, node)
}

function addFieldToTable (table: Table, field: Field, node: SyntaxNode) {
  if (table.fields.find(f => f.name == field.name)) {
    return diag(node, `Table already has a field called "${field.name}"`)
  }
  table.fields.push(field)
  FIELD_NODE_MAP.set(field, node)
}

// `extend` blocks can add columns and joins to existing tables (usually views)
export function applyExtends (fi: FileInfo) {
  fi.tree!.topNode.getChildren('ExtendStatement').forEach(node => {
    let tableName = txt(node.getChild('Ref'))
    let target = lookupTable(tableName, node)
    if (!target) {
      return diag(node.getChild('Ref') || node, `Cannot extend unknown table "${tableName}"`)
    }

    node.getChildren('JoinDef').forEach(jn => addJoinField(target, jn))
    node.getChildren('ComputedDef').forEach(cn => addComputedField(target, cn))
  })
}

export function analyzeTable (table: Table) {
  if (table.type == 'query_source') {
    if (table.query) return // already analyzed
    let node = TABLE_NODE_MAP.get(table)!
    let query = analyzeQuery(node.getChild('QueryStatement')!)
    if (!query) return

    let queryFields = query.fields.map(f => ({type: f.type as FieldType, name: f.name, metadata: f.metadata}))
    table.fields.push(...queryFields)
    table.query = query
  }

  table.fields.map(f => analyzeField(f, table))
}

let analysisQueue = new Set<Field>()
export function analyzeField (field: Field, table: Table) {
  if (field.type) return // already analyzed

  let node = FIELD_NODE_MAP.get(field)!
  if (analysisQueue.has(field)) {
    diag(node, 'Cycles are not allowed between computed columns')
  }
  analysisQueue.add(field)

  if (node.name == 'JoinDef') {
    field = field as Join
    let target = lookupTable(txt(node.getChild('Ref')), node)
    if (!target) return diag(node, 'Unknown table to join')

    // query_source tables are all-or-nothing, so when we encounter them as a join we need to analyze them
    if (target.type == 'query_source') analyzeTable(target)

    let joinTypeStr = txt(node.getChild('JoinType')).replace(/\s+/g, ' ')
    let jt = {'join many': 'many', 'join one': 'one'}[joinTypeStr]
    if (!jt) return diag(node, 'Unknown join type')

    // Malloy expects join fields to have not just join info, but the entire contents of the thing they're joining (the `target` table)
    // This is wild, and maybe it'd be better to do this closer to when we create the Malloy QueryModel.
    Object.assign(field, target, {name: field.name, join: jt})

    // It's important we analyze this expression _after_ setting the join, since the expression might refer to it (ie join one user on user.id = user_id)
    field.onExpression = analyzeExpression(node.getChild('BinaryExpression')!, {table, outputFields: []})
  }

  if (node.name == 'ComputedDef') {
    let e = analyzeExpression(node.getChild('Expression')!, {table, outputFields: []})
    let metadata = extractLeadingMetadata(node)
    Object.assign(field, {e, metadata, type: e.type, isAgg: e.isAgg})
  }

  analysisQueue.delete(field)
}

// Walks each part of the query checking types, rendering sql
// NB that this creates a scope for the query, and function like analyzeExpression and lookup operate within that scope, which is crucial for subquery support.
export function analyzeQuery (queryNode: SyntaxNode): Query | void {
  let baseTableName: string
  let scope: Scope = {table: null as any, outputFields: []}
  let isAgg = false

  if (!txt(queryNode)) return // lezer sometimes parses an empty string as a query, if the file doesn't have one.

  // agents sometimes use this query to test that a connection works. Hack it to work for now.
  if (txt(queryNode).trim().toLowerCase() == 'select 1') {
    let fields: ColumnField[] = [{name: 'col_0', type: 'number', metadata: {}, e: {node: 'numberLiteral', literal: '1', type: 'number'} as any}]
    return {fields, baseTableName: '', rawSql: 'select 1', structRef: {} as StructRef, pipeline: []}
  }

  // FROM
  // For now, we only support queries with exactly one table in the FROM clause.
  let froms = queryNode.getChild('FromClause')?.getChildren('TablePrimary') || []
  if (froms.find(f => f.name == 'JoinClause')) diag(froms[0], 'Query joins not yet supported')
  if (froms.length == 0) return diag(queryNode, 'No tables in FROM clause')
  if (froms.length > 1) diag(froms[0], 'Multiple tables/joins in FROM clause not yet supported')

  // First, figure out the base table we're querying from.
  if (froms[0].name == 'Subquery') {
    // Malloy doesn't support subqueries in FROM. We could either add the subquery to the pipeline, or create a "query_source" table for it.
    // I'm opting for query_source, because it's easier to reason about how multiple subqueries might work.
    // For now I've disabled this until I have time to think about how this should properly work.
    // It's possible to have a subquery with a `table foo as (...)`, and that wouldn't have worked with what I wrote here.
    diag(froms[0], "Graphene doesn't yet support subqueries. Try chaining queries instead.")
    baseTableName = txt(froms[0].getChild('Alias')) || 'subquery'
    scope.table = makeTable(baseTableName, 'query_source')
    TABLE_NODE_MAP.set(scope.table, froms[0].getChild('SubqueryExpression')!)
    analyzeTable(scope.table)
  } else { // from a regular table
    baseTableName = txt(froms[0].getChild('Ref'))
    scope.table = lookupTable(baseTableName, froms[0])!
    if (!scope.table) return diag(froms[0], `could not find table "${baseTableName}"`)
    NODE_ENTITY_MAP.set(froms[0], {entityType: 'table', table: scope.table})
  }

  // SELECT
  // Next, get the columns this query will return (including wildcard expansion)
  let selects = queryNode.getChild('SelectClause')?.getChildren('SelectItem') || []
  let isSelectDistinct = queryNode.getChild('SelectClause')?.getChildren('Kw').find(n => txt(n).toLowerCase() == 'distinct')
  isAgg ||= !!isSelectDistinct // select distinct makes the query a reduction
  selects.forEach(s => {
    if (s.getChild('Wildcard')) {
      let path = s.getChild('Wildcard')!.getChildren('Identifier')
      let pathStrings = path.map(p => txt(p))
      let target = followJoins(path, scope.table)
      if (!target) return // followJoins handles diags
      target.fields.forEach(f => {
        analyzeField(f, target)
        if (isJoin(f) || f.isAgg) return
        scope.outputFields.push({...f, e: {node: 'field', path: [...pathStrings, f.name], type: f.type!}})
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
      scope.outputFields.push({...f, e: {node: 'field', path: [f.name], type: f.type!}})
    })
  }

  let q = {
    fields: scope.outputFields,
    baseTableName,
    type: 'query',
    structRef: (null as unknown) as StructRef, // We fill this in as part of `toSql`
    pipeline: [{
      type: isAgg ? 'reduce' : 'project',
      queryFields: scope.outputFields as any,
      filterList: filterList as any,
      outputStruct: null as any,
      isRepeated: false,
      orderBy: orderByList.length ? orderByList : undefined,
      limit: queryLimit,
    }],
  } satisfies Query

  inferParamTypes(q)
  return q
}

// Called for each expression in a query (recursively for complex expressions) including computed columns.
// This reports errors and warnings for symantic issues, as well as generating the final SQL.
// Scope is used to track the current table we're operating within when analyzing measures.
export function analyzeExpression (expr:SyntaxNode, scope:Scope): Expression {
  if (expr.type.isError) {
    return diag(expr, 'Invalid expression', errExpr)
  }

  switch (expr.name) {
    case 'Number': return {node: 'numberLiteral', literal: txt(expr), type: 'number'}
    case 'Boolean': return {node: txt(expr).toLowerCase() == 'true' ? 'true' : 'false', type: 'boolean'}
    case 'Null': return {node: 'null', type: 'string'}
    case 'String': return {node: 'stringLiteral', literal: txt(expr).slice(1, -1), type: 'string'}
    case 'Param': return {node: 'parameter', path: [txt(expr).slice(1)], type: 'string'}
    case 'Ref': {
      let field = lookupField(expr, scope)
      if (!field) return errExpr // diag handled by lookupField

      // fields have types, but Malloy also expects additional `typeDef` for some types (dates, array, records)
      let type = field.type || 'unknown'
      let typeInfo = {type} as {type: FieldType, typeDef?: AtomicTypeDef}
      if (type === 'date' || type === 'timestamp') typeInfo.typeDef = {type}

      // Malloy uses the special 'outputField' when referring to an aggregated column in the output. Non-agg output fields just use `field`.
      if (scope.outputFields.includes(field) && field.isAgg) {
        return {node: 'outputField' as const, name: field.name, ...typeInfo, isAgg: field.isAgg}
      }

      let path = expr.getChildren('Identifier').map(i => txt(i))
      return {node: 'field' as const, path, ...typeInfo, isAgg: field.isAgg}
    }
    case 'ExtractExpression': {
      let extractExprNode = expr.getChild('Expression')!
      let e = analyzeExpression(extractExprNode, scope)
      checkTypes(e, ['date', 'timestamp'], extractExprNode)
      if (!isTemporalType(e.type) || !e.typeDef) return diag(expr, 'Expression must be a date or timestamp', errExpr)

      let units = txt(expr.getChild('ExtractUnit')!).replace(/^['"]|['"]$/g, '').toLowerCase()
      if (!isExtractUnit(units)) return diag(expr, 'Not a valid unit to extract', errExpr)

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
      let type = left.type as FieldType

      if (op == 'or' || op == 'and') type = 'boolean'

      if (op == '+' || op == '-') {
        if (['date', 'timestamp', 'interval'].find(t => left.type == t || right.type == t)) {
          return analyzeTimeExpression(op, left, right, expr)
        }
        ensureSameType(left, expr.firstChild!, right, expr.lastChild!)
      }

      if (op == '*' || op == '/' || op == '%') {
        checkTypes(left, ['number'], expr.firstChild!)
        checkTypes(right, ['number'], expr.lastChild!)
      }

      if (op == '<' || op == '<=' || op == '>' || op == '>=' || op == '=' || op == '!=' || op == '<>') {
        if (op == '<>') op = '!='
        ensureSameType(left, expr.firstChild!, right, expr.lastChild!)
        type = 'boolean'
      }

      if (op == 'like' || op == 'ilike') {
        checkTypes(left, ['string'], expr.firstChild!)
        checkTypes(right, ['string'], expr.lastChild!)
        type = 'boolean'
      }

      return {node: op as any, kids: {left, right}, type, isAgg: left.isAgg || right.isAgg}
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
      return diag(expr, `Unknown unary operator: ${opTxt}`, errExpr)
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
      let not = txt(expr.getChild('Kw')).toLowerCase() == 'not'
      let eNode = analyzeExpression(expr.firstChild!, scope)
      let oneOf: Expression[] = []
      let valueList = expr.getChild('InValueList')
      if (valueList) {
        oneOf = valueList.getChildren('Expression').map(v => {
          let e = analyzeExpression(v, scope)
          checkTypes(e, [eNode.type], v)
          return e
        })
      } else {
        diag(expr, 'IN (<subquery>) is not yet supported')
        oneOf = [{node: 'genericSQLExpr', kids: {args: []}, type: 'array'} as any]
      }
      let isAgg = eNode.isAgg || oneOf.some(v => (v as any).isAgg)
      return {node: 'in', not, kids: {e: eNode as any, oneOf: oneOf as any}, type: 'boolean', isAgg} as any
    }
    case 'SubqueryExpression':
    default:
      return diag(expr, `Unsupported expression "${expr.name}": ${txt(expr)}`, errExpr)
  }
}


// Malloy uses special nodes to represent timediff and time deltas (ie adding interval to a date)
function analyzeTimeExpression (op: '-' | '+', left: Expression, right: Expression, node: SyntaxNode): Expression {
  // only allow dates on the left side, so simplify the logic. Can revisit if people do this a lot.
  if (left.type !== 'date' && left.type !== 'timestamp') return diag(node, 'Expected left side to be a date or timestamp', errExpr)

  let units: TimestampUnit = left.type === 'timestamp' ? 'second' : 'day'
  if (right.node == 'stringLiteral') {
    units = parseTemporal(right) as TimestampUnit
    if (right.node == 'stringLiteral') {
      return diag(node, 'Could not parse interval', errExpr)
    }
  }

  if (right.type == 'date' || right.type == 'timestamp') {
    if (op !== '-') return diag(node, 'Only subtraction between dates is supported', errExpr)
    if (right.type !== left.type) return diag(node, `Expected right side to be a ${left.type}`, errExpr)
    return {node: 'timeDiff', kids: {left: left as any, right: right as any}, units, type: 'interval', isAgg: false}
  }

  if (right.type == 'interval') {
    let typeDef = {type: left.type}
    return {node: 'delta', kids: {base: left as any, delta: right}, op: op as any, units, type: left.type, typeDef, isAgg: false}
  }

  return diag(node, 'Expected right side to be a date or interval', errExpr)
}

function ensureSameType (left: Expression, leftNode: SyntaxNode, right: Expression, rightNode: SyntaxNode): FieldType | undefined {
  if (left.type === 'error' || right.type === 'error') return
  if (left.node === 'parameter' || right.node === 'parameter') return

  // if one side is a date/interval, allow the other to be coerced
  if (isTemporalType(left.type)) checkTypes(right, [left.type as FieldType], rightNode)
  if (isTemporalType(right.type)) checkTypes(left, [right.type as FieldType], leftNode)

  if (left.type !== right.type) diag(rightNode, `Expected ${left.type}, got ${right.type}`)
}

export function checkTypes (expr: Expression, expected: FieldType[], node: SyntaxNode) {
  if (expr.type === 'error') return
  if (expr.node === 'parameter') return
  if (expected.includes(expr.type)) return // types match
  if (expected.includes('generic' as FieldType)) return

  // string literals can be coerced to date/timestamp if needed
  let dt = expected.find(t => t == 'date') || expected.find(t => t == 'timestamp')
  if (expr.node == 'stringLiteral' && dt) {
    let parsed = parseTemporalLiteral(expr.literal, dt)
    if (!parsed) return diag(node, `Could not parse ${dt} literal: "${expr.literal}"`, undefined)
    let typeDef = {type: parsed.type, timeframe: parsed.timeframe}
    Object.assign(expr, {node: 'timeLiteral', literal: parsed?.literal, type: parsed?.type, typeDef})
  }

  else if (expr.node == 'stringLiteral' && expected.includes('interval')) {
    let parsed = parseIntervalLiteral(expr.literal)
    if (!parsed) return diag(node, `Could not parse interval literal: "${expr.literal}"`, undefined)
    return Object.assign(expr, {node: 'numberLiteral', literal: parsed.quantity.toString(), type: 'interval', intervalUnit: parsed.unit})
  }

  else diag(node, `Expected types: ${expected.join(', ')}`)
}

// Get the field that a Ref refers to.
// This could be a column on a table, or the alias of a column in the query. We'll also follow dotted paths to traverse joins.
// The lookup is redundant with Malloy, but doing it means we get type info and metadata on all fields.
function lookupField (expr: SyntaxNode, scope: Scope): ColumnField | null {
  let pathNodes = expr.getChildren('Identifier')
  let fieldNode = pathNodes.pop()
  if (!fieldNode) return diag(expr, 'Missing identifiers in ref', null)
  let fieldName = txt(fieldNode)

  // referring to something already in the output takes precedence
  let outField = scope.outputFields.find(of => of.name == fieldName)
  if (pathNodes.length == 0 && outField) return outField

  let table = followJoins(pathNodes, scope.table)
  if (!table) return null // diagnostics already handled
  let field = table.fields.find(f => f.name == fieldName)
  if (!field) return diag(fieldNode, `Could not find "${fieldName}" on ${table.name}`, null)
  if (isJoin(field)) return diag(fieldNode, `${fieldName} is a join, but is used as a column here`, null)
  analyzeField(field, table)
  NODE_ENTITY_MAP.set(fieldNode, {entityType: 'field', field, table})
  return field
}


// Step through all the parts of the dotted path to get the right table
function followJoins (pathNodes: SyntaxNode[], curr: Table): Table | null {
  for (let part of pathNodes) {
    let name = txt(part)
    let next = curr.fields.find(f => f.name == name)

    if (name == curr.name) continue // expression (unnecessarily) refers to the current table
    if (!next) {
      let other = curr.fields.find(f => isJoin(f) && f.tableName == name)
      let dym = other ? `. Did you mean "${other.name}"?` : ''
      return diag(part, `Join "${name}" does not exist on table "${curr.name}"${dym}`, null)
    }
    analyzeField(next, curr)
    if (!isJoin(next)) return diag(part, `"${name}" is not a join on "${curr.name}"`, null)

    curr = lookupTable(next.tableName || '', part)!
    if (!curr) return diag(part, 'Following valid join but we couldnt find the table', null)
    NODE_ENTITY_MAP.set(part, {entityType: 'table', table: curr})
  }
  return curr
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
  Object.keys(FILE_MAP).forEach(k => delete FILE_MAP[k])
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

let errExpr = {node: 'error', type: 'error'} as Expression

// Logs that we found an issue in the parse tree. The optional return lets return IR and try to continue the analysis.
// The alternative is we throw an error, but then we wouldn't see other errors later in the tree.
export function diag<T> (node: SyntaxNode | SyntaxNodeRef, message: string, defaultReturn?: T): T {
  let file = getFile(node)
  let from = getPosition(node.from, file)
  let to = getPosition(node.to, file)
  diagnostics.push({from, to, message, severity: 'error', file: file.path})
  return defaultReturn as T
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
    case 'NUMBER': return 'number'
    case 'VARIANT': return 'string'
    case 'TEXT': return 'string'
    case 'STRING': return 'string'
    case 'VARCHAR': return 'string'
    case 'INTEGER': return 'number'
    case 'FLOAT': return 'number'
    case 'FLOAT64': return 'number'
    case 'BOOL': return 'boolean'
    case 'BOOLEAN': return 'boolean'
    case 'DATE': return 'date'
    case 'DATETIME': return 'timestamp'
    case 'TIME': return 'timestamp'
    case 'TIMESTAMP': return 'timestamp'
    case 'TIMESTAMP_NTZ': return 'timestamp'
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
