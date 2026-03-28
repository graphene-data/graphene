import {NodeWeakMap, type SyntaxNode, type SyntaxNodeRef} from '@lezer/common'

import {config} from './config.ts'
import {
  aggregateFanoutMessage,
  normalizeExprFanout,
  extendFanoutPath,
  fanoutMessage,
  fanoutPathKey,
  isBaseFanoutPath,
  isChasmTrap,
  isPrefix,
  mergeFanoutPaths,
  mergeSensitiveFanouts,
  multiGrainMessage,
  uniqueFanoutPaths,
} from './fanout.ts'
import {analyzeFunction} from './functions.ts'
import {extractLeadingMetadata} from './metadata.ts'
import {parseTemporalLiteral, parseIntervalLiteral, parseIntervalUnit, renderTemporalArithmetic, renderStandaloneInterval} from './temporal.ts'
import {
  type Table,
  type Query,
  type QueryJoin,
  type Column,
  type FieldType,
  type FileInfo,
  type GrapheneError,
  type Expr,
  type CteTable,
  type JoinType,
  type Scope,
  type Location,
  type NavigationSymbolKind,
} from './types.ts'
import {buildFrame, txt, getFile, getPosition, toRelativePath} from './util.ts'

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
export let diagnostics: GrapheneError[] = [] // Tracks errors/warnings
let analysisStack = new Set<Column>() // Track computed columns being analyzed to detect cycles
let NODE_ENTITY_MAP = new NodeWeakMap<any>() // Points syntax nodes back to entities for ide hover tips

function locationForNode(node: SyntaxNode): Location {
  let file = getFile(node)
  return {file: file.path, from: getPosition(node.from, file), to: getPosition(node.to, file)}
}

function symbolId(kind: NavigationSymbolKind, location: Location, scopeKey = '') {
  let suffix = scopeKey ? `:${scopeKey}` : ''
  return `${kind}:${location.file}:${location.from.offset}:${location.to.offset}${suffix}`
}

function addSymbol(kind: NavigationSymbolKind, node: SyntaxNode, name: string, opts: {tableId?: string; scopeKey?: string} = {}) {
  let file = getFile(node)
  let location = locationForNode(node)
  let id = symbolId(kind, location, opts.scopeKey)
  file.navigation.symbols.push({id, kind, name, location, tableId: opts.tableId})
  return {symbolId: id, location}
}

function addReference(kind: NavigationSymbolKind, node: SyntaxNode, targetId?: string) {
  if (!targetId) return
  let file = getFile(node)
  file.navigation.references.push({kind, targetId, location: locationForNode(node)})
}

// Creates tables without analyzing them.
export function findTables(fi: FileInfo) {
  let tn = fi.tree!.topNode
  fi.tables = []
  let nodes = tn.getChildren('TableStatement').concat(tn.getChildren('ViewStatement'))
  for (let syntaxNode of nodes) {
    let refNode = syntaxNode.getChild('Ref')!
    let name = txt(refNode)

    let existing = Object.values(FILE_MAP).find(f => {
      if (f.path.endsWith('.md') && f.path != fi.path) return
      return f.tables.find(t => t.name == name)
    })
    if (existing) diag(refNode, `Table "${name}" is already defined`)

    let hasNamespace = name.includes('.')
    let tablePath = !hasNamespace && config.defaultNamespace ? `${config.defaultNamespace}.${name}` : name
    let type = syntaxNode.getChild('QueryExpression') ? 'view' : ('table' as const)
    let table = {name, type, tablePath, columns: [], joins: [], metadata: extractLeadingMetadata(syntaxNode), syntaxNode} as Table
    Object.assign(table, addSymbol('table', refNode, name))

    syntaxNode.getChildren('ColumnDef').forEach(cn => addColumn(table, cn))
    syntaxNode.getChildren('JoinDef').forEach(jn => addJoin(table, jn))
    syntaxNode.getChildren('ComputedDef').forEach(cn => addComputedColumn(table, cn))

    fi.tables.push(table)
  }
}

// `extend` blocks add columns and joins to existing tables
export function applyExtends(fi: FileInfo) {
  fi.tree!.topNode.getChildren('ExtendStatement').forEach(node => {
    let target = lookupTable(node.getChild('Ref')!)
    if (!target) return
    node.getChildren('JoinDef').forEach(jn => addJoin(target, jn))
    node.getChildren('ComputedDef').forEach(cn => addComputedColumn(target, cn))
  })
}

function addColumn(table: Table, node: SyntaxNode) {
  let nameNode = node.getChild('ColumnName')!
  let name = txt(nameNode)
  let type = convertDataType(txt(node.getChild('DataType')))
  if (!type) return diag(node, `Unsupported data type: ${txt(node.getChild('DataType'))}`)
  let col: Column = {name, type, metadata: extractLeadingMetadata(node)}
  Object.assign(col, addSymbol('column', nameNode, name, {tableId: table.symbolId}))
  if (getField(name, table)) return diag(node, `Table already has a field called "${name}"`)
  table.columns.push(col)
}

