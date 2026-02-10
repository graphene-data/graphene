import {NodeWeakMap, type SyntaxNode, type SyntaxNodeRef} from '@lezer/common'
import {type Table, type Query, type QueryJoin, type Join, type Column, type FieldType, type FileInfo, type Diagnostic, type Expr, type QueryField, type Filter} from './types.ts'
import {txt, getFile, getPosition} from './util.ts'
import {extractLeadingMetadata} from './metadata.ts'
import {config} from './config.ts'
import {analyzeFunction} from './functions.ts'
import {parseTemporalLiteral, parseIntervalLiteral, parseIntervalUnit} from './temporalLiterals.ts'

// Analyze is the heart of gsql processing. It works in 2 phases:
// First, walk the parse tree looking for tables, views, and extend blocks.
// Second, starting from a query, recursively analyze every expression it touches. When a query refers to a join and column,
// we lazily traverse to that table and analyze that column, also analyzing any tables/columns that it refers to.
// It's also possible to do a "full" analysis where we look at every field on every table.
// Analyzing checks that expression are valid, that types are correct, and generates dialect-specific sql.
//
// NB that while the first step of collecting tables can be used between runs, analysis kinda can't since the alias for a given
// join could change from query to query.


export let FILE_MAP: Record<string, FileInfo> = {}
export let diagnostics: Diagnostic[] = []

let NODE_ENTITY_MAP = new NodeWeakMap<any>()

// Mutable query state - shared across all scopes during query analysis
interface QueryState {
  fields: QueryField[]
  joins: Map<string, QueryJoin>
  filters: Filter[]
}

// Context for analyzing expressions - table/alias change as we traverse joins, but query is shared
export interface Scope {
  query: QueryState | null  // null when analyzing table definitions (not in a query context)
  table: Table
  alias: string  // current alias for this table context (e.g., "base", "users", "users_orders")
  // When analyzing a join's ON clause, tells us about the target table/alias.
  // e.g., `join one users on users.id = user_id` - "users.id" resolves to targetTable with targetAlias
  joinTarget?: { name: string, table: Table, alias: string }
}

// Creates tables without analyzing them.
export function findTables (fi: FileInfo) {
  let tn = fi.tree!.topNode
  fi.tables = []
  let nodes = tn.getChildren('TableStatement').concat(tn.getChildren('ViewStatement'))
  for (let syntaxNode of nodes) {
    let name = txt(syntaxNode.getChild('Ref'))

    let existing = Object.values(FILE_MAP).find(f => {
      if (f.path.endsWith('.md') && f.path != fi.path) return
      return f.tables.find(t => t.name == name)
    })
    if (existing) diag(syntaxNode.getChild('Ref')!, `Table "${name}" is already defined`)

    let isView = !!syntaxNode.getChild('QueryStatement')
    let tablePath = config.namespace ? `${config.namespace}.${name}` : name
    let table: Table = {name, type: isView ? 'view' : 'table', tablePath, columns: [], joins: [], metadata: extractLeadingMetadata(syntaxNode), syntaxNode}

    syntaxNode.getChildren('ColumnDef').forEach(cn => addColumn(table, cn))
    syntaxNode.getChildren('JoinDef').forEach(jn => addJoin(table, jn))
    syntaxNode.getChildren('ComputedDef').forEach(cn => addComputedColumn(table, cn))

    fi.tables.push(table)
  }
}

// `extend` blocks add columns and joins to existing tables
export function applyExtends (fi: FileInfo) {
  fi.tree!.topNode.getChildren('ExtendStatement').forEach(node => {
    let tableName = txt(node.getChild('Ref'))
    let target = lookupTable(tableName, node)
    if (!target) return diag(node.getChild('Ref') || node, `Cannot extend unknown table "${tableName}"`)
    node.getChildren('JoinDef').forEach(jn => addJoin(target, jn))
    node.getChildren('ComputedDef').forEach(cn => addComputedColumn(target, cn))
  })
}

function addColumn (table: Table, node: SyntaxNode) {
  let name = txt(node.getChild('ColumnName'))
  let type = convertDataType(txt(node.getChild('DataType')))
  if (!type) return diag(node, `Unsupported data type: ${txt(node.getChild('DataType'))}`)
  let col: Column = {name, type, metadata: extractLeadingMetadata(node)}
  if (getField(name, table)) return diag(node, `Table already has a field called "${name}"`)
  table.columns.push(col)
}

