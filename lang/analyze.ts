import {NodeWeakMap, type SyntaxNode, type SyntaxNodeRef} from '@lezer/common'
import {type Table, type Query, type QueryJoin, type Column, type FieldType, type FileInfo, type Diagnostic, type Expr, type CteTable, type JoinType, type Scope} from './types.ts'
import {txt, getFile, getPosition} from './util.ts'
import {extractLeadingMetadata} from './metadata.ts'
import {config} from './config.ts'
import {analyzeFunction} from './functions.ts'
import {parseTemporalLiteral, parseIntervalLiteral, parseIntervalUnit} from './temporalLiterals.ts'

// Analyze is the heart of gsql processing. It works in 2 phases:
// 1. walk the parse tree looking for tables, views, and extend blocks.
// 2. starting from a query, recursively analyze every expression computing types and generating sql.
//
// When a query has something like `from foo select bar.baz`, we add `bar` as an implicit join, an recursively analyze `baz`
// which itself might be an expression that traverses other joins.
//
// It's also possible to do a "full" analysis where we look at every field on every table.
// Analyzing checks that expression are valid, that types are correct, and generates dialect-specific sql.
//
// NB that while the first step of collecting tables can be used between runs, analysis kinda can't since the alias for a given
// join could change from query to query.


export let FILE_MAP: Record<string, FileInfo> = {} // All the files in the workspace and their tables/queries
export let diagnostics: Diagnostic[] = [] // Tracks errors/warnings
let analysisStack = new Set<Column>() // Track computed columns being analyzed to detect cycles
let NODE_ENTITY_MAP = new NodeWeakMap<any>() // Points syntax nodes back to entities for ide hover tips

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

    let hasNamespace = name.includes('.')
    let tablePath = !hasNamespace && config.defaultNamespace ? `${config.defaultNamespace}.${name}` : name
    let type = syntaxNode.getChild('QueryStatement') ? 'view' : 'table' as const
    let table = {name, type, tablePath, columns: [], joins: [], metadata: extractLeadingMetadata(syntaxNode), syntaxNode} as Table

    syntaxNode.getChildren('ColumnDef').forEach(cn => addColumn(table, cn))
    syntaxNode.getChildren('JoinDef').forEach(jn => addJoin(table, jn))
    syntaxNode.getChildren('ComputedDef').forEach(cn => addComputedColumn(table, cn))

    fi.tables.push(table)
  }
}