function addJoin(table: Table, node: SyntaxNode) {
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

function addComputedColumn(table: Table, node: SyntaxNode) {
  let nameNode = node.getChild('Alias')!
  let name = txt(nameNode)
  let col: Column = {name, type: 'string', exprNode: node.getChild('Expression')!, metadata: extractLeadingMetadata(node)}
  Object.assign(col, addSymbol('column', nameNode, name, {tableId: table.symbolId}))
  if (getField(name, table)) return diag(node, `Table already has a field called "${name}"`)
  table.columns.push(col)
}

function getField(name: string, table: Table) {
  return table.columns.find(c => c.name == name) || table.joins.find(j => j.alias == name)
}

// Analyze a view's underlying query to determine its output columns.
// Converts a PhysicalTable with a QueryStatement into a ViewTable with a query.
// Returns true if the table is (or was already) a successfully analyzed view.
function analyzeView(table: Table) {
  if (table.type != 'view') return
  if (table.analyzed) return
  table.analyzed = true

  let query = analyzeQuery(table.syntaxNode!.getChild('QueryExpression')!)
  if (!query) return

  let viewCols = query.fields.map(f => {
    let col = {name: f.name, type: f.type, metadata: f.metadata, location: f.definitionLocation} as Column
    if (f.definitionLocation) {
      col.symbolId = symbolId('column', f.definitionLocation, `${table.symbolId}:${f.name}`)
      getFile(table.syntaxNode!).navigation.symbols.push({id: col.symbolId, kind: 'column', name: col.name, location: f.definitionLocation, tableId: table.symbolId})
    }
    return col
  })
  table.columns.push(...viewCols)
  table.query = query
}

// Analyze everything in a table - used for full project analysis (e.g., `check` command)
export function analyzeTableFully(table: Table) {
  if (table.type == 'view') analyzeView(table)
  let scope: Scope = {table, alias: table.name, fanoutPath: []}
  table.columns.forEach(c => {
    if (!c.exprNode) return
    let expr = analyzeExpr(c.exprNode, scope)
    c.isAgg = expr.isAgg
    analyzeComputedFieldExpr(c.exprNode, expr)
  })
  table.joins.forEach(j => {
    j.table = lookupTable(j.targetNode!)
    if (!j.table || !j.onExpr) return
    let joinTarget = {name: j.alias, table: j.table, alias: j.alias}
    analyzeExpr(j.onExpr, {table, alias: table.name, fanoutPath: [], joinTarget})
  })
}

// Expand non-aggregate columns into query fields.
// When table is provided, expands that single table's columns.
// When table is null, expands all root-visible query tables (base + ad-hoc joins).
function expandColumns(table: Table | null, alias: string, query: Query, scope: Scope, namePrefix = '') {
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
      if (col.isAgg == null) col.isAgg = analyzeExpr(col.exprNode, {table, alias, fanoutPath: scope.fanoutPath}).isAgg
      if (col.isAgg) continue
      let expr = analyzeExpr(col.exprNode, {query: scope.query, table, alias, otherTables: scope.otherTables, fanoutPath: scope.fanoutPath})
      if (expr.type == 'interval' && expr.interval?.form == 'scaled') diag(col.exprNode, 'Multiplied intervals are only supported inside date/time arithmetic')
      query.fields.push({
        name: outName,
        sql: expr.sql,
        type: expr.type,
        metadata: col.metadata,
        fanout: expr.fanout,
        definitionLocation: col.location,
      })
    } else {
      query.fields.push({
        name: outName,
        sql: `${alias}.${col.name}`,
        type: col.type,
        metadata: col.metadata,
        fanout: normalizeExprFanout({path: scope.fanoutPath}),
        definitionLocation: col.location,
      })
    }
  }
}

// Main query analysis - analyzes and returns a Query with computed SQL
export function analyzeQuery(queryNode: SyntaxNode, outerCtes?: Table[]): Query | void {
  if (queryNode.name == 'QueryStatement') queryNode = queryNode.getChild('QueryExpression')!
  return analyzeQueryExpression(queryNode.getChild('QueryExpression') || queryNode, outerCtes)
}

function analyzeQueryExpression(queryNode: SyntaxNode, outerCtes?: Table[]): Query | void {
  let ctes = new Map<string, CteTable>()
  let otherTables = [...(outerCtes || [])]
  let scope: Scope = {alias: '', fanoutPath: [], otherTables}

  // WITH clause - analyze each CTE. Store them on Scope, as they're accessible to later CTEs, and valid tables for the query to from/join
  let withClauses = queryNode.getChild('WithClause')?.getChildren('CteDef') || []
  for (let cteDef of withClauses) {
    let name = txt(cteDef.getChild('Alias'))
    let query = analyzeQuery(cteDef.getChild('QueryExpression')!, scope.otherTables)
    if (!query) return
    let columns = query.fields.map(f => ({name: f.name, type: f.type, metadata: f.metadata}) as Column)
    let cte: CteTable = {name, type: 'cte', tablePath: name, columns, joins: [], query}
    ctes.set(name, cte)
    scope.otherTables!.push(cte)
  }

  if (queryNode.getChildren('SetOperator').length) return analyzeSetQuery(queryNode, scope, ctes)
  return analyzeSimpleQuery(queryNode.getChild('SimpleQuery')!, queryNode, scope, ctes)
}