function addJoin (table: Table, node: SyntaxNode) {
  let nameNode = node.getChild('Alias') || node.getChild('Ref')!.getChildren('Identifier').pop()
  let name = txt(nameNode)

  let joinTypeStr = txt(node.getChild('JoinType')).replace(/\s+/g, ' ')
  let joinType = {'join many': 'many', 'join one': 'one'}[joinTypeStr] as 'one' | 'many'
  if (!joinType) return diag(node, 'Unknown join type')

  let targetNode = node.getChild('Ref')!
  let targetTable = txt(targetNode)
  let onExpr = node.getChild('BinaryExpression')!

  let join: Join = {name, targetTable, targetNode, joinType, onExpr}
  if (getField(name, table)) return diag(node, `Table already has a field called "${name}"`)
  table.joins.push(join)
}

function addComputedColumn (table: Table, node: SyntaxNode) {
  let name = txt(node.getChild('Alias'))
  let col: Column = {name, type: 'string', exprNode: node.getChild('Expression')!, metadata: extractLeadingMetadata(node)}
  if (getField(name, table)) return diag(node, `Table already has a field called "${name}"`)
  table.columns.push(col)
}

function getField (name: string, table: Table) {
  return table.columns.find(c => c.name == name) || table.joins.find(j => j.name == name)
}

// Analyze a view's underlying query to determine its output columns
function analyzeView (table: Table) {
  if (table.query) return  // already analyzed
  let query = analyzeQuery(table.syntaxNode!.getChild('QueryStatement')!)
  if (!query) return
  let viewCols = query.fields.map(f => ({name: f.name, type: f.type, metadata: f.metadata}) as Column)
  table.columns.push(...viewCols)
  table.query = query
}

// Analyze everything in a table - used for full project analysis (e.g., `check` command)
export function analyzeTableFully (table: Table) {
  if (table.type == 'view') analyzeView(table)
  let scope: Scope = {query: null, table, alias: 'base'}
  table.columns.forEach(c => {
    if (!c.exprNode) return
    let expr = analyzeExpr(c.exprNode, scope)
    c.isAgg = expr.isAgg
  })
  table.joins.forEach(j => analyzeJoin(j))
}

// Track computed columns being analyzed to detect cycles
let analysisStack = new Set<Column>()

// Expand all non-aggregate columns from a table into query fields
function expandColumns (scope: Scope, queryState: QueryState) {
  for (let col of scope.table.columns) {
    if (col.exprNode) {
      // Determine if aggregate (without query context to avoid side-effect diagnostics), then skip measures
      if (col.isAgg == null) col.isAgg = analyzeExpr(col.exprNode, {query: null, table: scope.table, alias: scope.alias}).isAgg
      if (col.isAgg) continue
      let expr = analyzeExpr(col.exprNode, scope)
      queryState.fields.push({name: col.name, sql: expr.sql, type: expr.type, metadata: col.metadata})
    } else {
      queryState.fields.push({name: col.name, sql: `${scope.alias}.${quote(col.name)}`, type: col.type, metadata: col.metadata})
    }
  }
}

// Validate join target exists and analyze if it's a view
function analyzeJoin (join: Join) {
  let target = lookupTable(join.targetTable, join.targetNode)
  if (!target) return diag(join.targetNode, `Unknown table "${join.targetTable}"`)
  if (target.type == 'view') analyzeView(target)
}