// `extend` blocks add columns and joins to existing tables
export function applyExtends (fi: FileInfo) {
  fi.tree!.topNode.getChildren('ExtendStatement').forEach(node => {
    let target = lookupTable(node.getChild('Ref')!)
    if (!target) return
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
  let aliasNode = node.getChild('Alias') || node.getChild('Ref')!.getChildren('Identifier').pop()
  let alias = txt(aliasNode)

  let joinTypeStr = txt(node.getChild('JoinType')).replace(/\s+/g, ' ')
  let cardinality = {'join many': 'many', 'join one': 'one'}[joinTypeStr] as 'one' | 'many'
  if (!cardinality) return diag(node, 'Unknown join type')

  let targetNode = node.getChild('Ref')!
  let targetTable = txt(targetNode)
  let onExpr = node.getChild('BinaryExpression')!

  let join: QueryJoin = {alias, source: 'implicit', targetTable, cardinality, onExpr, targetNode}
  if (getField(alias, table)) return diag(node, `Table already has a field called "${alias}"`)
  table.joins.push(join)
}

function addComputedColumn (table: Table, node: SyntaxNode) {
  let name = txt(node.getChild('Alias'))
  let col: Column = {name, type: 'string', exprNode: node.getChild('Expression')!, metadata: extractLeadingMetadata(node)}
  if (getField(name, table)) return diag(node, `Table already has a field called "${name}"`)
  table.columns.push(col)
}

function getField (name: string, table: Table) {
  return table.columns.find(c => c.name == name) || table.joins.find(j => j.alias == name)
}

// Analyze a view's underlying query to determine its output columns.
// Converts a PhysicalTable with a QueryStatement into a ViewTable with a query.
// Returns true if the table is (or was already) a successfully analyzed view.
function analyzeView (table: Table) {
  if (table.type != 'view') return
  if (table.query) return // already analyzed
  let query = analyzeQuery(table.syntaxNode!.getChild('QueryStatement')!)
  let viewCols = query?.fields.map(f => ({name: f.name, type: f.type, metadata: f.metadata}) as Column) || []
  table.columns.push(...viewCols)
  table.query = query!
}

// Analyze everything in a table - used for full project analysis (e.g., `check` command)
export function analyzeTableFully (table: Table) {
  if (table.type == 'view') analyzeView(table)
  let scope: Scope = {table, alias: table.name}
  table.columns.forEach(c => {
    if (!c.exprNode) return
    let expr = analyzeExpr(c.exprNode, scope)
    c.isAgg = expr.isAgg
  })
  table.joins.forEach(j => j.table = lookupTable(j.targetNode!))
}

// Expand non-aggregate columns into query fields.
// When table is provided, expands that single table's columns.
// When table is null, expands all root-visible query tables (base + ad-hoc joins).
function expandColumns (table: Table | null, alias: string, query: Query, scope: Scope, namePrefix = '') {
  if (!table) {
    let baseJoin = query.joins.find(j => j.source == 'from')
    if (!baseJoin?.table) return
    expandColumns(baseJoin.table, baseJoin.alias, query, scope)
    for (let join of query.joins.filter(j => j.source == 'ad-hoc')) {
      if (join.table) expandColumns(join.table, join.alias, query, scope, join.alias)
    }
    return
  }
  for (let col of table.columns) {
    let outName = namePrefix ? `${namePrefix}_${col.name}` : col.name
    if (col.exprNode) {
      // Determine if aggregate (without query context to avoid side-effect diagnostics), then skip measures
      if (col.isAgg == null) col.isAgg = analyzeExpr(col.exprNode, {table, alias}).isAgg
      if (col.isAgg) continue
      let expr = analyzeExpr(col.exprNode, {query: scope.query, table, alias, otherTables: scope.otherTables})
      query.fields.push({name: outName, sql: expr.sql, type: expr.type, metadata: col.metadata})
    } else {
      query.fields.push({name: outName, sql: `${alias}.${quoteColumn(col.name)}`, type: col.type, metadata: col.metadata})
    }
  }
}

// Main query analysis - analyzes and returns a Query with computed SQL
export function analyzeQuery (queryNode: SyntaxNode, outerCtes?: Table[]): Query | void {
  let query: Query = {sql: '', fields: [], joins: [], filters: [], groupBy: [], orderBy: [], isAggregate: false}
  let ctes = new Map<string, CteTable>()
  let scope: Scope = {query, alias: '', otherTables: outerCtes || []}
  let isAgg = false

  // WITH clause - analyze each CTE. Store them on Scope, as they're accessible to later CTEs, and valid tables for the query to from/join
  let withClauses = queryNode.getChild('WithClause')?.getChildren('CteDef') || []
  for (let cteDef of withClauses) {
    let name = txt(cteDef.getChild('Alias'))
    let query = analyzeQuery(cteDef.getChild('QueryStatement')!, scope.otherTables)
    if (!query) return
    let columns = query.fields.map(f => ({name: f.name, type: f.type, metadata: f.metadata}) as Column)
    let cte: CteTable = {name, type: 'cte', tablePath: name, columns, joins: [], query}
    ctes.set(name, cte)
    scope.otherTables!.push(cte)
  }

  // FROM / JOIN
  // We represent both as `joins` on the query, since they're conceptually similar for most of analysis
  let fromClause = queryNode.getChild('FromClause')
  let sources: SyntaxNode[] = fromClause ? [fromClause, ...fromClause.getChildren('JoinClause')] : []
  for (let sourceNode of sources) {
    let isJoin = sourceNode.name == 'JoinClause'
    let tablePrimary = sourceNode.getChild('TablePrimary')
    if (!tablePrimary) return diag(sourceNode, `Invalid ${isJoin ? 'JOIN' : 'FROM'} source`)
    let alias = txt(tablePrimary.getChild('Alias'))
    let table: Table | undefined

    // This might be referring to a table by name
    let refNode = tablePrimary.getChild('Ref') || undefined
    if (refNode) {
      table = lookupTable(refNode, scope)
      if (!table) return
      alias ||= txt(refNode.getChildren('Identifier').at(-1))
    }

    // or it could be a subquery
    if (tablePrimary.getChild('SubqueryExpression')) {
      let subquery = analyzeQuery(tablePrimary.getChild('SubqueryExpression')!.getChild('QueryStatement')!, scope.otherTables)
      if (!subquery) return
      let columns = subquery.fields.map(f => ({name: f.name, type: f.type, metadata: f.metadata}) as Column)
      table = {name: 'subquery', type: 'subquery', tablePath: alias, columns, joins: [], query: subquery}
      alias ||= 'subquery'
    }

    let joinType: JoinType | undefined = isJoin ? 'inner' : undefined
    let firstKw = txt(sourceNode.getChildren('Kw')[0]).toLowerCase()
    if (firstKw == 'left' || firstKw == 'right' || firstKw == 'full' || firstKw == 'cross') joinType = firstKw

    // Now that we have all the bits, construct the join for it.
    if (query.joins.find(j => j.alias == alias)) return diag(tablePrimary, `Query already has table called "${alias}"`)
    let qj: QueryJoin = {alias, source: isJoin ? 'ad-hoc' : 'from', table, joinType}
    query.joins.push(qj)
    NODE_ENTITY_MAP.set(tablePrimary, {entityType: 'table', table})

    // If this is a JOIN, analyze the ON expr
    // It's important we do this _after_ adding the join to the query, since analyzing the expression looks at the query
    let onExpr = sourceNode.getChild('Expression') || undefined
    if (joinType == 'cross' && onExpr) return diag(sourceNode, 'CROSS JOIN cannot have an ON clause')
    if (isJoin && !onExpr && joinType != 'cross') return diag(sourceNode, `${joinType!.toUpperCase()} JOIN requires an ON clause`)
    qj.onClause = onExpr && analyzeExpr(onExpr, {query, alias: '', otherTables: scope.otherTables}).sql
  }

  // SELECT clause
  let selects = queryNode.getChild('SelectClause')?.getChildren('SelectItem') || []
  let isSelectDistinct = !!queryNode.getChild('SelectClause')?.getChildren('Kw').find(n => txt(n).toLowerCase() == 'distinct')
  isAgg ||= isSelectDistinct

  for (let s of selects) {
    if (s.getChild('Wildcard')) {
      let pathNodes = s.getChild('Wildcard')!.getChildren('Identifier')
      if (pathNodes.length == 0) {
        expandColumns(null, '', query, scope)
        continue
      }
      let targetScope = followJoins(pathNodes, scope)
      if (!targetScope) continue
      if (!targetScope.table) continue
      expandColumns(targetScope.table, targetScope.alias, query, targetScope)
    } else {
      let expr = analyzeExpr(s.getChild('Expression')!, scope)
      let name = s.getChild('Alias') ? txt(s.getChild('Alias')) : inferName(s.getChild('Expression')!, scope)
      isAgg ||= !!expr.isAgg
      query.fields.push({name, sql: expr.sql, type: expr.type, isAgg: expr.isAgg})
    }
  }

  // WHERE / HAVING - we allow aggregate filters in WHERE (moved to HAVING automatically)
  let whereNode = queryNode.getChild('WhereClause')?.getChild('Expression')
  let havingNode = queryNode.getChild('HavingClause')?.getChild('Expression')
  for (let node of [whereNode, havingNode]) {
    if (!node) continue
    for (let expr of unpackAnds(node, scope)) {
      query.filters.push({sql: expr.sql, isAgg: expr.isAgg})
    }
  }

  // GROUP BY - adds fields if not already selected
  let groupBys = queryNode.getChild('GroupByClause')?.getChildren('SelectItem') || []
  isAgg ||= groupBys.length > 0
  for (let g of groupBys) {
    let expr = analyzeExpr(g.getChild('Expression')!, scope)
    if (expr.isAgg) { diag(g, 'Cannot group by aggregate expressions'); continue }
    let name = g.getChild('Alias') ? txt(g.getChild('Alias')) : inferName(g.getChild('Expression')!, scope)
    if (!query.fields.find(f => f.name == name)) {
      query.fields.unshift({name, sql: expr.sql, type: expr.type})
    }
  }

  // ORDER BY
  let orderBys = queryNode.getChild('OrderByClause')?.getChildren('OrderItem') || []
  let orderBy: {idx: number, desc: boolean}[] = []
  for (let o of orderBys) {
    let fieldRef = txt(o.getChild('Identifier')) || txt(o.getChild('Number'))
    let desc = txt(o.getChild('Kw')).toLowerCase() == 'desc'
    let idx = Number(fieldRef) || (query.fields.findIndex(f => f.name == fieldRef) + 1)
    if (idx > 0) orderBy.push({idx, desc})
    else if (fieldRef && isNaN(Number(fieldRef))) diag(o, `Unknown field in ORDER BY: ${fieldRef}`)
  }

  // LIMIT
  let limitNodes = queryNode.getChild('LimitClause')?.getChildren('Number') || []
  let limit = limitNodes[0] ? Number(txt(limitNodes[0])) : undefined
  if (limitNodes[1]) diag(limitNodes[1], 'OFFSET is not supported yet')

  // Implicit `select *` if nothing selected (only when we have a base table)
  let baseJoin = query.joins.find(j => j.source == 'from')
  if (query.fields.length == 0 && baseJoin?.table) {
    let hasAdHoc = query.joins.some(j => j.source == 'ad-hoc')
    expandColumns(hasAdHoc ? null : baseJoin.table, baseJoin.alias, query, scope)
  }

  // Compute GROUP BY indices (non-aggregate fields, 1-indexed)
  let groupByIndices = query.fields.map((f, i) => f.isAgg ? 0 : i + 1).filter(i => i > 0)

  // Default ORDER BY for aggregate queries
  if (orderBy.length == 0 && isAgg && groupByIndices.length > 0) {
    let firstAggIdx = query.fields.findIndex(f => f.isAgg)
    if (firstAggIdx >= 0) {
      orderBy.push({idx: firstAggIdx + 1, desc: true})
    } else {
      orderBy.push({idx: 1, desc: false})  // SELECT DISTINCT
    }
  }

  query.groupBy = isAgg ? groupByIndices : []
  query.orderBy = orderBy
  query.limit = limit
  query.isAggregate = isAgg
  query.sql = buildSql(query, ctes)
  return query
}

// Assemble query parts into final SQL
// Format a table path for the current dialect
function formatTablePath (path: string): string {
  if (config.dialect === 'bigquery') return `\`${path}\``
  if (config.dialect === 'snowflake') return path.toUpperCase()
  return path
}

function buildSql (query: Query, cteMap: Map<string, CteTable>): string {
  let ctes: string[] = [...cteMap.values()].map(c => `${quote(c.name)} as ( ${c.query.sql} )`)
  let selectParts = query.fields.map(f => `${f.sql} as ${quote(f.name)}`)
  let baseJoin = query.joins.find(j => j.source == 'from')

  // No FROM clause (e.g. `select 1`)
  if (!baseJoin?.table) return `SELECT ${selectParts.join(', ')}`

  function renderTableRef (table: Table): string {
    if (table.type === 'view') {
      if (!ctes.some(c => c.startsWith(quote(table.name) + ' '))) {
        ctes.push(`${quote(table.name)} as ( ${table.query.sql} )`)
      }
      return quote(table.name)
    }
    if (table.type === 'subquery') return `( ${table.query.sql} )`
    return formatTablePath(table.tablePath)
  }

  let fromTable = renderTableRef(baseJoin.table)
  let joinClauses = query.joins.filter(j => j.source != 'from').map(j => {
    if (!j.table || !j.joinType) return ''
    let tablePath = renderTableRef(j.table)
    let keyword = j.joinType.toUpperCase() + ' JOIN'
    if (j.joinType == 'cross') return `${keyword} ${tablePath} as ${j.alias}`
    return `${keyword} ${tablePath} as ${j.alias} ON ${j.onClause}`
  }).filter(Boolean)

  let whereFilters = query.filters.filter(f => !f.isAgg).map(f => f.sql)
  let havingFilters = query.filters.filter(f => f.isAgg).map(f => f.sql)

  let sql = `SELECT ${selectParts.join(', ')} FROM ${fromTable} as ${baseJoin.alias}`
  if (joinClauses.length) sql += ' ' + joinClauses.join(' ')
  if (whereFilters.length) sql += ` WHERE ${whereFilters.join(' AND ')}`
  if (query.groupBy.length) sql += ` GROUP BY ${query.groupBy.join(',')}`
  if (havingFilters.length) sql += ` HAVING ${havingFilters.join(' AND ')}`
  if (query.orderBy.length) {
    let parts = query.orderBy.map(o => `${o.idx} ${o.desc ? 'desc' : 'asc'} NULLS LAST`)
    sql += ` ORDER BY ${parts.join(',')}`
  }
  if (query.limit) sql += ` LIMIT ${query.limit}`
  if (ctes.length) sql = `WITH ${ctes.join(', ')} ${sql}`
  return sql
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
        if (outField) return {sql: outField.isAgg ? quote(fieldName) : outField.sql, type: outField.type, isAgg: outField.isAgg}
      }

      // Follow any dot path (e.g., `users.orders` in `users.orders.amount`), then find the field
      let targetScope = followJoins(pathNodes, scope)
      if (!targetScope) return {sql: 'NULL', type: 'error'}

      // Build the list of tables to search: if followJoins landed on a specific table, just that one.
      // Otherwise, search all tables either in FROM or explicitly JOINed (but not implicitly joined).
      let possibleJoins = targetScope.table
        ? [{table: targetScope.table, alias: targetScope.alias}]
        : (scope.query?.joins.filter(j => j.source != 'implicit' && j.table).map(j => ({table: j.table!, alias: j.alias})) || [])

      // Expect just one of the possibleJoins to have the named column. Otherwise, it's an error.
      let matches = possibleJoins.filter(j => j.table.columns.some(c => c.name == fieldName))
      if (matches.length > 1) {
        return diag(fieldNode, `Ambiguous field "${fieldName}"`, {sql: 'NULL', type: 'error'})
      }

      if (matches.length == 0) {
        if (possibleJoins.some(j => j.table.joins.some(jj => jj.alias == fieldName))) {
          return diag(fieldNode, `"${fieldName}" is a join, not a column`, {sql: 'NULL', type: 'error'})
        }
        let on = possibleJoins.length == 1 ? ` on ${possibleJoins[0].table.name}` : ''
        return diag(fieldNode, `Unknown field "${fieldName}"${on}`, {sql: 'NULL', type: 'error'})
      }

      let {table, alias} = matches[0]
      let col = table.columns.find(c => c.name == fieldName)!
      NODE_ENTITY_MAP.set(fieldNode, {entityType: 'field', field: col, table})

      // Simple case: this is just a regular column on a table
      if (!col.exprNode) return {sql: `${alias}.${quoteColumn(col.name)}`, type: col.type}

      // Computed column: analyze its expression in the matched table's scope
      if (analysisStack.has(col)) return diag(col.exprNode, 'Cycles are not allowed between computed columns', {sql: 'NULL', type: 'error'})
      analysisStack.add(col)
      let expr = analyzeExpr(col.exprNode, {query: scope.query, table, alias, otherTables: scope.otherTables})
      analysisStack.delete(col)
      return {sql: `(${expr.sql})`, type: expr.type, isAgg: expr.isAgg}
    }

    case 'FunctionCall':
      return analyzeFunction(node, scope, analyzeExpr)

    case 'WindowExpression': {
      let baseNode = node.getChild('FunctionCall') || node.getChild('Count')
      if (!baseNode) return diag(node, 'Window expressions require a function call', {sql: 'NULL', type: 'error'})
      let base = analyzeExpr(baseNode, scope)
      if (base.type == 'error') return base
      if (!base.canWindow) return diag(baseNode, 'Only aggregate or window functions can use OVER', {sql: 'NULL', type: 'error'})
      let over = renderOverClause(node.getChild('OverClause')!, scope)
      return {sql: `${base.sql} OVER (${over})`, type: base.type, isAgg: false}
    }

    case 'Parenthetical': {
      let inner = analyzeExpr(node.getChild('Expression')!, scope)
      return {sql: `(${inner.sql})`, type: inner.type, isAgg: inner.isAgg}
    }

    case 'Count': {
      let inner = node.getChild('Expression')
      if (inner) {
        let e = analyzeExpr(inner, scope)
        return {sql: `count(distinct ${e.sql})`, type: 'number', isAgg: true, canWindow: true}
      }
      return {sql: 'count(1)', type: 'number', isAgg: true, canWindow: true}
    }

    case 'BinaryExpression':
    case 'OrExpression':
    case 'AndExpression':
    case 'ComparisonExpression':
    case 'AddExpression':
    case 'MultiplyExpression': {
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
      if (op == '||') {
        checkTypes(left, ['string'], node.firstChild!)
        checkTypes(right, ['string'], node.lastChild!)
      }

      let resultType = left.type
      if (['and', 'or', '<', '<=', '>', '>=', '=', '!=', '<>', 'like', 'ilike'].includes(op)) resultType = 'boolean'
      if (op == '||') resultType = 'string'
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
      let subqueryNode = node.getChild('QueryStatement')
      if (subqueryNode) {
        let subquery = analyzeQuery(subqueryNode, scope.otherTables)
        if (!subquery) return {sql: 'NULL', type: 'error'}
        if (subquery.fields.length != 1) return diag(subqueryNode, 'Subquery in IN must return exactly one column', {sql: 'NULL', type: 'error'})
        return {sql: `${e.sql} ${not ? 'NOT IN' : 'IN'} (${subquery.sql})`, type: 'boolean', isAgg: e.isAgg}
      }
      if (!valueList) {
        return diag(node, 'IN expression must provide either values or a subquery', {sql: 'NULL', type: 'error'})
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

    case 'BetweenExpression': {
      let not = !!node.getChildren('Kw').map(n => txt(n).toLowerCase()).find(k => k == 'not')
      let [eNode, lowNode, highNode] = node.getChildren('Expression')
      let [e, low, high] = [eNode, lowNode, highNode].map(n => analyzeExpr(n, scope))

      if (e.type == 'date' || e.type == 'timestamp') {
        low = coerceToTemporal(low, e.type, lowNode)
        high = coerceToTemporal(high, e.type, highNode)
      }

      let sql = `${e.sql} ${not ? 'NOT BETWEEN' : 'BETWEEN'} ${low.sql} AND ${high.sql}`
      return {sql, type: 'boolean', isAgg: e.isAgg || low.isAgg || high.isAgg}
    }

    case 'SubqueryExpression': {
      let subquery = analyzeQuery(node.getChild('QueryStatement')!, scope.otherTables)
      if (!subquery) return {sql: 'NULL', type: 'error'}
      if (subquery.fields.length != 1) return diag(node, 'Subquery expression must return exactly one column', {sql: 'NULL', type: 'error'})
      return {sql: `(${subquery.sql})`, type: subquery.fields[0].type}
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
      let quantityNode = node.getChild('Number') || node.getChild('Ref')
      if (!quantityNode) return diag(node, 'Interval requires a quantity before the unit', {sql: 'NULL', type: 'error'})
      let quantity = analyzeExpr(quantityNode, scope)
      checkTypes(quantity, ['number'], quantityNode)
      let unit = parseIntervalUnit(txt(node.getChild('IntervalUnit')!).toLowerCase())
      if (!unit) return diag(node, 'Invalid interval unit', {sql: 'NULL', type: 'error'})
      return {sql: `INTERVAL ${quantity.sql} ${unit}`, type: 'interval', isAgg: quantity.isAgg}
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

function renderOverClause (overClause: SyntaxNode, scope: Scope): string {
  let spec = overClause.getChild('WindowSpec')
  if (!spec) return ''
  let parts: string[] = []

  let partition = spec.getChild('WindowPartitionClause')
  if (partition) {
    let exprs = partition.getChildren('Expression').map(e => analyzeExpr(e, scope).sql)
    parts.push(`PARTITION BY ${exprs.join(', ')}`)
  }

  let orderBy = spec.getChild('WindowOrderByClause')
  if (orderBy) {
    let items = orderBy.getChildren('WindowOrderItem').map(item => {
      let expr = analyzeExpr(item.getChild('Expression')!, scope).sql
      let desc = txt(item.getChild('Kw')).toLowerCase() == 'desc'
      return `${expr} ${desc ? 'DESC' : 'ASC'}`
    })
    parts.push(`ORDER BY ${items.join(', ')}`)
  }

  let frame = spec.getChild('WindowFrameClause')
  if (frame) parts.push(renderWindowFrame(frame, scope))

  return parts.join(' ')
}

function renderWindowFrame (frame: SyntaxNode, scope: Scope): string {
  let mode = txt(frame.getChildren('Kw')[0]).toUpperCase()
  let between = frame.getChild('WindowFrameBetween')
  if (between) {
    let bounds = between.getChildren('WindowFrameBound').map(b => renderWindowBound(b, scope))
    return `${mode} BETWEEN ${bounds[0]} AND ${bounds[1]}`
  }
  let start = frame.getChild('WindowFrameStart')!.getChild('WindowFrameBound')!
  return `${mode} ${renderWindowBound(start, scope)}`
}

function renderWindowBound (bound: SyntaxNode, scope: Scope): string {
  let kws = bound.getChildren('Kw').map(k => txt(k).toLowerCase())
  if (kws.includes('unbounded')) {
    return `UNBOUNDED ${kws.includes('following') ? 'FOLLOWING' : 'PRECEDING'}`
  }
  if (kws.includes('current')) return 'CURRENT ROW'
  let expr = analyzeExpr(bound.getChild('Expression')!, scope).sql
  return `${expr} ${kws.includes('following') ? 'FOLLOWING' : 'PRECEDING'}`
}

// Traverse a join path (like `tableA.tableB.`), returning a new scope pointing to the target table. Adds implied joins to the query as it goes
function followJoins (pathNodes: SyntaxNode[], scope: Scope): Scope | null {
  let part = pathNodes[0]
  let name = txt(part)

  if (pathNodes.length == 0) return scope

  // If we're analyzing an ON clause, any path nodes must point at the source or target table
  if (scope.joinTarget) {
    let pointsAtSource = !!scope.table && name == scope.alias
    let pointsAtTarget = name == scope.joinTarget.alias || name == scope.joinTarget.name
    if (!pointsAtSource && !pointsAtTarget) return diag(pathNodes[0], 'Joins must point at either the source or target table', null)

    let table = pointsAtTarget ? scope.joinTarget.table : scope.table!
    let alias = pointsAtTarget ? scope.joinTarget.alias : scope.alias
    NODE_ENTITY_MAP.set(pathNodes[0], {entityType: 'table', table})
    return {query: scope.query, table, alias, otherTables: scope.otherTables}
  }

  // If scope is at the root of the table (ie scope.table == null), then the first part of the path could point at
  // the alias of any table in the FROM or JOIN clauses of a query.
  // But it could also refer to a join _on_ one of those tables (assuming the name is unique).
  if (!scope.table) {
    // This could be a ref to an existing FROM/JOIN alias
    let existing = scope.query!.joins.find(j => j.alias == name)
    if (existing) {
      NODE_ENTITY_MAP.set(part, {entityType: 'table', table: existing.table})
      scope = {...scope, table: existing.table!, alias: existing.alias}
      pathNodes.shift() // remove, since we're updating scope
    } else {
      // otherwise, this might be referring to a join _on_ one of those FROM/JOIN tables
      let matches = scope.query!.joins.filter(j => j.table!.joins.some(jj => jj.alias == name))
      if (matches.length > 1) return diag(part, `"${name}" matches multiple possible joins in this query`, null)
      if (matches.length == 0) return diag(part, `Could not find "${name}" on query`, null)
      scope = {...scope, table: matches[0].table!, alias: matches[0].alias}
    }
  }

  // At this point we're guaranteed to have a scope.table, and from here it's easy. Each part of the path must be
  // the name of a join on scope.table, and we just need to walk through each one updating our scope, and adding an implicit join to the query
  for (let part of pathNodes) {
    let name = txt(part)
    if (name == scope.alias || name == scope.table!.name) continue

    let table = scope.table!
    let alias = scope.alias
    let next = table.joins.find(j => j.alias == name)
    if (!next) return diag(part, `Unknown join "${name}" on ${table.name}`, null)

    next.table = lookupTable(next.targetNode!)
    if (!next.table) return null

    // Construct a new implied join and attache it to the query
    let fromAlias = scope.query?.joins.find(j => j.source == 'from')?.alias
    let newAlias = alias == fromAlias ? name : `${alias}_${name}`
    if (scope.query && !scope.query.joins.find(j => j.alias == newAlias)) {
      let joinTarget = {name: next.alias, table: next.table, alias: newAlias}
      let onClause = analyzeExpr(next.onExpr!, {table, alias, joinTarget}).sql
      scope.query.joins.push({alias: newAlias, targetTable: next.targetTable, table: next.table, source: 'implicit', cardinality: next.cardinality, joinType: 'left', onClause})
    }

    NODE_ENTITY_MAP.set(part, {entityType: 'table', table: next.table})
    scope = {...scope, table: next.table, alias: newAlias}
  }

  return scope
}

// Find a table by Ref node, failing if it doesn't exist
function lookupTable (node: SyntaxNode, scope?: Scope): Table | undefined {
  let name = txt(node)
  let table: Table | undefined

  for (let scopeTable of scope?.otherTables || []) {
    if (scopeTable.name == name) table = scopeTable
  }
  let currentUri = getFile(node).path
  for (let file of Object.values(FILE_MAP)) {
    if (table) break
    if (file.path.endsWith('.gsql') || file.path == currentUri) {
      let match = file.tables.find(t => t.name == name)
      if (match) table = match
    }
  }
  if (!table) return diag(node, `Unknown table "${name}"`)
  analyzeView(table)
  return table
}

function inferName (exprNode: SyntaxNode, scope: Scope): string {
  if (exprNode.name == 'Ref') {
    return exprNode.getChildren('Identifier').map(i => txt(i)).join('_')
  }
  return `col_${scope.query?.fields.length || 0}`
}

// TODO: do we still need this?
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

// Convert raw database types into simplified types. Malloy did this, I'm on the fence if we need it.
// On the one hand, it often makes type checking easier, since it normalizes things that can be implicitly cast to match,
// and gives simpler types to the frontend.
// On the other, it obscures the actual types in cases where they might be relevant, like function signature matching.
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

function quoteColumn (name: string): string {
  if (config.dialect === 'bigquery') return `\`${name}\``
  if (config.dialect === 'snowflake') return `"${name.toUpperCase()}"`
  return `"${name}"`
}