function analyzeSimpleQuery(simpleNode: SyntaxNode, queryNode: SyntaxNode, parentScope: Scope, ctes: Map<string, CteTable>): Query | void {
  let query: Query = {sql: '', fields: [], joins: [], filters: [], groupBy: [], orderBy: []}
  let scope: Scope = {...parentScope, query}
  let isAgg = false
  let fanoutExprs: {node: SyntaxNode; expr: Expr}[] = []

  // FROM / JOIN
  // We represent both as `joins` on the query, since they're conceptually similar for most of analysis
  let fromClause = simpleNode.getChild('FromClause')
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
      let subquery = analyzeQuery(tablePrimary.getChild('SubqueryExpression')!.getChild('QueryExpression')!, scope.otherTables)
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
    let onExpr = sourceNode.getChild('Expression') || undefined
    let qj: QueryJoin = {alias, source: isJoin ? 'ad-hoc' : 'from', table, joinType, fanoutPath: [], onExpr}
    query.joins.push(qj)
    NODE_ENTITY_MAP.set(tablePrimary, {entityType: 'table', table})

    // If this is a JOIN, analyze the ON expr
    // It's important we do this _after_ adding the join to the query, since analyzing the expression looks at the query
    if (joinType == 'cross' && onExpr) return diag(sourceNode, 'CROSS JOIN cannot have an ON clause')
    if (isJoin && !onExpr && joinType != 'cross') return diag(sourceNode, `${joinType!.toUpperCase()} JOIN requires an ON clause`)
    qj.onClause = onExpr && analyzeExpr(onExpr, {query, alias: '', otherTables: scope.otherTables}).sql
  }

  // SELECT clause
  let selects = simpleNode.getChild('SelectClause')?.getChildren('SelectItem') || []
  let isDistinct = !!txt(simpleNode.getChild('SelectClause')).toLowerCase().startsWith('select distinct')

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
      let exprNode = s.getChild('Expression')!
      let aliasNode = s.getChild('Alias')
      let expr = analyzeExpr(exprNode, scope)
      if (expr.type == 'interval' && expr.interval?.form == 'scaled') diag(exprNode, 'Multiplied intervals are only supported inside date/time arithmetic')
      let name = aliasNode ? txt(aliasNode) : inferName(exprNode, scope)
      isAgg ||= !!expr.isAgg
      query.fields.push({
        name,
        sql: expr.sql,
        type: expr.type,
        isAgg: expr.isAgg,
        fanout: expr.fanout,
        definitionLocation: locationForNode(aliasNode || exprNode),
      })
      fanoutExprs.push({node: exprNode, expr})
    }
  }

  // WHERE / HAVING - we allow aggregate filters in WHERE (moved to HAVING automatically)
  let whereNode = simpleNode.getChild('WhereClause')?.getChild('Expression')
  let havingNode = simpleNode.getChild('HavingClause')?.getChild('Expression')
  for (let node of [whereNode, havingNode]) {
    if (!node) continue
    for (let expr of unpackAnds(node, scope)) {
      query.filters.push({sql: expr.sql, isAgg: expr.isAgg})
      fanoutExprs.push({node, expr})
    }
  }

  // GROUP BY - adds fields if not already selected
  let groupBys = simpleNode.getChild('GroupByClause')?.getChildren('SelectItem') || []
  for (let g of groupBys) {
    let exprNode = g.getChild('Expression')!
    let alias = txt(g.getChild('Alias'))

    // Positional GROUP BY (e.g. `group by 2, 1`) references the current SELECT list.
    if (exprNode.name == 'Number' && !alias) {
      let f = query.fields[Number(txt(exprNode)) - 1]
      if (!f) diag(g, 'No field at index ' + txt(exprNode))
      query.groupBy.push(f?.name)
    } else {
      // Otherwise, we can assume this is an expression (possibly with an alias)
      // If that expression is already in the selected fields, it's just a reference.
      let expr = analyzeExpr(exprNode, scope)
      if (expr.isAgg) diag(g, 'Cannot group by aggregate expressions')
      let name = g.getChild('Alias') ? txt(g.getChild('Alias')) : inferName(exprNode, scope)
      query.groupBy.push(name)

      // If it's not in there, add it to the select.
      if (!query.fields.find(f => f.name == name)) {
        query.fields.unshift({name, sql: expr.sql, type: expr.type, fanout: expr.fanout, definitionLocation: locationForNode(g.getChild('Alias') || exprNode)})
      }
      fanoutExprs.push({node: g.getChild('Expression')!, expr})
    }
  }

  // If there are agg fields but no groupBy, automatically group by all non-agg fields
  let nonAggFields = query.fields.filter(f => !f.isAgg)
  if (query.groupBy.length == 0 && (isDistinct || nonAggFields.length < query.fields.length)) {
    query.groupBy = nonAggFields.map(f => f.name)
  }

  // ORDER BY
  let {orderBy, limit} = analyzeOrderAndLimit(queryNode, query)

  // Implicit `select *` if nothing selected (only when we have a base table)
  let baseJoin = query.joins.find(j => j.source == 'from')
  if (query.fields.length == 0 && baseJoin?.table) {
    let hasAdHoc = query.joins.some(j => j.source == 'ad-hoc')
    expandColumns(hasAdHoc ? null : baseJoin.table, baseJoin.alias, query, scope)
  }

  // Default ORDER BY for aggregate queries
  if (orderBy.length == 0 && query.groupBy.length > 0) {
    let firstAggIdx = query.fields.findIndex(f => f.isAgg)
    if (firstAggIdx >= 0) {
      orderBy.push({idx: firstAggIdx + 1, desc: true})
    } else {
      orderBy.push({idx: 1, desc: false}) // SELECT DISTINCT
    }
  }
  query.orderBy = orderBy
  query.limit = limit
  if (isAgg) {
    fanoutExprs.forEach(({node, expr}) => analyzeAggregateQueryExpr(node, expr))
    analyzeAggregateQueryFanout(fanoutExprs)
  }
  query.sql = buildSql(query, ctes)
  return query
}

function analyzeSetQuery(queryNode: SyntaxNode, scope: Scope, ctes: Map<string, CteTable>): Query | void {
  let branches = [
    {query: analyzeSimpleQuery(queryNode.getChild('SimpleQuery')!, queryNode.getChild('SimpleQuery')!, scope, new Map()), parenthesized: false},
    ...queryNode.getChildren('SetOperand').map(node => analyzeSetOperand(node, scope)),
  ]

  let first = branches[0].query
  if (!first) return
  for (let branch of branches.slice(1)) {
    if (!branch.query) return
    if (branch.query.fields.length != first.fields.length) return diag(queryNode, 'Set operation branches must return the same number of columns')
  }

  let setOps = queryNode.getChildren('SetOperator')
  let query: Query = {
    sql: '',
    fields: first.fields.map(field => ({...field})),
    joins: [],
    filters: [],
    groupBy: [],
    orderBy: [],
    setOp: txt(setOps[0]).toLowerCase() as Query['setOp'],
    branches: branches as {query: Query; parenthesized?: boolean}[],
  }

  for (let opNode of setOps.slice(1)) {
    let op = txt(opNode).toLowerCase()
    if (op != query.setOp) return diag(opNode, 'Mixed set operators require parentheses')
  }

  let {orderBy, limit} = analyzeOrderAndLimit(queryNode, query)
  query.orderBy = orderBy
  query.limit = limit
  query.sql = buildSql(query, ctes)
  return query
}

function analyzeSetOperand(node: SyntaxNode, scope: Scope) {
  let subqueryNode = node.getChild('SubqueryExpression')
  if (subqueryNode) return {query: analyzeQuery(subqueryNode.getChild('QueryExpression')!, scope.otherTables), parenthesized: true}
  return {query: analyzeSimpleQuery(node.getChild('SimpleQuery')!, node.getChild('SimpleQuery')!, scope, new Map()), parenthesized: false}
}

function analyzeOrderAndLimit(queryNode: SyntaxNode, query: Query) {
  let orderBys = queryNode.getChild('OrderByClause')?.getChildren('OrderItem') || []
  let orderBy: {idx: number; desc: boolean}[] = []
  for (let o of orderBys) {
    let fieldRef = txt(o.getChild('Identifier')) || txt(o.getChild('Number'))
    let desc = txt(o.getChild('Kw')).toLowerCase() == 'desc'
    let idx = Number(fieldRef) || query.fields.findIndex(f => f.name == fieldRef) + 1
    if (idx > 0) orderBy.push({idx, desc})
    else if (fieldRef && isNaN(Number(fieldRef))) diag(o, `Unknown field in ORDER BY: ${fieldRef}`)
  }

  let limitNodes = queryNode.getChild('LimitClause')?.getChildren('Number') || []
  let limit = limitNodes[0] ? Number(txt(limitNodes[0])) : undefined
  if (limitNodes[1]) diag(limitNodes[1], 'OFFSET is not supported yet')
  return {orderBy, limit}
}