// Main query analysis - analyzes and returns a Query with computed SQL
export function analyzeQuery (queryNode: SyntaxNode): Query | void {
  if (!txt(queryNode)) return

  // FROM clause
  let froms = queryNode.getChild('FromClause')?.getChildren('TablePrimary') || []
  if (froms.find(f => f.name == 'JoinClause')) diag(froms[0], 'Query joins not yet supported')
  if (froms.length > 1) diag(froms[0], 'Multiple tables in FROM clause not yet supported')

  let baseTableName = froms.length ? txt(froms[0].getChild('Ref')) : ''
  let baseTable = baseTableName ? (lookupTable(baseTableName, froms[0]) || null) : null
  if (baseTableName && !baseTable) return diag(froms[0], `Unknown table "${baseTableName}"`)
  if (baseTable?.type == 'view') analyzeView(baseTable)
  if (baseTable) NODE_ENTITY_MAP.set(froms[0], {entityType: 'table', table: baseTable})

  // Shared query state - all scopes during this query analysis share this
  let queryState: QueryState = {fields: [], joins: new Map(), filters: []}
  let scope: Scope = {query: queryState, table: baseTable!, alias: 'base'}
  let isAgg = false

  // SELECT clause
  let selects = queryNode.getChild('SelectClause')?.getChildren('SelectItem') || []
  let isSelectDistinct = !!queryNode.getChild('SelectClause')?.getChildren('Kw').find(n => txt(n).toLowerCase() == 'distinct')
  isAgg ||= isSelectDistinct

  for (let s of selects) {
    if (s.getChild('Wildcard')) {
      let pathNodes = s.getChild('Wildcard')!.getChildren('Identifier')
      let targetScope = followJoins(pathNodes, scope)
      if (!targetScope) continue
      expandColumns(targetScope, queryState)
    } else {
      let expr = analyzeExpr(s.getChild('Expression')!, scope)
      let name = s.getChild('Alias') ? txt(s.getChild('Alias')) : inferName(s.getChild('Expression')!, scope)
      isAgg ||= !!expr.isAgg
      queryState.fields.push({name, sql: expr.sql, type: expr.type, isAgg: expr.isAgg})
    }
  }

  // WHERE / HAVING - we allow aggregate filters in WHERE (moved to HAVING automatically)
  let whereNode = queryNode.getChild('WhereClause')?.getChild('Expression')
  let havingNode = queryNode.getChild('HavingClause')?.getChild('Expression')
  for (let node of [whereNode, havingNode]) {
    if (!node) continue
    for (let expr of unpackAnds(node, scope)) {
      queryState.filters.push({sql: expr.sql, isAgg: expr.isAgg})
    }
  }

  // GROUP BY - adds fields if not already selected
  let groupBys = queryNode.getChild('GroupByClause')?.getChildren('SelectItem') || []
  isAgg ||= groupBys.length > 0
  for (let g of groupBys) {
    let expr = analyzeExpr(g.getChild('Expression')!, scope)
    if (expr.isAgg) { diag(g, 'Cannot group by aggregate expressions'); continue }
    let name = g.getChild('Alias') ? txt(g.getChild('Alias')) : inferName(g.getChild('Expression')!, scope)
    if (!queryState.fields.find(f => f.name == name)) {
      queryState.fields.unshift({name, sql: expr.sql, type: expr.type})
    }
  }

  // ORDER BY
  let orderBys = queryNode.getChild('OrderByClause')?.getChildren('OrderItem') || []
  let orderBy: {idx: number, desc: boolean}[] = []
  for (let o of orderBys) {
    let fieldRef = txt(o.getChild('Identifier')) || txt(o.getChild('Number'))
    let desc = txt(o.getChild('Kw')).toLowerCase() == 'desc'
    let idx = Number(fieldRef) || (queryState.fields.findIndex(f => f.name == fieldRef) + 1)
    if (idx > 0) orderBy.push({idx, desc})
  }

  // LIMIT
  let limitNodes = queryNode.getChild('LimitClause')?.getChildren('Number') || []
  let limit = limitNodes[0] ? Number(txt(limitNodes[0])) : undefined
  if (limitNodes[1]) diag(limitNodes[1], 'OFFSET is not supported yet')

  // Implicit `select *` if nothing selected (only when we have a base table)
  if (queryState.fields.length == 0 && baseTable) expandColumns(scope, queryState)

  // Compute GROUP BY indices (non-aggregate fields, 1-indexed)
  let groupByIndices = queryState.fields.map((f, i) => f.isAgg ? 0 : i + 1).filter(i => i > 0)

  // Default ORDER BY for aggregate queries
  if (orderBy.length == 0 && isAgg && groupByIndices.length > 0) {
    let firstAggIdx = queryState.fields.findIndex(f => f.isAgg)
    if (firstAggIdx >= 0) {
      orderBy.push({idx: firstAggIdx + 1, desc: true})
    } else {
      orderBy.push({idx: 1, desc: false})  // SELECT DISTINCT
    }
  }

  // Check for chasm trap: aggregates touching multiple distinct join_many paths
  let joins = Array.from(queryState.joins.values())
  let groupBy = isAgg ? groupByIndices : []
  let sql = buildSql(baseTable, queryState.fields, joins, queryState.filters, groupBy, orderBy, limit)

  return {sql, baseTable: baseTableName, fields: queryState.fields, joins, filters: queryState.filters, groupBy, orderBy, limit, isAggregate: isAgg}
}

// Assemble query parts into final SQL
// Format a table path for the current dialect
function formatTablePath (path: string): string {
  if (config.dialect === 'bigquery') return `\`${path}\``
  if (config.dialect === 'snowflake') return path.toUpperCase()
  return path
}

function buildSql (baseTable: Table | null, fields: QueryField[], joins: QueryJoin[], filters: Filter[], groupBy: number[], orderBy: {idx: number, desc: boolean}[], limit?: number): string {
  let ctes: string[] = []
  let selectParts = fields.map(f => `${f.sql} as ${quote(f.name)}`)

  // No FROM clause (e.g. `select 1`)
  if (!baseTable) return `SELECT ${selectParts.join(', ')}`

  // FROM - handle views as CTEs
  let fromTable: string
  if (baseTable.type === 'view' && baseTable.query) {
    ctes.push(`${quote(baseTable.name)} as ( ${baseTable.query.sql} )`)
    fromTable = quote(baseTable.name)
  } else {
    fromTable = formatTablePath(baseTable.tablePath)
  }

  // JOINs
  let joinClauses = joins.map(j => {
    let joinTable = lookupTableByName(j.targetTable)
    let tablePath: string
    if (joinTable?.type === 'view') {
      tablePath = quote(joinTable.name)
    } else {
      let path = joinTable?.tablePath || j.targetTable
      tablePath = formatTablePath(path)
    }
    return `LEFT JOIN ${tablePath} as ${j.alias} ON ${j.onClause}`
  })

  // WHERE / HAVING
  let whereFilters = filters.filter(f => !f.isAgg).map(f => f.sql)
  let havingFilters = filters.filter(f => f.isAgg).map(f => f.sql)

  // Assemble
  let sql = `SELECT ${selectParts.join(', ')} FROM ${fromTable} as base`
  if (joinClauses.length) sql += ' ' + joinClauses.join(' ')
  if (whereFilters.length) sql += ` WHERE ${whereFilters.join(' AND ')}`
  if (groupBy.length) sql += ` GROUP BY ${groupBy.join(',')}`
  if (havingFilters.length) sql += ` HAVING ${havingFilters.join(' AND ')}`
  if (orderBy.length) {
    let parts = orderBy.map(o => `${o.idx} ${o.desc ? 'desc' : 'asc'} NULLS LAST`)
    sql += ` ORDER BY ${parts.join(',')}`
  }
  if (limit) sql += ` LIMIT ${limit}`
  if (ctes.length) sql = `WITH ${ctes.join(', ')} ${sql}`

  return sql
}

// Simple table lookup by name (without needing a node for diagnostics)
function lookupTableByName (name: string): Table | undefined {
  for (let file of Object.values(FILE_MAP)) {
    let match = file.tables.find(t => t.name == name)
    if (match) return match
  }
}