// Assemble query parts into final SQL
// Format a table path for the current dialect
function formatTablePath(path: string): string {
  if (config.dialect === 'bigquery') return `\`${path}\``
  if (config.dialect === 'snowflake') return path.toUpperCase()
  return path
}

function buildSql(query: Query, cteMap: Map<string, CteTable>): string {
  let ctes: string[] = [...cteMap.values()].map(c => `${c.name} as ( ${c.query.sql} )`)

  if (query.setOp) {
    let branches = (query.branches || []).map(branch => {
      let sql = branch.query.sql
      return branch.parenthesized ? `( ${sql} )` : sql
    })
    let op = query.setOp!.toUpperCase()
    let sql = branches.join(` ${op} `)
    if (query.orderBy.length) {
      let parts = query.orderBy.map(o => `${o.idx} ${o.desc ? 'desc' : 'asc'} NULLS LAST`)
      sql += ` ORDER BY ${parts.join(',')}`
    }
    if (query.limit) sql += ` LIMIT ${query.limit}`
    if (ctes.length) sql = `WITH ${ctes.join(', ')} ${sql}`
    return sql
  }

  let selectParts = query.fields.map(f => `${f.sql} as ${f.name}`)
  let baseJoin = query.joins.find(j => j.source == 'from')

  // No FROM clause (e.g. `select 1`)
  if (!baseJoin?.table) return `SELECT ${selectParts.join(', ')}`

  function renderTableRef(table: Table): string {
    if (table.type === 'view') {
      if (!ctes.some(c => c.startsWith(table.name + ' '))) {
        ctes.push(`${table.name} as ( ${table.query.sql} )`)
      }
      return table.name
    }
    if (table.type === 'subquery') return `( ${table.query.sql} )`
    return formatTablePath(table.tablePath)
  }

  let fromTable = renderTableRef(baseJoin.table)
  let joinClauses = query.joins
    .filter(j => j.source != 'from')
    .map(j => {
      if (!j.table || !j.joinType) return ''
      let tablePath = renderTableRef(j.table)
      let keyword = j.joinType.toUpperCase() + ' JOIN'
      if (j.joinType == 'cross') return `${keyword} ${tablePath} as ${j.alias}`
      return `${keyword} ${tablePath} as ${j.alias} ON ${j.onClause}`
    })
    .filter(Boolean)

  let whereFilters = query.filters.filter(f => !f.isAgg).map(f => f.sql)
  let havingFilters = query.filters.filter(f => f.isAgg).map(f => f.sql)
  let groupByIndices = query.groupBy.map(g => query.fields.findIndex(f => f.name == g) + 1)

  let sql = `SELECT ${selectParts.join(', ')} FROM ${fromTable} as ${baseJoin.alias}`
  if (joinClauses.length) sql += ' ' + joinClauses.join(' ')
  if (whereFilters.length) sql += ` WHERE ${whereFilters.join(' AND ')}`
  if (groupByIndices.length) sql += ` GROUP BY ${groupByIndices.join(',')}`
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
export function analyzeExpr(node: SyntaxNode, scope: Scope): Expr {
  if (node.type.isError) return diag(node, 'Invalid expression', {sql: 'NULL', type: 'error'})

  switch (node.name) {
    case 'Number':
      return {sql: txt(node), type: 'number'}
    case 'Boolean':
      return {sql: txt(node).toLowerCase(), type: 'boolean'}
    case 'Null':
      return {sql: 'NULL', type: 'null'}
    case 'String':
      return {sql: `'${txt(node).slice(1, -1).replace(/'/g, "''")}'`, type: 'string'}
    case 'Param':
      return {sql: txt(node), type: 'string'} // $param - type inferred later

    case 'Ref': {
      let pathNodes = node.getChildren('Identifier')
      let fieldNode = pathNodes.pop()!
      let fieldName = txt(fieldNode)

      // Check output fields first when we're at the query root (e.g. HAVING/post-agg filters).
      // Don't do this while resolving table expressions, or we can accidentally bind to sibling
      // SELECT aliases instead of the table's computed columns.
      if (scope.query && !scope.table && pathNodes.length == 0) {
        let outField = scope.query.fields.find(f => f.name == fieldName)
        if (outField) return {sql: outField.sql, type: outField.type, isAgg: outField.isAgg, fanout: outField.fanout}
      }

      // Follow any dot path (e.g., `users.orders` in `users.orders.amount`), then find the field
      let targetScope = followJoins(pathNodes, scope)
      if (!targetScope) return {sql: 'NULL', type: 'error'}

      // Build the list of tables to search: if followJoins landed on a specific table, just that one.
      // Otherwise, search all tables either in FROM or explicitly JOINed (but not implicitly joined).
      let possibleJoins = targetScope.table
        ? [{table: targetScope.table, alias: targetScope.alias, fanoutPath: targetScope.fanoutPath}]
        : scope.query?.joins.filter(j => j.source != 'implicit' && j.table).map(j => ({table: j.table!, alias: j.alias, fanoutPath: j.fanoutPath})) || []

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
      addReference('column', fieldNode, col.symbolId)

      // Simple case: this is just a regular column on a table
      if (!col.exprNode) return {sql: `${alias}.${col.name}`, type: col.type, fanout: normalizeExprFanout({path: matches[0].fanoutPath})}

      // Computed column: analyze its expression in the matched table's scope
      if (analysisStack.has(col)) return diag(col.exprNode, 'Cycles are not allowed between computed columns', {sql: 'NULL', type: 'error'})
      analysisStack.add(col)
      let expr = analyzeExpr(col.exprNode, {query: scope.query, table, alias, otherTables: scope.otherTables, fanoutPath: matches[0].fanoutPath})
      analysisStack.delete(col)
      return {
        sql: `(${expr.sql})`,
        type: expr.type,
        isAgg: expr.isAgg,
        fanout: expr.fanout,
      }
    }

    case 'FunctionCall':
      return analyzeFunction(node, scope, analyzeExpr)

    case 'WindowExpression': {
      let baseNode = node.getChild('FunctionCall') || node.getChild('Count')
      if (!baseNode) return diag(node, 'Window expressions require a function call', {sql: 'NULL', type: 'error'})
      let isPercentile = isPercentileFunctionCall(baseNode)
      if (isPercentile && !isPercentileWindowSpecSupported(node.getChild('OverClause')!)) {
        return diag(node.getChild('OverClause')!, 'pXX window form currently supports PARTITION BY only', {sql: 'NULL', type: 'error'})
      }
      let base = baseNode.name == 'FunctionCall' ? analyzeFunction(baseNode, scope, analyzeExpr, {isWindow: true}) : analyzeExpr(baseNode, scope)
      if (base.type == 'error') return base
      if (!base.canWindow) return diag(baseNode, 'Only aggregate or window functions can use OVER', {sql: 'NULL', type: 'error'})
      let over = renderOverClause(node.getChild('OverClause')!, scope)
      return {sql: `${base.sql} OVER (${over})`, type: base.type, isAgg: false}
    }

    case 'Parenthetical': {
      let inner = analyzeExpr(node.getChild('Expression')!, scope)
      return {...inner, sql: `(${inner.sql})`}
    }

    case 'Count': {
      let inner = node.getChild('Expression')
      if (inner) {
        let e = analyzeExpr(inner, scope)
        return {
          sql: `count(distinct ${e.sql})`,
          type: 'number',
          isAgg: true,
          canWindow: true,
          fanout: normalizeExprFanout({
            sensitivePaths: mergeSensitiveFanouts(e.fanout?.sensitivePaths),
            conflict: e.fanout?.conflict,
          }),
        }
      }
      return {
        sql: 'count(1)',
        type: 'number',
        isAgg: true,
        canWindow: true,
        fanout: normalizeExprFanout({sensitivePaths: [extendFanoutPath(scope.fanoutPath)]}),
      }
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
      if (op == '*') {
        let multiplied = analyzeIntervalMultiplication(left, right, node)
        if (multiplied) return multiplied
      }
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

      return mergeExprAnalysis([left, right], sql, resultType, left.isAgg || right.isAgg)
    }

    case 'UnaryExpression': {
      let op = txt(node.firstChild).toLowerCase()
      let child = analyzeExpr(node.lastChild!, scope)
      if (op == 'not') return {...child, sql: `NOT (${child.sql})`, type: 'boolean'}
      if (op == '-') return {...child, sql: `-(${child.sql})`}
      if (op == '+') return {...child, sql: `(${child.sql})`}
      return diag(node, `Unknown unary operator: ${op}`, {sql: 'NULL', type: 'error'})
    }

    case 'NullTestExpression': {
      let isNot = !!node.getChildren('Kw').find(n => txt(n).toLowerCase() == 'not')
      let e = analyzeExpr(node.firstChild!, scope)
      return {...e, sql: `${e.sql} IS ${isNot ? 'NOT ' : ''}NULL`, type: 'boolean'}
    }

    case 'CaseExpression': {
      let parts = ['CASE']
      let isAgg = false
      let fanoutExprs: Expr[] = []
      let caseValue = node.getChild('Expression')
      if (caseValue) {
        let e = analyzeExpr(caseValue, scope)
        parts.push(e.sql)
        isAgg ||= !!e.isAgg
        fanoutExprs.push(e)
      }

      let resultType: FieldType = 'string'
      for (let w of node.getChildren('WhenClause')) {
        let exprs = w.getChildren('Expression')
        let when = analyzeExpr(exprs[0], scope)
        let then = analyzeExpr(exprs[1], scope)
        resultType = then.type
        isAgg ||= !!when.isAgg || !!then.isAgg
        fanoutExprs.push(when, then)
        parts.push(`WHEN (${when.sql}) THEN ${then.sql}`)
      }

      let elseClause = node.getChild('ElseClause')
      if (elseClause) {
        let elseExpr = analyzeExpr(elseClause.getChild('Expression')!, scope)
        parts.push(`ELSE ${elseExpr.sql}`)
        isAgg ||= !!elseExpr.isAgg
        fanoutExprs.push(elseExpr)
      }
      parts.push('END')
      return mergeExprAnalysis(fanoutExprs, parts.join(' '), resultType, isAgg || undefined)
    }

    case 'InExpression': {
      let not = txt(node.getChild('Kw')).toLowerCase() == 'not'
      let e = analyzeExpr(node.firstChild!, scope)
      let valueList = node.getChild('InValueList')
      let subqueryNode = node.getChild('QueryExpression')
      if (subqueryNode) {
        let subquery = analyzeQuery(subqueryNode, scope.otherTables)
        if (!subquery) return {sql: 'NULL', type: 'error'}
        if (subquery.fields.length != 1) return diag(subqueryNode, 'Subquery in IN must return exactly one column', {sql: 'NULL', type: 'error'})
        return {...e, sql: `${e.sql} ${not ? 'NOT IN' : 'IN'} (${subquery.sql})`, type: 'boolean'}
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
      return {...e, sql: `${e.sql} ${not ? 'NOT IN' : 'IN'} (${values.join(',')})`, type: 'boolean'}
    }

    case 'BetweenExpression': {
      let not = !!node
        .getChildren('Kw')
        .map(n => txt(n).toLowerCase())
        .find(k => k == 'not')
      let [eNode, lowNode, highNode] = node.getChildren('Expression')
      let [e, low, high] = [eNode, lowNode, highNode].map(n => analyzeExpr(n, scope))

      if (e.type == 'date' || e.type == 'timestamp') {
        low = coerceToTemporal(low, e.type, lowNode)
        high = coerceToTemporal(high, e.type, highNode)
      }

      let sql = `${e.sql} ${not ? 'NOT BETWEEN' : 'BETWEEN'} ${low.sql} AND ${high.sql}`
      return mergeExprAnalysis([e, low, high], sql, 'boolean', e.isAgg || low.isAgg || high.isAgg)
    }

    case 'SubqueryExpression': {
      let subquery = analyzeQuery(node.getChild('QueryExpression')!, scope.otherTables)
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
      return {...e, sql: `CAST(${e.sql} AS ${targetType})`, type: resultType}
    }

    case 'ExtractExpression': {
      let extractInner = node.getChild('Expression')!
      let e = analyzeExpr(extractInner, scope)
      checkTypes(e, ['date', 'timestamp'], extractInner)
      let unit = txt(node.getChild('ExtractUnit')!)
        .replace(/^['"]|['"]$/g, '')
        .toLowerCase()
      return {...e, sql: `EXTRACT(${unit} FROM ${e.sql})`, type: 'number'}
    }

    case 'IntervalExpression': {
      let stringNode = node.getChild('String')
      if (stringNode) {
        let parsed = parseIntervalLiteral(txt(stringNode).slice(1, -1))
        if (!parsed) return diag(stringNode, 'Could not parse interval', {sql: 'NULL', type: 'error'})
        return {
          sql: `interval ${parsed.quantity} ${parsed.unit}`,
          type: 'interval',
          interval: {quantitySql: String(parsed.quantity), unit: parsed.unit, form: 'constant'},
        }
      }
      let quantityNode = node.getChild('Number') || node.getChild('Ref')
      if (!quantityNode) return diag(node, 'Interval requires a quantity before the unit', {sql: 'NULL', type: 'error'})
      let quantity = analyzeExpr(quantityNode, scope)
      checkTypes(quantity, ['number'], quantityNode)
      let unit = parseIntervalUnit(txt(node.getChild('IntervalUnit')!).toLowerCase())
      if (!unit) return diag(node, 'Invalid interval unit', {sql: 'NULL', type: 'error'})
      return {...quantity, sql: `INTERVAL ${quantity.sql} ${unit}`, type: 'interval', interval: {quantitySql: quantity.sql, unit, form: quantityNode.name == 'Number' ? 'constant' : 'dynamic'}}
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

function analyzeDateArithmetic(op: '+' | '-', left: Expr, right: Expr, node: SyntaxNode): Expr {
  let merged = mergeExprAnalysis([left, right], '', 'number', left.isAgg || right.isAgg)

  // date - date = interval
  if ((left.type == 'date' || left.type == 'timestamp') && (right.type == 'date' || right.type == 'timestamp')) {
    if (op != '-') return diag(node, 'Can only subtract dates', {sql: 'NULL', type: 'error'})
    let unit = left.type == 'timestamp' ? 'SECOND' : 'DAY'
    if (config.dialect == 'bigquery') {
      return {...merged, sql: `TIMESTAMP_DIFF(${left.sql}, ${right.sql}, ${unit})`, type: 'number'}
    }
    if (config.dialect == 'snowflake') {
      return {...merged, sql: `TIMESTAMPDIFF(${unit}, ${right.sql}, ${left.sql})`, type: 'number'}
    }
    return {...merged, sql: `DATE_DIFF('${unit.toLowerCase()}', ${right.sql}, ${left.sql})`, type: 'number'}
  }

  // date +/- interval
  if ((left.type == 'date' || left.type == 'timestamp') && right.type == 'interval') {
    if (!right.interval) return diag(node, 'Invalid interval expression', {sql: 'NULL', type: 'error'})
    return {...merged, sql: renderTemporalArithmetic(config.dialect, left.sql, left.type, op, right.interval), type: left.type}
  }

  // interval + date (normalize to date + interval)
  if (left.type == 'interval' && (right.type == 'date' || right.type == 'timestamp')) {
    if (op == '-') return diag(node, 'Cannot subtract date from interval', {sql: 'NULL', type: 'error'})
    if (!left.interval) return diag(node, 'Invalid interval expression', {sql: 'NULL', type: 'error'})
    return {...merged, sql: renderTemporalArithmetic(config.dialect, right.sql, right.type, '+', left.interval), type: right.type}
  }

  return diag(node, 'Invalid date arithmetic', {sql: 'NULL', type: 'error'})
}

function analyzeIntervalMultiplication(left: Expr, right: Expr, node: SyntaxNode): Expr | null {
  if (left.type == 'number' && right.type == 'interval') {
    return scaleInterval(left, right, node.lastChild!)
  }
  if (left.type == 'interval' && right.type == 'number') {
    return scaleInterval(right, left, node.firstChild!)
  }
  return null
}

function scaleInterval(multiplier: Expr, intervalExpr: Expr, node: SyntaxNode): Expr {
  if (!intervalExpr.interval) return diag(node, 'Invalid interval expression', {sql: 'NULL', type: 'error'})
  if (intervalExpr.interval.form != 'constant') return diag(node, 'Only literal intervals can be multiplied', {sql: 'NULL', type: 'error'})
  let quantitySql = intervalExpr.interval.quantitySql == '1' ? multiplier.sql : `${multiplier.sql}*${intervalExpr.interval.quantitySql}`
  return {
    sql: renderStandaloneInterval(config.dialect, {quantitySql, unit: intervalExpr.interval.unit, form: 'scaled'}),
    type: 'interval',
    isAgg: multiplier.isAgg || intervalExpr.isAgg,
    interval: {quantitySql, unit: intervalExpr.interval.unit, form: 'scaled'},
  }
}

function coerceToTemporal(expr: Expr, targetType: 'date' | 'timestamp', node: SyntaxNode): Expr {
  // Extract the string literal value (remove quotes)
  let match = expr.sql.match(/^'(.+)'$/)
  if (!match) return expr
  let parsed = parseTemporalLiteral(match[1], targetType)
  if (!parsed) {
    diag(node, `Cannot parse as ${targetType}: ${expr.sql}`)
    return expr
  }
  return {...expr, sql: `${targetType.toUpperCase()} '${parsed.literal}'`, type: targetType}
}

function isPercentileFunctionCall(node: SyntaxNode): boolean {
  if (node.name != 'FunctionCall') return false
  let name = txt(node.getChild('Identifier')).toLowerCase()
  return /^p\d+$/.test(name)
}

function isPercentileWindowSpecSupported(overClause: SyntaxNode): boolean {
  let spec = overClause.getChild('WindowSpec')
  if (!spec) return true
  if (spec.getChild('WindowOrderByClause')) return false
  if (spec.getChild('WindowFrameClause')) return false
  return true
}

function renderOverClause(overClause: SyntaxNode, scope: Scope): string {
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

function renderWindowFrame(frame: SyntaxNode, scope: Scope): string {
  let mode = txt(frame.getChildren('Kw')[0]).toUpperCase()
  let between = frame.getChild('WindowFrameBetween')
  if (between) {
    let bounds = between.getChildren('WindowFrameBound').map(b => renderWindowBound(b, scope))
    return `${mode} BETWEEN ${bounds[0]} AND ${bounds[1]}`
  }
  let start = frame.getChild('WindowFrameStart')!.getChild('WindowFrameBound')!
  return `${mode} ${renderWindowBound(start, scope)}`
}

function renderWindowBound(bound: SyntaxNode, scope: Scope): string {
  let kws = bound.getChildren('Kw').map(k => txt(k).toLowerCase())
  if (kws.includes('unbounded')) {
    return `UNBOUNDED ${kws.includes('following') ? 'FOLLOWING' : 'PRECEDING'}`
  }
  if (kws.includes('current')) return 'CURRENT ROW'
  let expr = analyzeExpr(bound.getChild('Expression')!, scope).sql
  return `${expr} ${kws.includes('following') ? 'FOLLOWING' : 'PRECEDING'}`
}

// Traverse a join path (like `tableA.tableB.`), returning a new scope pointing to the target table. Adds implied joins to the query as it goes
function followJoins(pathNodes: SyntaxNode[], scope: Scope): Scope | null {
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
    addReference('table', pathNodes[0], table.symbolId)
    return {query: scope.query, table, alias, fanoutPath: scope.fanoutPath, otherTables: scope.otherTables}
  }

  // If scope is at the root of the table (ie scope.table == null), then the first part of the path could point at
  // the alias of any table in the FROM or JOIN clauses of a query.
  // But it could also refer to a join _on_ one of those tables (assuming the name is unique).
  if (!scope.table) {
    // This could be a ref to an existing FROM/JOIN alias
    let existing = scope.query!.joins.find(j => j.alias == name)
    if (existing) {
      NODE_ENTITY_MAP.set(part, {entityType: 'table', table: existing.table})
      addReference('table', part, existing.table?.symbolId)
      scope = {...scope, table: existing.table!, alias: existing.alias, fanoutPath: existing.fanoutPath}
      pathNodes.shift() // remove, since we're updating scope
    } else {
      // otherwise, this might be referring to a join _on_ one of those FROM/JOIN tables
      let matches = scope.query!.joins.filter(j => j.table!.joins.some(jj => jj.alias == name))
      if (matches.length > 1) return diag(part, `"${name}" matches multiple possible joins in this query`, null)
      if (matches.length == 0) return diag(part, `Could not find "${name}" on query`, null)
      scope = {...scope, table: matches[0].table!, alias: matches[0].alias, fanoutPath: matches[0].fanoutPath}
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
    let fanoutPath = next.cardinality == 'many' ? extendFanoutPath(scope.fanoutPath, name) : extendFanoutPath(scope.fanoutPath)
    if (scope.query && !scope.query.joins.find(j => j.alias == newAlias)) {
      let joinTarget = {name: next.alias, table: next.table, alias: newAlias}
      let onClause = analyzeExpr(next.onExpr!, {table, alias, fanoutPath: scope.fanoutPath, joinTarget}).sql
      scope.query.joins.push({alias: newAlias, targetTable: next.targetTable, table: next.table, source: 'implicit', cardinality: next.cardinality, fanoutPath, joinType: 'left', onClause})
    }

    NODE_ENTITY_MAP.set(part, {entityType: 'table', table: next.table})
    addReference('table', part, next.table.symbolId)
    scope = {...scope, table: next.table, alias: newAlias, fanoutPath}
  }

  return scope
}

function mergeExprAnalysis(exprs: Expr[], sql: string, type: FieldType, isAgg?: boolean): Expr {
  let rowFanout = mergeFanoutPaths(exprs.map(expr => expr.fanout?.path))
  return {
    sql,
    type,
    isAgg,
    fanout: normalizeExprFanout({
      path: isAgg ? undefined : rowFanout.path,
      sensitivePaths: mergeSensitiveFanouts(...exprs.map(expr => expr.fanout?.sensitivePaths)),
      conflict: rowFanout.conflict || exprs.some(expr => expr.fanout?.conflict),
    }),
  }
}

function analyzeComputedFieldExpr(node: SyntaxNode, expr: Expr) {
  if (expr.fanout?.conflict) diag(node, 'Join graph creates a chasm trap')
  if (!expr.isAgg && !isBaseFanoutPath(expr.fanout?.path)) diag(node, fanoutMessage(expr.fanout?.path, 'aggregate it first'))
  let paths = uniqueFanoutPaths(expr.fanout?.sensitivePaths || [])
  if (paths.length > 1) {
    diag(node, multiGrainMessage(paths))
  }
}

function analyzeAggregateQueryExpr(node: SyntaxNode, expr: Expr) {
  if (expr.fanout?.conflict) diag(node, 'Join graph creates a chasm trap')
}

// Aggregate-query fanout diagnostics have to look at the query as a whole: first ensure
// any non-aggregate dimensions stay at the same grain as the aggregates, then classify the
// aggregate grains into the more specific cases we can explain clearly (chasm trap, a base
// aggregate fanned out by one join, an ancestor aggregate fanned out by a descendant join,
// or the generic join-graph fanout fallback).
function analyzeAggregateQueryFanout(exprs: {node: SyntaxNode; expr: Expr}[]) {
  let aggExprs = exprs.filter(entry => entry.expr.isAgg)
  let paths = uniqueFanoutPaths(aggExprs.flatMap(entry => entry.expr.fanout?.sensitivePaths || []))
  if (paths.length == 0) return

  let pathKeys = new Set(paths.map(path => fanoutPathKey(path)))

  // Non-aggregate dimensions are allowed only when they stay at the same grain
  // as every aggregate in the query. Otherwise, either the dimension is fanning
  // out a base-grain aggregate or it is grouping by the wrong join-many path.
  for (let entry of exprs) {
    if (entry.expr.isAgg || isBaseFanoutPath(entry.expr.fanout?.path)) continue

    let exprPathKey = fanoutPathKey(entry.expr.fanout?.path)
    if (pathKeys.size == 1 && pathKeys.has(exprPathKey)) continue

    // A join-many dimension can fan out an aggregate that otherwise lives at base grain.
    if (paths.length == 1 && isBaseFanoutPath(paths[0])) {
      for (let aggEntry of aggExprs) {
        let entryPaths = uniqueFanoutPaths(aggEntry.expr.fanout?.sensitivePaths || [])
        if (!entryPaths.some(path => isBaseFanoutPath(path))) continue
        diag(aggEntry.node, aggregateFanoutMessage(txt(aggEntry.node), entry.expr.fanout?.path))
      }
      continue
    }

    let targetPath = paths.length == 1 && isPrefix(entry.expr.fanout!.path!, paths[0]) ? paths[0] : entry.expr.fanout?.path
    diag(entry.node, fanoutMessage(targetPath, 'aggregate queries cannot group by it directly'))
  }

  if (paths.length <= 1) return

  let joinedPaths = paths.filter(path => !isBaseFanoutPath(path))

  // Sibling join-many branches produce a classic chasm trap.
  if (joinedPaths.length > 1 && isChasmTrap(joinedPaths)) {
    let message = multiGrainMessage(joinedPaths)
    for (let entry of aggExprs) {
      let entryPaths = uniqueFanoutPaths(entry.expr.fanout?.sensitivePaths || [])
      if (entryPaths.length == 0) continue
      diag(entry.node, message)
    }
    return
  }

  // One base-grain aggregate plus one joined grain means the base aggregate is fanned out.
  if (paths.length == 2 && joinedPaths.length == 1) {
    for (let entry of aggExprs) {
      let entryPaths = uniqueFanoutPaths(entry.expr.fanout?.sensitivePaths || [])
      if (!entryPaths.some(path => isBaseFanoutPath(path))) continue
      diag(entry.node, aggregateFanoutMessage(txt(entry.node), joinedPaths[0]))
    }
    return
  }

  // Ancestor/descendant join-many paths mean the shallower aggregate is fanned out by the deeper join.
  if (paths.length == 2 && joinedPaths.length == 2) {
    let [pathA, pathB] = joinedPaths
    let ancestor: typeof pathA | undefined
    let descendant: typeof pathA | undefined

    if (isPrefix(pathA, pathB)) {
      ancestor = pathA
      descendant = pathB
    } else if (isPrefix(pathB, pathA)) {
      ancestor = pathB
      descendant = pathA
    }

    if (ancestor && descendant) {
      let ancestorKey = fanoutPathKey(ancestor)
      let descendantKey = fanoutPathKey(descendant)

      for (let entry of aggExprs) {
        let entryPaths = uniqueFanoutPaths(entry.expr.fanout?.sensitivePaths || [])
        if (!entryPaths.some(path => fanoutPathKey(path) == ancestorKey) || entryPaths.some(path => fanoutPathKey(path) == descendantKey)) continue
        diag(entry.node, aggregateFanoutMessage(txt(entry.node), descendant))
      }
      return
    }
  }

  // Anything more complex falls back to the generic join-graph fanout diagnostic.
  let message = multiGrainMessage(paths)
  for (let entry of aggExprs) {
    let entryPaths = uniqueFanoutPaths(entry.expr.fanout?.sensitivePaths || [])
    if (entryPaths.length == 0) continue
    diag(entry.node, message)
  }
}

// Find a table by Ref node, failing if it doesn't exist
function lookupTable(node: SyntaxNode, scope?: Scope): Table | undefined {
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
  if (table.type == 'view' && !table.query) return
  addReference('table', node, table.symbolId)
  return table
}

function inferName(exprNode: SyntaxNode, scope: Scope): string {
  if (exprNode.name == 'Ref') {
    return exprNode
      .getChildren('Identifier')
      .map(i => txt(i))
      .join('_')
  }
  return `col_${scope.query?.fields.length || 0}`
}

// TODO: do we still need this?
function unpackAnds(node: SyntaxNode, scope: Scope): Expr[] {
  if (node.name == 'BinaryExpression') {
    let op = txt(node.firstChild?.nextSibling).toLowerCase()
    if (op == 'and') {
      return [...unpackAnds(node.firstChild!, scope), ...unpackAnds(node.lastChild!, scope)]
    }
  }
  return [analyzeExpr(node, scope)]
}

export function clearWorkspace() {
  Object.keys(FILE_MAP).forEach(k => delete FILE_MAP[k])
  diagnostics = []
}

export function clearDiagnostics() {
  diagnostics = []
}
export function getNodeEntity(node: SyntaxNode) {
  return NODE_ENTITY_MAP.get(node)
}

export function recordSyntaxErrors(fi: FileInfo) {
  fi.tree!.topNode.cursor().iterate(n => {
    if (n.type.isError) diag(n.node, 'Syntax error')
  })
}

export function diag<T>(node: SyntaxNode | SyntaxNodeRef, message: string, defaultReturn?: T): T {
  let file = getFile(node)
  let from = getPosition(node.from, file)
  let to = getPosition(node.to, file)
  diagnostics.push({severity: 'error', message, file: toRelativePath(file.path), from, to, frame: buildFrame(from, to)})
  return defaultReturn as T
}

export function checkTypes(expr: Expr, expected: FieldType[], node: SyntaxNode) {
  if (expr.type == 'error' || expr.type == 'null') return
  if (expected.includes(expr.type)) return
  diag(node, `Expected ${expected.join(' or ')}, got ${expr.type}`)
}

// Convert raw database types into simplified types. Malloy did this, I'm on the fence if we need it.
// On the one hand, it often makes type checking easier, since it normalizes things that can be implicitly cast to match,
// and gives simpler types to the frontend.
// On the other, it obscures the actual types in cases where they might be relevant, like function signature matching.
function convertDataType(dataType: string): FieldType | null {
  switch (dataType.toUpperCase()) {
    case 'INT':
    case 'INT64':
    case 'NUMBER':
    case 'INTEGER':
    case 'NUMERIC':
    case 'FLOAT':
    case 'FLOAT64':
    case 'DECIMAL':
    case 'DOUBLE':
    case 'BIGINT':
    case 'SMALLINT':
    case 'TINYINT':
    case 'BYTEINT':
    case 'BIGDECIMAL':
      return 'number'
    case 'VARIANT':
    case 'TEXT':
    case 'STRING':
    case 'VARCHAR':
    case 'GEOGRAPHY':
      return 'string'
    case 'BOOL':
    case 'BOOLEAN':
      return 'boolean'
    case 'DATE':
      return 'date'
    case 'DATETIME':
    case 'TIME':
    case 'TIMESTAMP':
    case 'TIMESTAMP_NTZ':
    case 'TIMESTAMP_TZ':
    case 'TIMESTAMP_LTZ':
      return 'timestamp'
    default:
      return null
  }
}