// Analyze an expression node and return SQL + type info
export function analyzeExpr (node: SyntaxNode, scope: Scope): Expr {
  if (node.type.isError) return diag(node, 'Invalid expression', {sql: 'NULL', type: 'error'})

  switch (node.name) {
    case 'Number': return {sql: txt(node), type: 'number'}
    case 'Boolean': return {sql: txt(node).toLowerCase(), type: 'boolean'}
    case 'Null': return {sql: 'NULL', type: 'null'}
    case 'String': return {sql: `'${txt(node).slice(1, -1).replace(/'/g, "''")}'`, type: 'string'}
    case 'Param': return {sql: txt(node), type: 'string'}  // $param - type inferred later

    case 'Ref': {
      let pathNodes = node.getChildren('Identifier')
      let fieldNode = pathNodes.pop()!
      let fieldName = txt(fieldNode)

      // Check output fields first (for referencing aliases in HAVING)
      if (scope.query && pathNodes.length == 0) {
        let outField = scope.query.fields.find(f => f.name == fieldName)
        if (outField) {
          return {sql: outField.isAgg ? quote(fieldName) : outField.sql, type: outField.type, isAgg: outField.isAgg}
        }
      }

      // Follow join path - returns a new scope with the target table/alias
      let targetScope = followJoins(pathNodes, scope)
      if (!targetScope) return {sql: 'NULL', type: 'error'}

      let col = targetScope.table.columns.find(c => c.name == fieldName)
      let join = targetScope.table.joins.find(j => j.name == fieldName)

      if (join) return diag(fieldNode, `"${fieldName}" is a join, not a column`, {sql: 'NULL', type: 'error'})
      if (!col) return diag(fieldNode, `Unknown field "${fieldName}" on ${targetScope.table.name}`, {sql: 'NULL', type: 'error'})

      NODE_ENTITY_MAP.set(fieldNode, {entityType: 'field', field: col, table: targetScope.table})

      // Computed column - analyze its expression in the target scope (with correct alias)
      if (col.exprNode) {
        if (analysisStack.has(col)) return diag(col.exprNode, 'Cycles are not allowed between computed columns', {sql: 'NULL', type: 'error'})
        analysisStack.add(col)
        let expr = analyzeExpr(col.exprNode, targetScope)
        analysisStack.delete(col)
        return {sql: `(${expr.sql})`, type: expr.type, isAgg: expr.isAgg}
      }

      return {sql: `${targetScope.alias}.${quote(fieldName)}`, type: col.type}
    }

    case 'FunctionCall':
      return analyzeFunction(node, scope, analyzeExpr)

    case 'Parenthetical':
      return analyzeExpr(node.getChild('Expression')!, scope)

    case 'Count': {
      let inner = node.getChild('Expression')
      if (inner) {
        let e = analyzeExpr(inner, scope)
        return {sql: `count(distinct ${e.sql})`, type: 'number', isAgg: true}
      }
      return {sql: 'count(1)', type: 'number', isAgg: true}
    }

    case 'BinaryExpression': {
      let left = analyzeExpr(node.firstChild!, scope)
      let right = analyzeExpr(node.lastChild!, scope)
      let op = txt(node.firstChild?.nextSibling).toLowerCase()

      // Type coercion for dates
      if ((left.type == 'date' || left.type == 'timestamp') && right.type == 'string') {
        right = coerceToTemporal(right, left.type, node.lastChild!)
      }
      if ((right.type == 'date' || right.type == 'timestamp') && left.type == 'string') {
        left = coerceToTemporal(left, right.type, node.firstChild!)
      }

      // Date arithmetic
      if (op == '+' || op == '-') {
        if (left.type == 'date' || left.type == 'timestamp' || left.type == 'interval' || right.type == 'interval') {
          return analyzeDateArithmetic(op, left, right, node)
        }
      }

      // Type checking for operators
      if (op == '*' || op == '/' || op == '%') {
        checkTypes(left, ['number'], node.firstChild!)
        checkTypes(right, ['number'], node.lastChild!)
      }
      if (op == 'like' || op == 'ilike') {
        checkTypes(left, ['string'], node.firstChild!)
        checkTypes(right, ['string'], node.lastChild!)
      }

      let resultType = left.type
      if (['and', 'or', '<', '<=', '>', '>=', '=', '!=', '<>', 'like', 'ilike'].includes(op)) resultType = 'boolean'
      if (op == '<>') op = '!='

      // ILIKE handling for BigQuery
      let sql: string
      if (op == 'ilike' && config.dialect == 'bigquery') {
        sql = `LOWER(${left.sql}) LIKE LOWER(${right.sql})`
      } else if (op == 'and' || op == 'or') {
        sql = `(${left.sql} ${op.toUpperCase()} ${right.sql})`
      } else if (op == 'like' || op == 'ilike') {
        sql = `${left.sql} ${op.toUpperCase()} ${right.sql}`
      } else {
        sql = `${left.sql}${op}${right.sql}`
      }

      return {sql, type: resultType, isAgg: left.isAgg || right.isAgg}
    }

    case 'UnaryExpression': {
      let op = txt(node.firstChild).toLowerCase()
      let child = analyzeExpr(node.lastChild!, scope)
      if (op == 'not') return {sql: `NOT (${child.sql})`, type: 'boolean', isAgg: child.isAgg}
      if (op == '-') return {sql: `-(${child.sql})`, type: child.type, isAgg: child.isAgg}
      if (op == '+') return {sql: `(${child.sql})`, type: child.type, isAgg: child.isAgg}
      return diag(node, `Unknown unary operator: ${op}`, {sql: 'NULL', type: 'error'})
    }

    case 'NullTestExpression': {
      let isNot = !!node.getChildren('Kw').find(n => txt(n).toLowerCase() == 'not')
      let e = analyzeExpr(node.firstChild!, scope)
      return {sql: `${e.sql} IS ${isNot ? 'NOT ' : ''}NULL`, type: 'boolean', isAgg: e.isAgg}
    }

    case 'CaseExpression': {
      let parts = ['CASE']
      let isAgg = false
      let caseValue = node.getChild('Expression')
      if (caseValue) { let e = analyzeExpr(caseValue, scope); parts.push(e.sql); isAgg ||= !!e.isAgg }

      let resultType: FieldType = 'string'
      for (let w of node.getChildren('WhenClause')) {
        let exprs = w.getChildren('Expression')
        let when = analyzeExpr(exprs[0], scope)
        let then = analyzeExpr(exprs[1], scope)
        resultType = then.type
        isAgg ||= !!when.isAgg || !!then.isAgg
        parts.push(`WHEN (${when.sql}) THEN ${then.sql}`)
      }

      let elseClause = node.getChild('ElseClause')
      if (elseClause) {
        let elseExpr = analyzeExpr(elseClause.getChild('Expression')!, scope)
        parts.push(`ELSE ${elseExpr.sql}`)
        isAgg ||= !!elseExpr.isAgg
      }
      parts.push('END')
      return {sql: parts.join(' '), type: resultType, isAgg: isAgg || undefined}
    }

    case 'InExpression': {
      let not = txt(node.getChild('Kw')).toLowerCase() == 'not'
      let e = analyzeExpr(node.firstChild!, scope)
      let valueList = node.getChild('InValueList')
      if (!valueList) {
        diag(node, 'IN (<subquery>) is not yet supported')
        return {sql: 'false', type: 'boolean'}
      }
      let values = valueList.getChildren('Expression').map(v => {
        let val = analyzeExpr(v, scope)
        // Coerce string literals to temporal types if needed
        if ((e.type == 'date' || e.type == 'timestamp') && val.type == 'string') {
          val = coerceToTemporal(val, e.type, v)
        }
        return val.sql
      })
      return {sql: `${e.sql} ${not ? 'NOT IN' : 'IN'} (${values.join(',')})`, type: 'boolean', isAgg: e.isAgg}
    }

    case 'CastExpression':
    case 'TypeCastExpression': {
      let inner = node.getChild('Expression') || node.firstChild!
      let e = analyzeExpr(inner, scope)
      let typeNode = node.getChild('CastType')!
      let targetType = txt(typeNode).toUpperCase()
      let resultType = convertDataType(targetType)
      if (!resultType) return diag(typeNode, `Unsupported cast type: ${targetType.toLowerCase()}`, {sql: 'NULL', type: 'error'})
      return {sql: `CAST(${e.sql} AS ${targetType})`, type: resultType, isAgg: e.isAgg}
    }

    case 'ExtractExpression': {
      let extractInner = node.getChild('Expression')!
      let e = analyzeExpr(extractInner, scope)
      checkTypes(e, ['date', 'timestamp'], extractInner)
      let unit = txt(node.getChild('ExtractUnit')!).replace(/^['"]|['"]$/g, '').toLowerCase()
      return {sql: `EXTRACT(${unit} FROM ${e.sql})`, type: 'number', isAgg: e.isAgg}
    }

    case 'IntervalExpression': {
      let stringNode = node.getChild('String')
      if (stringNode) {
        let parsed = parseIntervalLiteral(txt(stringNode).slice(1, -1))
        if (!parsed) return diag(stringNode, 'Could not parse interval', {sql: 'NULL', type: 'error'})
        return {sql: `INTERVAL ${parsed.quantity} ${parsed.unit}`, type: 'interval'}
      }
      let num = txt(node.getChild('Number')!)
      let unit = parseIntervalUnit(txt(node.getChild('IntervalUnit')!).toLowerCase())
      if (!unit) return diag(node, 'Invalid interval unit', {sql: 'NULL', type: 'error'})
      return {sql: `INTERVAL ${num} ${unit}`, type: 'interval'}
    }

    case 'DateExpression':
    case 'TimestampExpression': {
      let isDate = node.name == 'DateExpression'
      let lit = txt(node.getChild('String')!).slice(1, -1)
      let parsed = parseTemporalLiteral(lit, isDate ? 'date' : 'timestamp')
      if (!parsed) return diag(node, `Invalid ${isDate ? 'date' : 'timestamp'}`, {sql: 'NULL', type: 'error'})
      return {sql: `${isDate ? 'DATE' : 'TIMESTAMP'} '${parsed.literal}'`, type: isDate ? 'date' : 'timestamp'}
    }

    default:
      return diag(node, `Unsupported expression: ${node.name}`, {sql: 'NULL', type: 'error'})
  }
}

function analyzeDateArithmetic (op: '+' | '-', left: Expr, right: Expr, node: SyntaxNode): Expr {
  // date - date = interval
  if ((left.type == 'date' || left.type == 'timestamp') && (right.type == 'date' || right.type == 'timestamp')) {
    if (op != '-') return diag(node, 'Can only subtract dates', {sql: 'NULL', type: 'error'})
    let unit = left.type == 'timestamp' ? 'SECOND' : 'DAY'
    if (config.dialect == 'bigquery') {
      return {sql: `TIMESTAMP_DIFF(${left.sql}, ${right.sql}, ${unit})`, type: 'number'}
    }
    if (config.dialect == 'snowflake') {
      return {sql: `TIMESTAMPDIFF(${unit}, ${right.sql}, ${left.sql})`, type: 'number'}
    }
    return {sql: `DATE_DIFF('${unit.toLowerCase()}', ${right.sql}, ${left.sql})`, type: 'number'}
  }

  // date +/- interval
  if ((left.type == 'date' || left.type == 'timestamp') && right.type == 'interval') {
    return {sql: `${left.sql} ${op} ${right.sql}`, type: left.type}
  }

  // interval + date (normalize to date + interval)
  if (left.type == 'interval' && (right.type == 'date' || right.type == 'timestamp')) {
    if (op == '-') return diag(node, 'Cannot subtract date from interval', {sql: 'NULL', type: 'error'})
    return {sql: `${right.sql} + ${left.sql}`, type: right.type}
  }

  return diag(node, 'Invalid date arithmetic', {sql: 'NULL', type: 'error'})
}

function coerceToTemporal (expr: Expr, targetType: 'date' | 'timestamp', node: SyntaxNode): Expr {
  // Extract the string literal value (remove quotes)
  let match = expr.sql.match(/^'(.+)'$/)
  if (!match) return expr
  let parsed = parseTemporalLiteral(match[1], targetType)
  if (!parsed) { diag(node, `Cannot parse as ${targetType}: ${expr.sql}`); return expr }
  return {sql: `${targetType.toUpperCase()} '${parsed.literal}'`, type: targetType}
}

// Traverse a join path, returning a new scope pointing to the target table.
// Adds joins to query state as we traverse.
function followJoins (pathNodes: SyntaxNode[], scope: Scope): Scope | null {
  let current = scope

  for (let part of pathNodes) {
    let name = txt(part)
    if (name == current.table.name) continue  // self-reference, skip

    // Check joinTarget first (for ON clause analysis), then regular joins
    let targetTable: Table | undefined
    let newAlias: string
    if (current.joinTarget && (name == current.joinTarget.name || name == current.joinTarget.table.name)) {
      targetTable = current.joinTarget.table
      newAlias = current.joinTarget.alias
    } else {
      let join = current.table.joins.find(j => j.name == name)
      let col = current.table.columns.find(c => c.name == name)

      if (col) return diag(part, `"${name}" is not a join`, null)
      if (!join) return diag(part, `Unknown join "${name}" on ${current.table.name}`, null)

      analyzeJoin(join)

      targetTable = lookupTable(join.targetTable, part)
      if (!targetTable) return diag(part, `Cannot find table "${join.targetTable}"`, null)

      // Build alias: base.users -> "users", base.users.orders -> "users_orders"
      newAlias = current.alias == 'base' ? name : `${current.alias}_${name}`

      // Add join to query state - analyze ON clause with correct aliases
      if (scope.query && !scope.query.joins.has(newAlias)) {
        let joinTarget = {name: join.name, table: targetTable, alias: newAlias}
        let onScope: Scope = {query: null, table: current.table, alias: current.alias, joinTarget}
        let onClause = analyzeExpr(join.onExpr, onScope).sql
        scope.query.joins.set(newAlias, {alias: newAlias, targetTable: join.targetTable, onClause})
      }
    }

    NODE_ENTITY_MAP.set(part, {entityType: 'table', table: targetTable})
    current = {query: scope.query, table: targetTable, alias: newAlias}
  }
  return current
}

function lookupTable (name: string, node: SyntaxNode): Table | undefined {
  let currentUri = getFile(node).path
  for (let file of Object.values(FILE_MAP)) {
    if (file.path.endsWith('.gsql') || file.path == currentUri) {
      let match = file.tables.find(t => t.name == name)
      if (match) return match
    }
  }
}

function inferName (exprNode: SyntaxNode, scope: Scope): string {
  if (exprNode.name == 'Ref') {
    return exprNode.getChildren('Identifier').map(i => txt(i)).join('_')
  }
  return `col_${scope.query?.fields.length || 0}`
}

function unpackAnds (node: SyntaxNode, scope: Scope): Expr[] {
  if (node.name == 'BinaryExpression') {
    let op = txt(node.firstChild?.nextSibling).toLowerCase()
    if (op == 'and') {
      return [...unpackAnds(node.firstChild!, scope), ...unpackAnds(node.lastChild!, scope)]
    }
  }
  return [analyzeExpr(node, scope)]
}

export function clearWorkspace () {
  Object.keys(FILE_MAP).forEach(k => delete FILE_MAP[k])
  diagnostics = []
}

export function clearDiagnostics () { diagnostics = [] }
export function getNodeEntity (node: SyntaxNode) { return NODE_ENTITY_MAP.get(node) }

export function recordSyntaxErrors (fi: FileInfo) {
  fi.tree!.topNode.cursor().iterate(n => {
    if (n.type.isError) diag(n.node, 'Syntax error')
  })
}

export function diag<T> (node: SyntaxNode | SyntaxNodeRef, message: string, defaultReturn?: T): T {
  let file = getFile(node)
  let from = getPosition(node.from, file)
  let to = getPosition(node.to, file)
  diagnostics.push({from, to, message, severity: 'error', file: file.path})
  return defaultReturn as T
}

export function checkTypes (expr: Expr, expected: FieldType[], node: SyntaxNode) {
  if (expr.type == 'error' || expr.type == 'null') return
  if (expected.includes(expr.type)) return
  diag(node, `Expected ${expected.join(' or ')}, got ${expr.type}`)
}

function convertDataType (dataType: string): FieldType | null {
  switch (dataType.toUpperCase()) {
    case 'INT': case 'INT64': case 'NUMBER': case 'INTEGER': case 'NUMERIC': case 'FLOAT': case 'FLOAT64':
    case 'DECIMAL': case 'DOUBLE': case 'BIGINT': case 'SMALLINT': case 'TINYINT': case 'BYTEINT': case 'BIGDECIMAL':
      return 'number'
    case 'VARIANT': case 'TEXT': case 'STRING': case 'VARCHAR': case 'GEOGRAPHY':
      return 'string'
    case 'BOOL': case 'BOOLEAN':
      return 'boolean'
    case 'DATE':
      return 'date'
    case 'DATETIME': case 'TIME': case 'TIMESTAMP': case 'TIMESTAMP_NTZ':
      return 'timestamp'
    default:
      return null
  }
}

// Quote an identifier for the current dialect
function quote (name: string): string {
  if (config.dialect === 'bigquery') return `\`${name}\``
  return `"${name}"`
}
