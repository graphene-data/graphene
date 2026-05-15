import {type SyntaxNode, type SyntaxNodeRef} from '@lezer/common'

import type {GrapheneError} from './index.d.ts'

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
import {analyzeBareFunction, analyzeFunction} from './functions.ts'
import {parseMarkdown} from './markdown.ts'
import {extractLeadingMetadataDetails, validateMetadataEntries} from './metadata.ts'
import {parser} from './parser.js'
import {parseTemporalLiteral, parseIntervalLiteral, parseIntervalUnit, renderTemporalArithmetic, renderStandaloneInterval} from './temporal.ts'
import {inferTimeOrdinal} from './temporalMetadata.ts'
import {
  scalarType,
  type AnalysisConfig,
  type AnalysisResult,
  type AnalysisWorkspace,
  type FileInfo,
  type Query,
  type Table,
  type QueryJoin,
  type Column,
  type FieldType,
  type Expr,
  type CteTable,
  type JoinType,
  type Scope,
  type Location,
  type NavigationSymbolKind,
  type FieldMeta,
  formatType,
  isArrayType,
  isScalarType,
  parseGsqlFieldType,
  type TypeKind,
  type WorkspaceFileInput,
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

export function analyzeWorkspace(workspace: AnalysisWorkspace, targetPath?: string): AnalysisResult {
  return new AnalysisSession(workspace).analyze(targetPath)
}

export interface Analyzer {
  config: AnalysisConfig
  analyzeExpr(node: SyntaxNode, scope: Scope): Expr
  diag<T>(node: SyntaxNode | SyntaxNodeRef, message: string, defaultReturn?: T): T
  checkTypes(expr: Expr, expected: TypeKind[], node: SyntaxNode): void
}

class AnalysisSession implements Analyzer {
  config: AnalysisConfig
  files: FileInfo[]
  diagnostics: GrapheneError[] = []
  filesByPath: Record<string, FileInfo> = {}
  computedColumnStack = new Set<Column>() // Track computed columns being analyzed to detect cycles
  viewStack = new Set<Table>() // Also detect view cycles

  constructor(workspace: AnalysisWorkspace) {
    this.config = workspace.config
    this.files = workspace.files.map(file => this.createFile(file))
    this.filesByPath = Object.fromEntries(this.files.map(file => [file.path, file]))
  }

  analyze(targetPath?: string): AnalysisResult {
    this.files.forEach(file => {
      file.tree!.fileInfo = file
      this.recordSyntaxErrors(file)
      this.findTables(file)
    })
    this.files.forEach(file => this.applyExtends(file))

    if (targetPath) {
      let target = this.fileForPath(targetPath)
      if (!target) return {files: this.files, diagnostics: this.diagnostics}
      target.tables.forEach(table => this.analyzeTableFully(table))
      let nodes = target.tree!.topNode.getChildren('QueryStatement') || []
      target.queries = nodes.map(node => this.analyzeQuery(node)).filter((query): query is Query => !!query)
      return {files: this.files, diagnostics: this.diagnostics}
    }

    this.files.flatMap(file => file.tables).forEach(table => this.analyzeTableFully(table))
    this.files.forEach(file => {
      let nodes = file.tree!.topNode.getChildren('QueryStatement') || []
      file.queries = nodes.map(node => this.analyzeQuery(node)).filter((query): query is Query => !!query)
    })

    return {files: this.files, diagnostics: this.diagnostics}
  }

  private createFile(file: WorkspaceFileInput): FileInfo {
    let parsed = file.parsed || this.parseFile(file)
    let next = {
      path: file.path,
      contents: file.contents,
      tree: parsed.tree,
      tables: [],
      queries: [],
      navigation: {symbols: [], references: []},
      virtualContents: parsed.virtualContents,
      virtualToMarkdownOffset: parsed.virtualToMarkdownOffset,
      parsedDiagnostics: parsed.diagnostics,
    } as FileInfo
    next.tree!.fileInfo = next
    this.recordParsedDiagnostics(next, parsed.diagnostics || [])
    return next
  }

  private parseFile(file: WorkspaceFileInput) {
    let kind = file.kind || (file.path.endsWith('.md') ? 'md' : 'gsql')
    if (kind == 'md') return parseMarkdown(file)
    return {tree: parser.parse(file.contents)}
  }

  private fileForPath(path: string) {
    return this.filesByPath[path]
  }

  private locationForNode(node: SyntaxNode): Location {
    let file = getFile(node)
    return {file: file.path, from: getPosition(node.from, file), to: getPosition(node.to, file)}
  }

  private symbolId(kind: NavigationSymbolKind, location: Location, scopeKey = '') {
    let suffix = scopeKey ? `:${scopeKey}` : ''
    return `${kind}:${location.file}:${location.from.offset}:${location.to.offset}${suffix}`
  }

  private extractMetadata(node: SyntaxNode) {
    let details = extractLeadingMetadataDetails(node)
    let file = getFile(node)
    for (let diagnostic of validateMetadataEntries(details.entries)) {
      this.diagRange(file, diagnostic.from, diagnostic.to, diagnostic.message)
    }
    return details.metadata
  }

  private renderTableHover(table: Table) {
    let desc = table.metadata?.description ? `\n\n${table.metadata.description}` : ''
    return `#### ${table.name}${desc}`
  }

  private renderFieldHover(table: Table, field: Column) {
    let desc = field.metadata?.description ? `\n\n${field.metadata.description}` : ''
    return `#### ${table.name}.${field.name}${desc}`
  }

  private addSymbol(kind: NavigationSymbolKind, node: SyntaxNode, name: string, opts: {tableId?: string; scopeKey?: string; hover?: string} = {}) {
    let file = getFile(node)
    let location = this.locationForNode(node)
    let id = this.symbolId(kind, location, opts.scopeKey)
    file.navigation.symbols.push({id, kind, name, location, tableId: opts.tableId, hover: opts.hover})
    return {symbolId: id, location}
  }

  private addReference(kind: NavigationSymbolKind, node: SyntaxNode, targetId?: string) {
    if (!targetId) return
    let file = getFile(node)
    file.navigation.references.push({kind, targetId, location: this.locationForNode(node)})
  }

  // Creates tables without analyzing them.
  findTables(fi: FileInfo) {
    let tn = fi.tree!.topNode
    fi.tables = []
    let nodes = tn.getChildren('TableStatement').concat(tn.getChildren('ViewStatement'))
    for (let syntaxNode of nodes) {
      let refNode = syntaxNode.getChild('Ref')!
      let name = txt(refNode)

      let existing = this.files.find(file => {
        if (file.path.endsWith('.md') && file.path != fi.path) return
        return file.tables.find(table => table.name == name)
      })
      if (existing) this.diag(refNode, `Table "${name}" is already defined`)

      let hasNamespace = name.includes('.')
      let tablePath = !hasNamespace && this.config.defaultNamespace ? `${this.config.defaultNamespace}.${name}` : name
      let type = syntaxNode.getChild('QueryExpression') ? 'view' : ('table' as const)
      let table = {name, type, tablePath, filePath: fi.path, columns: [], joins: [], metadata: this.extractMetadata(syntaxNode), syntaxNode} as Table
      Object.assign(table, this.addSymbol('table', refNode, name, {hover: this.renderTableHover(table)}))

      syntaxNode.getChildren('ColumnDef').forEach(node => this.addColumn(table, node))
      syntaxNode.getChildren('JoinDef').forEach(node => this.addJoin(table, node))
      syntaxNode.getChildren('ComputedDef').forEach(node => this.addComputedColumn(table, node))

      fi.tables.push(table)
    }
  }

  // `extend` blocks add columns and joins to existing tables
  applyExtends(fi: FileInfo) {
    fi.tree!.topNode.getChildren('ExtendStatement').forEach(node => {
      let target = this.lookupTable(node.getChild('Ref')!)
      if (!target) return
      node.getChildren('JoinDef').forEach(join => this.addJoin(target, join))
      node.getChildren('ComputedDef').forEach(col => this.addComputedColumn(target, col))
    })
  }

  private addColumn(table: Table, node: SyntaxNode) {
    let nameNode = node.getChild('ColumnName')!
    let name = txt(nameNode)
    let parsed = parseGsqlFieldType(txt(node.getChild('DataType')))
    if (parsed.error) return this.diag(node, parsed.error)
    if (!parsed.type) return this.diag(node, `Unsupported data type: ${txt(node.getChild('DataType'))}`)
    let type = parsed.type
    let col: Column = {name, type, metadata: this.extractMetadata(node)}
    Object.assign(col, this.addSymbol('column', nameNode, name, {tableId: table.symbolId, hover: this.renderFieldHover(table, col)}))
    if (this.getField(name, table)) return this.diag(node, `Table already has a field called "${name}"`)
    table.columns.push(col)
  }

  private addJoin(table: Table, node: SyntaxNode) {
    let aliasNode = node.getChild('Alias') || node.getChild('Ref')!.getChildren('Identifier').pop()
    let alias = txt(aliasNode)

    let joinTypeStr = txt(node.getChild('JoinType')).replace(/\s+/g, ' ')
    let cardinality = {'join many': 'many', 'join one': 'one'}[joinTypeStr] as 'one' | 'many'
    if (!cardinality) return this.diag(node, 'Unknown join type')

    let targetNode = node.getChild('Ref')!
    let targetTable = txt(targetNode)
    let onExpr = node.getChild('BinaryExpression')!

    let join: QueryJoin = {alias, source: 'implicit', targetTable, cardinality, onExpr, targetNode}
    if (this.getField(alias, table)) return this.diag(node, `Table already has a field called "${alias}"`)
    table.joins.push(join)
  }

  private addComputedColumn(table: Table, node: SyntaxNode) {
    let nameNode = node.getChild('Alias')!
    let name = txt(nameNode)
    let col: Column = {name, type: scalarType('string'), exprNode: node.getChild('Expression')!, metadata: this.extractMetadata(node)}
    Object.assign(col, this.addSymbol('column', nameNode, name, {tableId: table.symbolId, hover: this.renderFieldHover(table, col)}))
    if (this.getField(name, table)) return this.diag(node, `Table already has a field called "${name}"`)
    table.columns.push(col)
  }

  private getField(name: string, table: Table) {
    return table.columns.find(col => col.name == name) || table.joins.find(join => join.alias == name)
  }

  // Analyze a view's underlying query to determine its output columns.
  // Converts a PhysicalTable with a QueryStatement into a ViewTable with a query.
  // If analysis succeeds, populates the view's query and output columns.
  private analyzeView(table: Table) {
    if (table.type != 'view') return
    if (table.query) return
    if (this.viewStack.has(table)) {
      this.diag(table.syntaxNode?.getChild('Ref') || table.syntaxNode!, 'Cycles are not allowed between views')
      return
    }
    this.viewStack.add(table)

    let query = this.analyzeQuery(table.syntaxNode!.getChild('QueryExpression')!)
    this.viewStack.delete(table)
    if (!query) return

    let file = this.fileForPath(table.filePath)
    let viewCols = query.fields.map(field => {
      let col = {name: field.name, type: field.type, metadata: field.metadata, location: field.definitionLocation} as Column
      if (field.definitionLocation) {
        col.symbolId = this.symbolId('column', field.definitionLocation, `${table.symbolId}:${field.name}`)
        file.navigation.symbols.push({id: col.symbolId, kind: 'column', name: col.name, location: field.definitionLocation, tableId: table.symbolId, hover: this.renderFieldHover(table, col)})
      }
      return col
    })
    table.columns.push(...viewCols)
    table.query = query
  }

  // Analyze everything in a table - used for full project analysis (e.g., `check` command)
  analyzeTableFully(table: Table) {
    if (table.type == 'view') this.analyzeView(table)
    let file = this.fileForPath(table.filePath)
    let scope: Scope = {file, table, alias: table.name, fanoutPath: []}
    table.columns.forEach(col => {
      if (!col.exprNode) return
      let expr = this.analyzeExpr(col.exprNode, scope)
      col.type = expr.type
      col.isAgg = expr.isAgg
      this.analyzeComputedFieldExpr(col.exprNode, expr)
    })
    table.joins.forEach(join => {
      join.table = this.lookupTable(join.targetNode!)
      if (!join.table || !join.onExpr) return
      let joinTarget = {name: join.alias, table: join.table, alias: join.alias}
      this.analyzeExpr(join.onExpr, {file, table, alias: table.name, fanoutPath: [], joinTarget})
    })
  }

  // Expand non-aggregate columns into query fields.
  // When table is provided, expands that single table's columns.
  // When table is null, expands all root-visible query tables (base + ad-hoc joins).
  private expandColumns(table: Table | null, alias: string, query: Query, scope: Scope, namePrefix = '') {
    if (!table) {
      let baseJoin = query.joins.find(join => join.source == 'from')
      if (!baseJoin?.table) return
      this.expandColumns(baseJoin.table, baseJoin.alias, query, scope)
      for (let join of query.joins.filter(join => join.source == 'ad-hoc')) {
        if (join.table) this.expandColumns(join.table, join.alias, query, scope, join.alias)
      }
      return
    }

    let file = this.fileForPath(table.filePath)
    for (let col of table.columns) {
      let outName = namePrefix ? `${namePrefix}_${col.name}` : col.name
      if (col.exprNode) {
        // Determine if aggregate (without query context to avoid side-effect diagnostics), then skip measures
        if (col.isAgg == null) col.isAgg = this.analyzeExpr(col.exprNode, {file, table, alias, fanoutPath: scope.fanoutPath}).isAgg
        if (col.isAgg) continue
        let expr = this.analyzeExpr(col.exprNode, {file, query: scope.query, table, alias, otherTables: scope.otherTables, fanoutPath: scope.fanoutPath})
        if (isScalarType(expr.type, 'interval') && expr.interval?.form == 'scaled') this.diag(col.exprNode, 'Multiplied intervals are only supported inside date/time arithmetic')
        this.addQueryField(query, {
          name: outName,
          sql: expr.sql,
          type: expr.type,
          metadata: {...expr.metadata, ...col.metadata},
          fanout: expr.fanout,
          definitionLocation: col.location,
          diagNode: col.exprNode || table.syntaxNode,
        })
      } else {
        this.addQueryField(query, {
          name: outName,
          sql: `${alias}.${col.name}`,
          type: col.type,
          metadata: col.metadata,
          fanout: normalizeExprFanout({path: scope.fanoutPath}),
          definitionLocation: col.location,
          diagNode: table.syntaxNode,
        })
      }
    }
  }

  // Main query analysis - analyzes and returns a Query with computed SQL
  analyzeQuery(queryNode: SyntaxNode, outerCtes?: Table[]): Query | void {
    if (queryNode.name == 'QueryStatement') queryNode = queryNode.getChild('QueryExpression')!
    return this.analyzeQueryExpression(queryNode.getChild('QueryExpression') || queryNode, getFile(queryNode), outerCtes)
  }

  private analyzeQueryExpression(queryNode: SyntaxNode, file: FileInfo, outerCtes?: Table[]): Query | void {
    let ctes = new Map<string, CteTable>()
    let otherTables = [...(outerCtes || [])]
    let scope: Scope = {file, alias: '', fanoutPath: [], otherTables}

    // WITH clause - analyze each CTE. Store them on Scope, as they're accessible to later CTEs, and valid tables for the query to from/join
    let withClauses = queryNode.getChild('WithClause')?.getChildren('CteDef') || []
    for (let cteDef of withClauses) {
      let name = txt(cteDef.getChild('Alias'))
      let query = this.analyzeQuery(cteDef.getChild('QueryExpression')!, scope.otherTables)
      if (!query) return
      let columns = query.fields.map(field => ({name: field.name, type: field.type, metadata: field.metadata}) as Column)
      let cte: CteTable = {name, type: 'cte', tablePath: name, filePath: file.path, columns, joins: [], query}
      ctes.set(name, cte)
      scope.otherTables!.push(cte)
    }

    if (queryNode.getChildren('SetOperator').length) return this.analyzeSetQuery(queryNode, scope, ctes)
    return this.analyzeSimpleQuery(queryNode.getChild('SimpleQuery')!, queryNode, scope, ctes)
  }

  private analyzeSimpleQuery(simpleNode: SyntaxNode, queryNode: SyntaxNode, parentScope: Scope, ctes: Map<string, CteTable>, opts: {suppressImplicitOrderBy?: boolean} = {}): Query | void {
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
      let unnestSource = sourceNode.getChild('UnnestSource')
      let tablePrimary = unnestSource ? undefined : sourceNode.getChild('TablePrimary')
      if (!tablePrimary && !unnestSource) return this.diag(sourceNode, `Invalid ${isJoin ? 'JOIN' : 'FROM'} source`)
      let alias = txt((unnestSource || tablePrimary)!.getChild('Alias'))
      let table: Table | undefined

      // This might be referring to a table by name
      let refNode = tablePrimary?.getChild('Ref') || undefined
      if (refNode) {
        table = this.lookupTable(refNode, scope)
        if (!table) return
        alias ||= txt(refNode.getChildren('Identifier').at(-1))
      }

      // or it could be a subquery
      if (tablePrimary?.getChild('SubqueryExpression')) {
        let subquery = this.analyzeQuery(tablePrimary.getChild('SubqueryExpression')!.getChild('QueryExpression')!, scope.otherTables)
        if (!subquery) return
        let columns = subquery.fields.map(field => ({name: field.name, type: field.type, metadata: field.metadata}) as Column)
        table = {name: 'subquery', type: 'subquery', tablePath: alias, filePath: scope.file.path, columns, joins: [], query: subquery}
        alias ||= 'subquery'
      }

      let joinType: JoinType | undefined = isJoin ? 'inner' : undefined
      let firstKw = txt(sourceNode.getChildren('Kw')[0]).toLowerCase()
      if (firstKw == 'left' || firstKw == 'right' || firstKw == 'full' || firstKw == 'cross') joinType = firstKw

      if (unnestSource) {
        if (!isJoin) return this.diag(unnestSource, 'UNNEST requires a preceding FROM table')
        if (firstKw == 'join') return this.diag(unnestSource, 'Bare JOIN UNNEST is not supported; use CROSS JOIN UNNEST')
        if (joinType != 'cross') return this.diag(unnestSource, `${joinType!.toUpperCase()} JOIN UNNEST is not supported`)
        let exprNode = unnestSource.firstChild?.nextSibling || undefined
        if (!exprNode) return this.diag(unnestSource, 'UNNEST requires an array expression')
        let expr = this.analyzeExpr(exprNode, {file: scope.file, query, alias: '', otherTables: scope.otherTables})
        if (!isArrayType(expr.type)) return this.diag(exprNode, `UNNEST requires an array expression, got ${formatType(expr.type)}`)
        let onExpr = sourceNode.getChild('Expression') || undefined
        if (onExpr) return this.diag(sourceNode, 'UNNEST join does not support an ON clause')
        if (query.joins.find(join => join.alias == alias)) return this.diag(unnestSource, `Query already has table called "${alias}"`)
        query.joins.push({alias, source: 'ad-hoc', joinType, fanoutPath: extendFanoutPath(undefined, alias), unnestExpr: expr})
        continue
      }

      // Now that we have all the bits, construct the join for it.
      if (query.joins.find(join => join.alias == alias)) return this.diag(tablePrimary!, `Query already has table called "${alias}"`)
      let onExpr = sourceNode.getChild('Expression') || undefined
      let qj: QueryJoin = {alias, source: isJoin ? 'ad-hoc' : 'from', table, joinType, fanoutPath: [], onExpr}
      query.joins.push(qj)

      // If this is a JOIN, analyze the ON expr
      // It's important we do this _after_ adding the join to the query, since analyzing the expression looks at the query
      if (joinType == 'cross' && onExpr) return this.diag(sourceNode, 'CROSS JOIN cannot have an ON clause')
      if (isJoin && !onExpr && joinType != 'cross') return this.diag(sourceNode, `${joinType!.toUpperCase()} JOIN requires an ON clause`)
      qj.onClause = onExpr && this.analyzeExpr(onExpr, {file: scope.file, query, alias: '', otherTables: scope.otherTables}).sql
    }

    // SELECT clause
    let selects = simpleNode.getChild('SelectClause')?.getChildren('SelectItem') || []
    let isDistinct = !!txt(simpleNode.getChild('SelectClause')).toLowerCase().startsWith('select distinct')

    for (let select of selects) {
      if (select.getChild('Wildcard')) {
        let pathNodes = select.getChild('Wildcard')!.getChildren('Identifier')
        if (pathNodes.length == 0) {
          this.expandColumns(null, '', query, scope)
          continue
        }
        let targetScope = this.followJoins(pathNodes, scope)
        if (!targetScope?.table) continue
        this.expandColumns(targetScope.table, targetScope.alias, query, targetScope)
      } else {
        let exprNode = select.getChild('Expression')!
        let aliasNode = select.getChild('Alias')
        let expr = this.analyzeExpr(exprNode, scope)
        if (isScalarType(expr.type, 'interval') && expr.interval?.form == 'scaled') this.diag(exprNode, 'Multiplied intervals are only supported inside date/time arithmetic')
        let {name, disambiguatedName} = aliasNode ? {name: txt(aliasNode), disambiguatedName: undefined} : this.inferName(exprNode, scope, expr)
        isAgg ||= !!expr.isAgg
        this.addQueryField(query, {
          name,
          disambiguatedName,
          sql: expr.sql,
          type: expr.type,
          metadata: expr.metadata,
          isAgg: expr.isAgg,
          fanout: expr.fanout,
          definitionLocation: this.locationForNode(aliasNode || exprNode),
          diagNode: aliasNode || exprNode,
        })
        fanoutExprs.push({node: exprNode, expr})
      }
    }

    // WHERE / HAVING - we allow aggregate filters in WHERE (moved to HAVING automatically)
    let whereNode = simpleNode.getChild('WhereClause')?.getChild('Expression')
    let havingNode = simpleNode.getChild('HavingClause')?.getChild('Expression')
    for (let node of [whereNode, havingNode]) {
      if (!node) continue
      for (let expr of this.unpackAnds(node, scope)) {
        query.filters.push({sql: expr.sql, isAgg: expr.isAgg})
        fanoutExprs.push({node, expr})
      }
    }

    // GROUP BY - adds fields if not already selected
    let groupBys = simpleNode.getChild('GroupByClause')?.getChildren('SelectItem') || []
    for (let groupBy of groupBys) {
      let exprNode = groupBy.getChild('Expression')!
      let alias = txt(groupBy.getChild('Alias'))

      // Positional GROUP BY (e.g. `group by 2, 1`) references the current SELECT list.
      if (exprNode.name == 'Number' && !alias) {
        let field = query.fields[Number(txt(exprNode)) - 1]
        if (!field) this.diag(groupBy, 'No field at index ' + txt(exprNode))
        query.groupBy.push(field?.name)
      } else {
        // Otherwise, we can assume this is an expression (possibly with an alias)
        // If that expression is already in the selected fields, it's just a reference.
        let expr = this.analyzeExpr(exprNode, scope)
        if (expr.isAgg) this.diag(groupBy, 'Cannot group by aggregate expressions')
        let existing = query.fields.find(field => field.sql == expr.sql)
        if (existing) query.groupBy.push(existing.name)

        // If it's not in there, add it to the select.
        if (!existing) {
          let field = {
            ...(groupBy.getChild('Alias') ? {name: txt(groupBy.getChild('Alias')), disambiguatedName: undefined} : this.inferName(exprNode, scope, expr)),
            sql: expr.sql,
            type: expr.type,
            metadata: expr.metadata,
            fanout: expr.fanout,
            definitionLocation: this.locationForNode(groupBy.getChild('Alias') || exprNode),
            diagNode: groupBy.getChild('Alias') || exprNode,
          }
          this.addQueryField(query, field, {prepend: true})
          query.groupBy.push(field.name)
        }
        fanoutExprs.push({node: groupBy.getChild('Expression')!, expr})
      }
    }

    // If there are agg fields but no groupBy, automatically group by all non-agg fields
    let nonAggFields = query.fields.filter(field => !field.isAgg)
    if (query.groupBy.length == 0 && (isDistinct || nonAggFields.length < query.fields.length)) {
      query.groupBy = nonAggFields.map(field => field.name)
    }

    // ORDER BY
    let {orderBy, limit} = this.analyzeOrderAndLimit(queryNode, query)

    // Implicit `select *` if nothing selected (only when we have a base table)
    let baseJoin = query.joins.find(join => join.source == 'from')
    if (query.fields.length == 0 && baseJoin?.table) {
      let hasAdHoc = query.joins.some(join => join.source == 'ad-hoc')
      this.expandColumns(hasAdHoc ? null : baseJoin.table, baseJoin.alias, query, scope)
    }

    // Default ORDER BY for aggregate queries
    if (!opts.suppressImplicitOrderBy && orderBy.length == 0 && query.groupBy.length > 0) {
      let firstAggIdx = query.fields.findIndex(field => field.isAgg)
      if (firstAggIdx >= 0) orderBy.push({idx: firstAggIdx + 1, desc: true})
      else orderBy.push({idx: 1, desc: false}) // SELECT DISTINCT
    }

    query.orderBy = orderBy
    query.limit = limit
    if (isAgg) {
      fanoutExprs.forEach(({node, expr}) => this.analyzeAggregateQueryExpr(node, expr))
      this.analyzeAggregateQueryFanout(fanoutExprs)
    }
    query.sql = this.buildSql(query, ctes)
    return query
  }

  private analyzeSetQuery(queryNode: SyntaxNode, scope: Scope, ctes: Map<string, CteTable>): Query | void {
    let branches = [
      {
        query: this.analyzeSimpleQuery(queryNode.getChild('SimpleQuery')!, queryNode.getChild('SimpleQuery')!, scope, new Map(), {suppressImplicitOrderBy: true}),
        parenthesized: false,
      },
      ...queryNode.getChildren('SetOperand').map(node => this.analyzeSetOperand(node, scope)),
    ]

    let first = branches[0].query
    if (!first) return
    for (let branch of branches.slice(1)) {
      if (!branch.query) return
      if (branch.query.fields.length != first.fields.length) return this.diag(queryNode, 'Set operation branches must return the same number of columns')
    }

    let setOps = queryNode.getChildren('SetOperator')
    let fields = first.fields.map((field, idx) => {
      let next = {...field}
      let matches = branches.slice(1).every(branch => this.sameFieldMetadata(branch.query?.fields[idx]?.metadata, field.metadata))
      if (!matches) next.metadata = this.withoutTimeGrain(next.metadata)
      return next
    })

    let query: Query = {
      sql: '',
      fields,
      joins: [],
      filters: [],
      groupBy: [],
      orderBy: [],
      setOp: txt(setOps[0]).toLowerCase() as Query['setOp'],
      branches: branches as {query: Query; parenthesized?: boolean}[],
    }

    for (let opNode of setOps.slice(1)) {
      let op = txt(opNode).toLowerCase()
      if (op != query.setOp) return this.diag(opNode, 'Mixed set operators require parentheses')
    }

    let {orderBy, limit} = this.analyzeOrderAndLimit(queryNode, query)
    query.orderBy = orderBy
    query.limit = limit
    query.sql = this.buildSql(query, ctes)
    return query
  }

  private analyzeSetOperand(node: SyntaxNode, scope: Scope) {
    let subqueryNode = node.getChild('SubqueryExpression')
    if (subqueryNode) return {query: this.analyzeQuery(subqueryNode.getChild('QueryExpression')!, scope.otherTables), parenthesized: true}
    return {
      query: this.analyzeSimpleQuery(node.getChild('SimpleQuery')!, node.getChild('SimpleQuery')!, scope, new Map(), {suppressImplicitOrderBy: true}),
      parenthesized: false,
    }
  }

  private analyzeOrderAndLimit(queryNode: SyntaxNode, query: Query) {
    let orderBys = queryNode.getChild('OrderByClause')?.getChildren('OrderItem') || []
    let orderBy: {idx: number; desc: boolean}[] = []
    for (let orderItem of orderBys) {
      let fieldRef = txt(orderItem.getChild('Identifier')) || txt(orderItem.getChild('Number'))
      let desc = txt(orderItem.getChild('Kw')).toLowerCase() == 'desc'
      let idx = Number(fieldRef) || query.fields.findIndex(field => field.name == fieldRef) + 1
      if (idx > 0) orderBy.push({idx, desc})
      else if (fieldRef && isNaN(Number(fieldRef))) this.diag(orderItem, `Unknown field in ORDER BY: ${fieldRef}`)
    }

    let limitNodes = queryNode.getChild('LimitClause')?.getChildren('Number') || []
    let limit = limitNodes[0] ? Number(txt(limitNodes[0])) : undefined
    if (limitNodes[1]) this.diag(limitNodes[1], 'OFFSET is not supported')
    return {orderBy, limit}
  }

  // Assemble query parts into final SQL
  // Format a table path for the current dialect
  private formatTablePath(path: string): string {
    if (this.config.dialect === 'bigquery') return `\`${path}\``
    if (this.config.dialect === 'snowflake') return path.toUpperCase()
    return path
  }

  private renderUnnestValueSql(alias: string): string {
    return this.config.dialect == 'snowflake' ? `${alias}.value` : alias
  }

  private renderUnnestJoinClause(join: QueryJoin): string {
    if (!join.unnestExpr || !join.joinType) return ''
    let exprSql = join.unnestExpr.sql
    if (this.config.dialect == 'bigquery') return `CROSS JOIN UNNEST(${exprSql}) AS ${join.alias}`
    if (this.config.dialect == 'clickhouse') return `ARRAY JOIN ${exprSql} AS ${join.alias}`
    if (this.config.dialect == 'snowflake') return `, TABLE(FLATTEN(INPUT => ${exprSql})) AS ${join.alias}`
    return `CROSS JOIN unnest(${exprSql}) AS ${join.alias}(${join.alias})`
  }

  private buildSql(query: Query, cteMap: Map<string, CteTable>): string {
    let ctes: string[] = [...cteMap.values()].map(cte => `${cte.name} as ( ${cte.query.sql} )`)

    if (query.setOp) {
      let branches = (query.branches || []).map(branch => {
        let sql = branch.query.sql
        return branch.parenthesized ? `( ${sql} )` : sql
      })
      let op = query.setOp.toUpperCase()
      let sql = branches.join(` ${op} `)
      if (query.orderBy.length) {
        let parts = query.orderBy.map(order => `${order.idx} ${order.desc ? 'desc' : 'asc'} NULLS LAST`)
        sql += ` ORDER BY ${parts.join(',')}`
      }
      if (query.limit) sql += ` LIMIT ${query.limit}`
      if (ctes.length) sql = `WITH ${ctes.join(', ')} ${sql}`
      return sql
    }

    let selectParts = query.fields.map(field => `${field.sql} as ${field.name}`)
    let baseJoin = query.joins.find(join => join.source == 'from')

    // No FROM clause (e.g. `select 1`)
    if (!baseJoin?.table) return `SELECT ${selectParts.join(', ')}`

    let renderTableRef = (table: Table): string => {
      if (table.type === 'view') {
        if (!ctes.some(cte => cte.startsWith(table.name + ' '))) ctes.push(`${table.name} as ( ${table.query.sql} )`)
        return table.name
      }
      if (table.type === 'subquery') return `( ${table.query.sql} )`
      return this.formatTablePath(table.tablePath)
    }

    let fromTable = renderTableRef(baseJoin.table)
    let joinClauses = query.joins
      .filter(join => join.source != 'from')
      .map(join => {
        if (join.unnestExpr) return this.renderUnnestJoinClause(join)
        if (!join.table || !join.joinType) return ''
        let tablePath = renderTableRef(join.table)
        let keyword = join.joinType.toUpperCase() + ' JOIN'
        if (join.joinType == 'cross') return `${keyword} ${tablePath} as ${join.alias}`
        return `${keyword} ${tablePath} as ${join.alias} ON ${join.onClause}`
      })
      .filter(Boolean)

    let whereFilters = query.filters.filter(filter => !filter.isAgg).map(filter => filter.sql)
    let havingFilters = query.filters.filter(filter => filter.isAgg).map(filter => filter.sql)
    let groupByIndices = query.groupBy.map(group => query.fields.findIndex(field => field.name == group) + 1)

    let sql = `SELECT ${selectParts.join(', ')} FROM ${fromTable} as ${baseJoin.alias}`
    if (joinClauses.length) sql += ' ' + joinClauses.join(' ')
    if (whereFilters.length) sql += ` WHERE ${whereFilters.join(' AND ')}`
    if (groupByIndices.length) sql += ` GROUP BY ${groupByIndices.join(',')}`
    if (havingFilters.length) sql += ` HAVING ${havingFilters.join(' AND ')}`
    if (query.orderBy.length) {
      let parts = query.orderBy.map(order => `${order.idx} ${order.desc ? 'desc' : 'asc'} NULLS LAST`)
      sql += ` ORDER BY ${parts.join(',')}`
    }
    if (query.limit) sql += ` LIMIT ${query.limit}`
    if (ctes.length) sql = `WITH ${ctes.join(', ')} ${sql}`
    return sql
  }

  // Analyze an expression node and return SQL + type info
  analyzeExpr(node: SyntaxNode, scope: Scope): Expr {
    if (node.type.isError) return this.diag(node, 'Invalid expression', {sql: 'NULL', type: scalarType('error')})

    switch (node.name) {
      case 'Number':
        return {sql: txt(node), type: scalarType('number')}
      case 'Boolean':
        return {sql: txt(node).toLowerCase(), type: scalarType('boolean')}
      case 'Null':
        return {sql: 'NULL', type: scalarType('null')}
      case 'String':
        return {sql: `'${txt(node).slice(1, -1).replace(/'/g, "''")}'`, type: scalarType('string')}
      case 'Param':
        return {sql: txt(node), type: scalarType('string')} // $param - type inferred later

      case 'Ref': {
        let pathNodes = node.getChildren('Identifier')
        let fieldNode = pathNodes.pop()!
        let fieldName = txt(fieldNode)

        // Check output fields first when we're at the query root (e.g. HAVING/post-agg filters).
        // Don't do this while resolving table expressions, or we can accidentally bind to sibling
        // SELECT aliases instead of the table's computed columns.
        if (scope.query && !scope.table && pathNodes.length == 0) {
          let outField = scope.query.fields.find(field => field.name == fieldName)
          if (outField) return {sql: outField.sql, type: outField.type, isAgg: outField.isAgg, fanout: outField.fanout}
        }

        // Follow any dot path (e.g., `users.orders` in `users.orders.amount`), then find the field
        let targetScope = this.followJoins(pathNodes, scope)
        if (!targetScope) return {sql: 'NULL', type: scalarType('error')}

        // Build the list of tables to search: if followJoins landed on a specific table, just that one.
        // Otherwise, search all tables either in FROM or explicitly JOINed (but not implicitly joined).
        let possibleJoins = targetScope.table
          ? [{table: targetScope.table, alias: targetScope.alias, fanoutPath: targetScope.fanoutPath}]
          : scope.query?.joins.filter(join => join.source != 'implicit' && join.table).map(join => ({table: join.table!, alias: join.alias, fanoutPath: join.fanoutPath})) || []
        let unnestMatches = !targetScope.table && pathNodes.length == 0 ? scope.query?.joins.filter(join => join.unnestExpr && join.alias == fieldName) || [] : []

        // Expect just one of the possibleJoins to have the named column. Otherwise, it's an error.
        let matches = possibleJoins.filter(join => join.table.columns.some(col => col.name == fieldName))
        if (matches.length + unnestMatches.length > 1) {
          return this.diag(fieldNode, `Ambiguous field "${fieldName}"`, {sql: 'NULL', type: scalarType('error')})
        }

        if (unnestMatches.length == 1) {
          let join = unnestMatches[0]
          let elementType = isArrayType(join.unnestExpr!.type) ? join.unnestExpr!.type.elementType : scalarType('error')
          return {sql: this.renderUnnestValueSql(join.alias), type: elementType, fanout: normalizeExprFanout({path: join.fanoutPath})}
        }

        if (matches.length == 0) {
          if (possibleJoins.some(join => join.table.joins.some(next => next.alias == fieldName))) {
            return this.diag(fieldNode, `"${fieldName}" is a join, not a column`, {sql: 'NULL', type: scalarType('error')})
          }
          if (pathNodes.length == 0) {
            let bareFn = analyzeBareFunction(this, node, fieldName.toLowerCase(), scope)
            if (bareFn) return bareFn
          }
          let on = possibleJoins.length == 1 ? ` on ${possibleJoins[0].table.name}` : ''
          return this.diag(fieldNode, `Unknown field "${fieldName}"${on}`, {sql: 'NULL', type: scalarType('error')})
        }

        let {table, alias} = matches[0]
        let col = table.columns.find(column => column.name == fieldName)!
        this.addReference('column', fieldNode, col.symbolId)

        // Simple case: this is just a regular column on a table
        if (!col.exprNode) return {sql: `${alias}.${col.name}`, type: col.type, metadata: col.metadata, fanout: normalizeExprFanout({path: matches[0].fanoutPath})}

        // Computed column: analyze its expression in the matched table's scope
        if (this.computedColumnStack.has(col)) return this.diag(col.exprNode, 'Cycles are not allowed between computed columns', {sql: 'NULL', type: scalarType('error')})
        this.computedColumnStack.add(col)
        let expr = this.analyzeExpr(col.exprNode, {file: this.fileForPath(table.filePath), query: scope.query, table, alias, otherTables: scope.otherTables, fanoutPath: matches[0].fanoutPath})
        this.computedColumnStack.delete(col)
        return {sql: `(${expr.sql})`, type: expr.type, metadata: {...expr.metadata, ...col.metadata}, isAgg: expr.isAgg, fanout: expr.fanout}
      }

      case 'FunctionCall':
        return analyzeFunction(this, node, scope)

      case 'WindowExpression': {
        let baseNode = node.getChild('FunctionCall') || node.getChild('Count')
        if (!baseNode) return this.diag(node, 'Window expressions require a function call', {sql: 'NULL', type: scalarType('error')})
        let isPercentile = this.isPercentileFunctionCall(baseNode)
        if (isPercentile && !this.isPercentileWindowSpecSupported(node.getChild('OverClause')!)) {
          return this.diag(node.getChild('OverClause')!, 'pXX window form currently supports PARTITION BY only', {sql: 'NULL', type: scalarType('error')})
        }
        let base = baseNode.name == 'FunctionCall' ? analyzeFunction(this, baseNode, scope, {isWindow: true}) : this.analyzeExpr(baseNode, scope)
        if (isScalarType(base.type, 'error')) return base
        if (!base.canWindow) return this.diag(baseNode, 'Only aggregate or window functions can use OVER', {sql: 'NULL', type: scalarType('error')})
        let over = this.renderOverClause(node.getChild('OverClause')!, scope)
        return {sql: `${base.sql} OVER (${over})`, type: base.type, isAgg: false}
      }

      case 'Parenthetical': {
        let inner = this.analyzeExpr(node.getChild('Expression')!, scope)
        return {...inner, sql: `(${inner.sql})`}
      }

      case 'Count': {
        let inner = node.getChild('Expression')
        if (inner) {
          let expr = this.analyzeExpr(inner, scope)
          return {
            sql: `count(distinct ${expr.sql})`,
            type: scalarType('number'),
            metadata: {defaultName: 'count'},
            isAgg: true,
            canWindow: true,
            fanout: normalizeExprFanout({sensitivePaths: mergeSensitiveFanouts(expr.fanout?.sensitivePaths), conflict: expr.fanout?.conflict}),
          }
        }
        return {
          sql: 'count(1)',
          type: scalarType('number'),
          metadata: {defaultName: 'count'},
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
        let left = this.analyzeExpr(node.firstChild!, scope)
        let right = this.analyzeExpr(node.lastChild!, scope)
        let op = txt(node.firstChild?.nextSibling).toLowerCase()

        // Type coercion for dates
        if ((isScalarType(left.type, 'date') || isScalarType(left.type, 'timestamp')) && isScalarType(right.type, 'string')) {
          right = this.coerceToTemporal(right, left.type, node.lastChild!)
        }
        if ((isScalarType(right.type, 'date') || isScalarType(right.type, 'timestamp')) && isScalarType(left.type, 'string')) {
          left = this.coerceToTemporal(left, right.type, node.firstChild!)
        }

        // Date arithmetic
        if (op == '+' || op == '-') {
          if (isScalarType(left.type, 'date') || isScalarType(left.type, 'timestamp') || isScalarType(left.type, 'interval') || isScalarType(right.type, 'interval')) {
            return this.analyzeDateArithmetic(op, left, right, node)
          }
        }

        // Type checking for operators
        if (op == '*') {
          let multiplied = this.analyzeIntervalMultiplication(left, right, node)
          if (multiplied) return multiplied
        }
        if (op == '*' || op == '/' || op == '%') {
          this.checkTypes(left, ['number'], node.firstChild!)
          this.checkTypes(right, ['number'], node.lastChild!)
        }
        if (op == 'like' || op == 'ilike') {
          this.checkTypes(left, ['string'], node.firstChild!)
          this.checkTypes(right, ['string'], node.lastChild!)
        }
        if (op == '||') {
          this.checkTypes(left, ['string'], node.firstChild!)
          this.checkTypes(right, ['string'], node.lastChild!)
        }

        let resultType = left.type
        if (['and', 'or', '<', '<=', '>', '>=', '=', '!=', '<>', 'like', 'ilike'].includes(op)) resultType = scalarType('boolean')
        if (op == '||') resultType = scalarType('string')
        if (op == '<>') op = '!='

        // ILIKE handling for BigQuery
        let sql: string
        if (op == 'ilike' && this.config.dialect == 'bigquery') {
          sql = `LOWER(${left.sql}) LIKE LOWER(${right.sql})`
        } else if (op == 'and' || op == 'or') {
          sql = `(${left.sql} ${op.toUpperCase()} ${right.sql})`
        } else if (op == 'like' || op == 'ilike') {
          sql = `${left.sql} ${op.toUpperCase()} ${right.sql}`
        } else {
          sql = `${left.sql}${op}${right.sql}`
        }

        return this.mergeExprAnalysis([left, right], sql, resultType, left.isAgg || right.isAgg)
      }

      case 'UnaryExpression': {
        let op = txt(node.firstChild).toLowerCase()
        let child = this.analyzeExpr(node.lastChild!, scope)
        if (op == 'not') return {sql: `NOT (${child.sql})`, type: scalarType('boolean'), isAgg: child.isAgg, fanout: child.fanout}
        if (op == '-') return {sql: `-(${child.sql})`, type: child.type, isAgg: child.isAgg, fanout: child.fanout}
        if (op == '+') return {sql: `(${child.sql})`, type: child.type, isAgg: child.isAgg, fanout: child.fanout}
        return this.diag(node, `Unknown unary operator: ${op}`, {sql: 'NULL', type: scalarType('error')})
      }

      case 'NullTestExpression': {
        let isNot = !!node.getChildren('Kw').find(next => txt(next).toLowerCase() == 'not')
        let expr = this.analyzeExpr(node.firstChild!, scope)
        return {sql: `${expr.sql} IS ${isNot ? 'NOT ' : ''}NULL`, type: scalarType('boolean'), isAgg: expr.isAgg, fanout: expr.fanout}
      }

      case 'CaseExpression': {
        let parts = ['CASE']
        let isAgg = false
        let fanoutExprs: Expr[] = []
        let caseValue = node.getChild('Expression')
        if (caseValue) {
          let expr = this.analyzeExpr(caseValue, scope)
          parts.push(expr.sql)
          isAgg ||= !!expr.isAgg
          fanoutExprs.push(expr)
        }

        let resultType: FieldType = scalarType('string')
        for (let when of node.getChildren('WhenClause')) {
          let exprs = when.getChildren('Expression')
          let whenExpr = this.analyzeExpr(exprs[0], scope)
          let thenExpr = this.analyzeExpr(exprs[1], scope)
          resultType = thenExpr.type
          isAgg ||= !!whenExpr.isAgg || !!thenExpr.isAgg
          fanoutExprs.push(whenExpr, thenExpr)
          parts.push(`WHEN (${whenExpr.sql}) THEN ${thenExpr.sql}`)
        }

        let elseClause = node.getChild('ElseClause')
        if (elseClause) {
          let elseExpr = this.analyzeExpr(elseClause.getChild('Expression')!, scope)
          parts.push(`ELSE ${elseExpr.sql}`)
          isAgg ||= !!elseExpr.isAgg
          fanoutExprs.push(elseExpr)
        }
        parts.push('END')
        return this.mergeExprAnalysis(fanoutExprs, parts.join(' '), resultType, isAgg || undefined)
      }

      case 'InExpression': {
        let not = txt(node.getChild('Kw')).toLowerCase() == 'not'
        let expr = this.analyzeExpr(node.firstChild!, scope)
        let valueList = node.getChild('InValueList')
        let subqueryNode = node.getChild('QueryExpression')
        if (subqueryNode) {
          let subquery = this.analyzeQuery(subqueryNode, scope.otherTables)
          if (!subquery) return {sql: 'NULL', type: scalarType('error')}
          if (subquery.fields.length != 1) return this.diag(subqueryNode, 'Subquery in IN must return exactly one column', {sql: 'NULL', type: scalarType('error')})
          return {sql: `${expr.sql} ${not ? 'NOT IN' : 'IN'} (${subquery.sql})`, type: scalarType('boolean'), isAgg: expr.isAgg, fanout: expr.fanout}
        }
        if (!valueList) return this.diag(node, 'IN expression must provide either values or a subquery', {sql: 'NULL', type: scalarType('error')})
        let values = valueList.getChildren('Expression').map(valueNode => {
          let value = this.analyzeExpr(valueNode, scope)
          // Coerce string literals to temporal types if needed
          if ((isScalarType(expr.type, 'date') || isScalarType(expr.type, 'timestamp')) && isScalarType(value.type, 'string')) {
            value = this.coerceToTemporal(value, expr.type, valueNode)
          }
          return value.sql
        })
        return {sql: `${expr.sql} ${not ? 'NOT IN' : 'IN'} (${values.join(',')})`, type: scalarType('boolean'), isAgg: expr.isAgg, fanout: expr.fanout}
      }

      case 'BetweenExpression': {
        let not = !!node
          .getChildren('Kw')
          .map(next => txt(next).toLowerCase())
          .find(next => next == 'not')
        let [exprNode, lowNode, highNode] = node.getChildren('Expression')
        let [expr, low, high] = [exprNode, lowNode, highNode].map(next => this.analyzeExpr(next, scope))

        if (isScalarType(expr.type, 'date') || isScalarType(expr.type, 'timestamp')) {
          low = this.coerceToTemporal(low, expr.type, lowNode)
          high = this.coerceToTemporal(high, expr.type, highNode)
        }

        let sql = `${expr.sql} ${not ? 'NOT BETWEEN' : 'BETWEEN'} ${low.sql} AND ${high.sql}`
        return this.mergeExprAnalysis([expr, low, high], sql, scalarType('boolean'), expr.isAgg || low.isAgg || high.isAgg)
      }

      case 'SubqueryExpression': {
        let subquery = this.analyzeQuery(node.getChild('QueryExpression')!, scope.otherTables)
        if (!subquery) return {sql: 'NULL', type: scalarType('error')}
        if (subquery.fields.length != 1) return this.diag(node, 'Subquery expression must return exactly one column', {sql: 'NULL', type: scalarType('error')})
        return {sql: `(${subquery.sql})`, type: subquery.fields[0].type}
      }

      case 'CastExpression':
      case 'TypeCastExpression': {
        let inner = node.getChild('Expression') || node.firstChild!
        let expr = this.analyzeExpr(inner, scope)
        let typeNode = node.getChild('CastType')!
        let rawType = txt(typeNode)
        let parsed = parseGsqlFieldType(rawType)
        if (parsed.error) return this.diag(typeNode, parsed.error, {sql: 'NULL', type: scalarType('error')})
        if (!parsed.type) return this.diag(typeNode, `Unsupported cast type: ${rawType.toLowerCase()}`, {sql: 'NULL', type: scalarType('error')})
        let resultType = parsed.type
        let targetType = this.renderCastType(rawType)
        return {...expr, sql: `CAST(${expr.sql} AS ${targetType})`, type: resultType, metadata: this.preserveTemporalMetadataThroughCast(expr, resultType)}
      }

      case 'ExtractExpression': {
        let extractInner = node.getChild('Expression')!
        let expr = this.analyzeExpr(extractInner, scope)
        this.checkTypes(expr, ['date', 'timestamp'], extractInner)
        let unit = txt(node.getChild('ExtractUnit')!)
          .replace(/^['"]|['"]$/g, '')
          .toLowerCase()
        return {
          sql: `EXTRACT(${unit} FROM ${expr.sql})`,
          type: scalarType('number'),
          metadata: inferTimeOrdinal(unit, this.config.dialect),
          isAgg: expr.isAgg,
          fanout: expr.fanout,
        }
      }

      case 'IntervalExpression': {
        let stringNode = node.getChild('String')
        if (stringNode) {
          let parsed = parseIntervalLiteral(txt(stringNode).slice(1, -1))
          if (!parsed) return this.diag(stringNode, 'Could not parse interval', {sql: 'NULL', type: scalarType('error')})
          let interval = {quantitySql: String(parsed.quantity), unit: parsed.unit, form: 'constant'} as const
          return {
            sql: renderStandaloneInterval(this.config.dialect, interval),
            type: scalarType('interval'),
            interval,
          }
        }
        let quantityNode = node.getChild('Number') || node.getChild('Ref')
        if (!quantityNode) return this.diag(node, 'Interval requires a quantity before the unit', {sql: 'NULL', type: scalarType('error')})
        let quantity = this.analyzeExpr(quantityNode, scope)
        this.checkTypes(quantity, ['number'], quantityNode)
        let unit = parseIntervalUnit(txt(node.getChild('IntervalUnit')!).toLowerCase())
        if (!unit) return this.diag(node, 'Invalid interval unit', {sql: 'NULL', type: scalarType('error')})
        let interval = {quantitySql: quantity.sql, unit, form: quantityNode.name == 'Number' ? 'constant' : 'dynamic'} as const
        return {
          ...quantity,
          sql: renderStandaloneInterval(this.config.dialect, interval),
          type: scalarType('interval'),
          interval,
        }
      }

      case 'DateExpression':
      case 'TimestampExpression': {
        let isDate = node.name == 'DateExpression'
        let lit = txt(node.getChild('String')!).slice(1, -1)
        let parsed = parseTemporalLiteral(lit, isDate ? 'date' : 'timestamp')
        if (!parsed) return this.diag(node, `Invalid ${isDate ? 'date' : 'timestamp'}`, {sql: 'NULL', type: scalarType('error')})
        return {sql: `${isDate ? 'DATE' : 'TIMESTAMP'} '${parsed.literal}'`, type: isDate ? scalarType('date') : scalarType('timestamp')}
      }

      default:
        return this.diag(node, `Unsupported expression: ${node.name}`, {sql: 'NULL', type: scalarType('error')})
    }
  }

  private analyzeDateArithmetic(op: '+' | '-', left: Expr, right: Expr, node: SyntaxNode): Expr {
    let merged = this.mergeExprAnalysis([left, right], '', scalarType('number'), left.isAgg || right.isAgg)

    // date - date = interval
    if ((isScalarType(left.type, 'date') || isScalarType(left.type, 'timestamp')) && (isScalarType(right.type, 'date') || isScalarType(right.type, 'timestamp'))) {
      if (op != '-') return this.diag(node, 'Can only subtract dates', {sql: 'NULL', type: scalarType('error')})
      let unit = isScalarType(left.type, 'timestamp') || isScalarType(right.type, 'timestamp') ? 'SECOND' : 'DAY'
      if (this.config.dialect == 'bigquery') return {...merged, sql: `TIMESTAMP_DIFF(${left.sql}, ${right.sql}, ${unit})`, type: scalarType('number')}
      if (this.config.dialect == 'snowflake') return {...merged, sql: `TIMESTAMPDIFF(${unit}, ${right.sql}, ${left.sql})`, type: scalarType('number')}
      if (this.config.dialect == 'postgres') {
        let sql = unit == 'DAY' ? `(${left.sql} - ${right.sql})` : `EXTRACT(EPOCH FROM (${left.sql} - ${right.sql}))`
        return {...merged, sql, type: scalarType('number')}
      }
      return {...merged, sql: `DATE_DIFF('${unit.toLowerCase()}', ${right.sql}, ${left.sql})`, type: scalarType('number')}
    }

    // date +/- interval
    if ((isScalarType(left.type, 'date') || isScalarType(left.type, 'timestamp')) && isScalarType(right.type, 'interval')) {
      if (!right.interval) return this.diag(node, 'Invalid interval expression', {sql: 'NULL', type: scalarType('error')})
      return {...merged, sql: renderTemporalArithmetic(this.config.dialect, left.sql, left.type, op, right.interval), type: left.type}
    }

    // interval + date (normalize to date + interval)
    if (isScalarType(left.type, 'interval') && (isScalarType(right.type, 'date') || isScalarType(right.type, 'timestamp'))) {
      if (op == '-') return this.diag(node, 'Cannot subtract date from interval', {sql: 'NULL', type: scalarType('error')})
      if (!left.interval) return this.diag(node, 'Invalid interval expression', {sql: 'NULL', type: scalarType('error')})
      return {...merged, sql: renderTemporalArithmetic(this.config.dialect, right.sql, right.type, '+', left.interval), type: right.type}
    }

    return this.diag(node, 'Invalid date arithmetic', {sql: 'NULL', type: scalarType('error')})
  }

  private analyzeIntervalMultiplication(left: Expr, right: Expr, node: SyntaxNode): Expr | null {
    if (isScalarType(left.type, 'number') && isScalarType(right.type, 'interval')) return this.scaleInterval(left, right, node.lastChild!)
    if (isScalarType(left.type, 'interval') && isScalarType(right.type, 'number')) return this.scaleInterval(right, left, node.firstChild!)
    return null
  }

  private scaleInterval(multiplier: Expr, intervalExpr: Expr, node: SyntaxNode): Expr {
    if (!intervalExpr.interval) return this.diag(node, 'Invalid interval expression', {sql: 'NULL', type: scalarType('error')})
    if (intervalExpr.interval.form != 'constant') return this.diag(node, 'Only literal intervals can be multiplied', {sql: 'NULL', type: scalarType('error')})
    let quantitySql = intervalExpr.interval.quantitySql == '1' ? multiplier.sql : `${multiplier.sql}*${intervalExpr.interval.quantitySql}`
    return {
      sql: renderStandaloneInterval(this.config.dialect, {quantitySql, unit: intervalExpr.interval.unit, form: 'scaled'}),
      type: scalarType('interval'),
      isAgg: multiplier.isAgg || intervalExpr.isAgg,
      interval: {quantitySql, unit: intervalExpr.interval.unit, form: 'scaled'},
    }
  }

  private coerceToTemporal(expr: Expr, targetType: FieldType, node: SyntaxNode): Expr {
    if (!isScalarType(targetType, 'date') && !isScalarType(targetType, 'timestamp')) return expr
    // Extract the string literal value (remove quotes)
    let match = expr.sql.match(/^'(.+)'$/)
    if (!match) return expr
    let parsed = parseTemporalLiteral(match[1], targetType)
    if (!parsed) {
      this.diag(node, `Cannot parse as ${targetType}: ${expr.sql}`)
      return expr
    }
    return {...expr, sql: `${targetType.toUpperCase()} '${parsed.literal}'`, type: scalarType(targetType)}
  }

  private preserveTemporalMetadataThroughCast(expr: Expr, resultType: FieldType): FieldMeta | undefined {
    if (!expr.metadata?.timeGrain) return undefined
    if (!isScalarType(resultType, 'date') && !isScalarType(resultType, 'timestamp')) return undefined
    return {timeGrain: expr.metadata.timeGrain, ...(expr.metadata.defaultName ? {defaultName: expr.metadata.defaultName} : {})}
  }

  private sameFieldMetadata(left?: FieldMeta, right?: FieldMeta) {
    if (!left && !right) return true
    if (!left || !right) return false
    return left.timeGrain == right.timeGrain && left.timeOrdinal == right.timeOrdinal
  }

  private withoutTimeGrain(metadata?: FieldMeta): FieldMeta | undefined {
    if (!metadata?.timeGrain && !metadata?.timeOrdinal) return metadata
    let {timeGrain: _timeGrain, timeOrdinal: _timeOrdinal, defaultName: _defaultName, ...next} = metadata
    return Object.keys(next).length ? next : undefined
  }

  private isPercentileFunctionCall(node: SyntaxNode): boolean {
    if (node.name != 'FunctionCall') return false
    let name = txt(node.getChild('Identifier')).toLowerCase()
    return /^p\d+$/.test(name)
  }

  private isPercentileWindowSpecSupported(overClause: SyntaxNode): boolean {
    let spec = overClause.getChild('WindowSpec')
    if (!spec) return true
    if (spec.getChild('WindowOrderByClause')) return false
    if (spec.getChild('WindowFrameClause')) return false
    return true
  }

  private renderOverClause(overClause: SyntaxNode, scope: Scope): string {
    let spec = overClause.getChild('WindowSpec')
    if (!spec) return ''
    let parts: string[] = []

    let partition = spec.getChild('WindowPartitionClause')
    if (partition) {
      let exprs = partition.getChildren('Expression').map(expr => this.analyzeExpr(expr, scope).sql)
      parts.push(`PARTITION BY ${exprs.join(', ')}`)
    }

    let orderBy = spec.getChild('WindowOrderByClause')
    if (orderBy) {
      let items = orderBy.getChildren('WindowOrderItem').map(item => {
        let expr = this.analyzeExpr(item.getChild('Expression')!, scope).sql
        let desc = txt(item.getChild('Kw')).toLowerCase() == 'desc'
        return `${expr} ${desc ? 'DESC' : 'ASC'}`
      })
      parts.push(`ORDER BY ${items.join(', ')}`)
    }

    let frame = spec.getChild('WindowFrameClause')
    if (frame) parts.push(this.renderWindowFrame(frame, scope))
    return parts.join(' ')
  }

  private renderWindowFrame(frame: SyntaxNode, scope: Scope): string {
    let mode = txt(frame.getChildren('Kw')[0]).toUpperCase()
    let between = frame.getChild('WindowFrameBetween')
    if (between) {
      let bounds = between.getChildren('WindowFrameBound').map(bound => this.renderWindowBound(bound, scope))
      return `${mode} BETWEEN ${bounds[0]} AND ${bounds[1]}`
    }
    let start = frame.getChild('WindowFrameStart')!.getChild('WindowFrameBound')!
    return `${mode} ${this.renderWindowBound(start, scope)}`
  }

  private renderWindowBound(bound: SyntaxNode, scope: Scope): string {
    let kws = bound.getChildren('Kw').map(keyword => txt(keyword).toLowerCase())
    if (kws.includes('unbounded')) return `UNBOUNDED ${kws.includes('following') ? 'FOLLOWING' : 'PRECEDING'}`
    if (kws.includes('current')) return 'CURRENT ROW'
    let expr = this.analyzeExpr(bound.getChild('Expression')!, scope).sql
    return `${expr} ${kws.includes('following') ? 'FOLLOWING' : 'PRECEDING'}`
  }

  // Traverse a join path (like `tableA.tableB.`), returning a new scope pointing to the target table. Adds implied joins to the query as it goes
  private followJoins(pathNodes: SyntaxNode[], scope: Scope): Scope | null {
    let part = pathNodes[0]
    let name = txt(part)
    if (pathNodes.length == 0) return scope

    // If we're analyzing an ON clause, any path nodes must point at the source or target table
    if (scope.joinTarget) {
      let pointsAtSource = !!scope.table && name == scope.alias
      let pointsAtTarget = name == scope.joinTarget.alias || name == scope.joinTarget.name
      if (!pointsAtSource && !pointsAtTarget) return this.diag(pathNodes[0], 'Joins must point at either the source or target table', null)

      let table = pointsAtTarget ? scope.joinTarget.table : scope.table!
      let alias = pointsAtTarget ? scope.joinTarget.alias : scope.alias
      this.addReference('table', pathNodes[0], table.symbolId)
      return {file: this.fileForPath(table.filePath), query: scope.query, table, alias, fanoutPath: scope.fanoutPath, otherTables: scope.otherTables}
    }

    // If scope is at the root of the table (ie scope.table == null), then the first part of the path could point at
    // the alias of any table in the FROM or JOIN clauses of a query.
    // But it could also refer to a join _on_ one of those tables (assuming the name is unique).
    if (!scope.table) {
      // This could be a ref to an existing FROM/JOIN alias
      let existing = scope.query!.joins.find(join => join.alias == name)
      if (existing) {
        if (!existing.table) return this.diag(part, `"${name}" is an unnested value, not a table`, null)
        this.addReference('table', part, existing.table.symbolId)
        scope = {...scope, file: this.fileForPath(existing.table.filePath), table: existing.table, alias: existing.alias, fanoutPath: existing.fanoutPath}
        pathNodes.shift()
      } else {
        // otherwise, this might be referring to a join _on_ one of those FROM/JOIN tables
        let matches = scope.query!.joins.filter(join => join.table && join.table.joins.some(next => next.alias == name))
        if (matches.length > 1) return this.diag(part, `"${name}" matches multiple possible joins in this query`, null)
        if (matches.length == 0) return this.diag(part, `Could not find "${name}" on query`, null)
        scope = {...scope, file: this.fileForPath(matches[0].table!.filePath), table: matches[0].table!, alias: matches[0].alias, fanoutPath: matches[0].fanoutPath}
      }
    }

    // At this point we're guaranteed to have a scope.table, and from here it's easy. Each part of the path must be
    // the name of a join on scope.table, and we just need to walk through each one updating our scope, and adding an implicit join to the query
    for (let part of pathNodes) {
      let name = txt(part)
      if (name == scope.alias || name == scope.table!.name) continue

      let table = scope.table!
      let alias = scope.alias
      let next = table.joins.find(join => join.alias == name)
      if (!next) return this.diag(part, `Unknown join "${name}" on ${table.name}`, null)

      next.table = this.lookupTable(next.targetNode!)
      if (!next.table) return null

      // Construct a new implied join and attache it to the query
      let fromAlias = scope.query?.joins.find(join => join.source == 'from')?.alias
      let newAlias = alias == fromAlias ? name : `${alias}_${name}`
      let fanoutPath = next.cardinality == 'many' ? extendFanoutPath(scope.fanoutPath, name) : extendFanoutPath(scope.fanoutPath)
      if (scope.query && !scope.query.joins.find(join => join.alias == newAlias)) {
        let joinTarget = {name: next.alias, table: next.table, alias: newAlias}
        let onClause = this.analyzeExpr(next.onExpr!, {file: scope.file, table, alias, fanoutPath: scope.fanoutPath, joinTarget}).sql
        scope.query.joins.push({alias: newAlias, targetTable: next.targetTable, table: next.table, source: 'implicit', cardinality: next.cardinality, fanoutPath, joinType: 'left', onClause})
      }

      this.addReference('table', part, next.table.symbolId)
      scope = {...scope, file: this.fileForPath(next.table.filePath), table: next.table, alias: newAlias, fanoutPath}
    }

    return scope
  }

  private mergeExprAnalysis(exprs: Expr[], sql: string, type: FieldType, isAgg?: boolean): Expr {
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

  private analyzeComputedFieldExpr(node: SyntaxNode, expr: Expr) {
    if (expr.fanout?.conflict) this.diag(node, 'Join graph creates a chasm trap')
    if (!expr.isAgg && !isBaseFanoutPath(expr.fanout?.path)) this.diag(node, fanoutMessage(expr.fanout?.path, 'aggregate it first'))
    let paths = uniqueFanoutPaths(expr.fanout?.sensitivePaths || [])
    if (paths.length > 1) this.diag(node, multiGrainMessage(paths))
  }

  private analyzeAggregateQueryExpr(node: SyntaxNode, expr: Expr) {
    if (expr.fanout?.conflict) this.diag(node, 'Join graph creates a chasm trap')
  }

  // Aggregate-query fanout diagnostics have to look at the query as a whole: first ensure
  // any non-aggregate dimensions stay at the same grain as the aggregates, then classify the
  // aggregate grains into the more specific cases we can explain clearly (chasm trap, a base
  // aggregate fanned out by one join, an ancestor aggregate fanned out by a descendant join,
  // or the generic join-graph fanout fallback).
  private analyzeAggregateQueryFanout(exprs: {node: SyntaxNode; expr: Expr}[]) {
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
          this.diag(aggEntry.node, aggregateFanoutMessage(txt(aggEntry.node), entry.expr.fanout?.path))
        }
        continue
      }

      let targetPath = paths.length == 1 && isPrefix(entry.expr.fanout!.path!, paths[0]) ? paths[0] : entry.expr.fanout?.path
      this.diag(entry.node, fanoutMessage(targetPath, 'aggregate queries cannot group by it directly'))
    }

    if (paths.length <= 1) return

    let joinedPaths = paths.filter(path => !isBaseFanoutPath(path))

    // Sibling join-many branches produce a classic chasm trap.
    if (joinedPaths.length > 1 && isChasmTrap(joinedPaths)) {
      let message = multiGrainMessage(joinedPaths)
      for (let entry of aggExprs) {
        let entryPaths = uniqueFanoutPaths(entry.expr.fanout?.sensitivePaths || [])
        if (entryPaths.length == 0) continue
        this.diag(entry.node, message)
      }
      return
    }

    // One base-grain aggregate plus one joined grain means the base aggregate is fanned out.
    if (paths.length == 2 && joinedPaths.length == 1) {
      for (let entry of aggExprs) {
        let entryPaths = uniqueFanoutPaths(entry.expr.fanout?.sensitivePaths || [])
        if (!entryPaths.some(path => isBaseFanoutPath(path))) continue
        this.diag(entry.node, aggregateFanoutMessage(txt(entry.node), joinedPaths[0]))
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
          this.diag(entry.node, aggregateFanoutMessage(txt(entry.node), descendant))
        }
        return
      }
    }

    // Anything more complex falls back to the generic join-graph fanout diagnostic.
    let message = multiGrainMessage(paths)
    for (let entry of aggExprs) {
      let entryPaths = uniqueFanoutPaths(entry.expr.fanout?.sensitivePaths || [])
      if (entryPaths.length == 0) continue
      this.diag(entry.node, message)
    }
  }

  // Find a table by Ref node, failing if it doesn't exist
  private lookupTable(node: SyntaxNode, scope?: Scope): Table | undefined {
    let name = txt(node)
    let table: Table | undefined

    for (let scopeTable of scope?.otherTables || []) {
      if (scopeTable.name == name) table = scopeTable
    }
    let currentUri = getFile(node).path
    for (let file of this.files) {
      if (table) break
      if (file.path.endsWith('.gsql') || file.path == currentUri) {
        let match = file.tables.find(next => next.name == name)
        if (match) table = match
      }
    }
    if (!table) return this.diag(node, `Unknown table "${name}"`)
    this.analyzeView(table)
    if (table.type == 'view' && !table.query) return
    this.addReference('table', node, table.symbolId)
    return table
  }

  private addQueryField(query: Query, field: Query['fields'][number] & {diagNode?: SyntaxNode}, opts?: {prepend?: boolean}) {
    let conflicts = query.fields.filter(existing => existing.name == field.name)
    if (conflicts.length == 0) return this.insertQueryField(query, field, opts)

    if (field.disambiguatedName && conflicts.every(existing => existing.disambiguatedName)) {
      let taken = new Set(query.fields.filter(existing => existing.name != field.name).map(existing => existing.name))
      if (this.renameInferredFields(conflicts, taken, [field.disambiguatedName])) {
        field.name = field.disambiguatedName
        return this.insertQueryField(query, field, opts)
      }
    }

    if (field.disambiguatedName) {
      let taken = new Set(query.fields.filter(existing => existing.name != field.name).map(existing => existing.name))
      if (!taken.has(field.disambiguatedName)) {
        field.name = field.disambiguatedName
        conflicts = query.fields.filter(existing => existing.name == field.name)
        if (conflicts.length == 0) return this.insertQueryField(query, field, opts)
      }
    }

    if (!field.disambiguatedName && conflicts.every(existing => existing.disambiguatedName)) {
      let taken = new Set(query.fields.filter(existing => existing.name != field.name).map(existing => existing.name))
      if (this.renameInferredFields(conflicts, taken)) return this.insertQueryField(query, field, opts)
    }

    if (field.diagNode) this.diag(field.diagNode, `Duplicate output column name "${field.name}"`)
    this.insertQueryField(query, field, opts)
  }

  private insertQueryField(query: Query, field: Query['fields'][number], opts?: {prepend?: boolean}) {
    if (opts?.prepend) query.fields.unshift(field)
    else query.fields.push(field)
  }

  private renameInferredFields(fields: Query['fields'], taken: Set<string>, extraNames: string[] = []): boolean {
    let nextNames = new Set<string>()
    for (let field of fields) {
      if (!field.disambiguatedName || taken.has(field.disambiguatedName) || nextNames.has(field.disambiguatedName)) return false
      nextNames.add(field.disambiguatedName)
    }
    for (let name of extraNames) {
      if (taken.has(name) || nextNames.has(name)) return false
      nextNames.add(name)
    }
    fields.forEach(field => {
      field.name = field.disambiguatedName!
    })
    return true
  }

  private inferName(exprNode: SyntaxNode, scope: Scope, expr?: Expr): Pick<Query['fields'][number], 'name' | 'disambiguatedName'> {
    if (exprNode.name == 'Ref') {
      let names = exprNode.getChildren('Identifier').map(i => txt(i))
      return {name: names.at(-1)!, disambiguatedName: names.join('_')}
    }
    let name = expr?.metadata?.defaultName || `col_${scope.query?.fields.length || 0}`
    return {name, disambiguatedName: name}
  }

  // TODO: do we still need this?
  private unpackAnds(node: SyntaxNode, scope: Scope): Expr[] {
    if (node.name == 'BinaryExpression') {
      let op = txt(node.firstChild?.nextSibling).toLowerCase()
      if (op == 'and') return [...this.unpackAnds(node.firstChild!, scope), ...this.unpackAnds(node.lastChild!, scope)]
    }
    return [this.analyzeExpr(node, scope)]
  }

  private recordSyntaxErrors(fi: FileInfo) {
    fi.tree!.topNode.cursor().iterate(node => {
      if (node.type.isError) this.diag(node.node, 'Syntax error')
    })
  }

  private recordParsedDiagnostics(fi: FileInfo, diagnostics: {message: string; from: number; to: number}[]) {
    for (let diagnostic of diagnostics) {
      let from = this.sourcePosition(diagnostic.from, fi)
      let to = this.sourcePosition(diagnostic.to, fi)
      this.diagnostics.push({severity: 'error', message: diagnostic.message, file: toRelativePath(fi.path), from, to, frame: buildFrame(from, to)})
    }
  }

  private sourcePosition(offset: number, file: FileInfo) {
    let lines = file.contents.split(/\r?\n/)
    let acc = 0
    for (let i = 0; i < lines.length; i++) {
      let lineText = lines[i]
      let nextAcc = acc + lineText.length + 1
      if (offset < nextAcc || i === lines.length - 1) {
        let col = Math.max(0, offset - acc)
        return {offset, line: i, col, lineStart: acc, lineText}
      }
      acc = nextAcc
    }
    return {offset, line: 0, col: 0, lineText: ''}
  }

  diag<T>(node: SyntaxNode | SyntaxNodeRef, message: string, defaultReturn?: T): T {
    let file = getFile(node)
    this.diagRange(file, node.from, node.to, message)
    return defaultReturn as T
  }

  private diagRange(file: FileInfo, fromOffset: number, toOffset: number, message: string) {
    let from = getPosition(fromOffset, file)
    let to = getPosition(toOffset, file)
    this.diagnostics.push({severity: 'error', message, file: toRelativePath(file.path), from, to, frame: buildFrame(from, to)})
  }

  checkTypes(expr: Expr, expected: TypeKind[], node: SyntaxNode) {
    if (isScalarType(expr.type, 'error') || isScalarType(expr.type, 'null')) return
    if (expected.some(kind => (kind == 'array' ? isArrayType(expr.type) : isScalarType(expr.type, kind)))) return
    this.diag(node, `Expected ${expected.join(' or ')}, got ${formatType(expr.type)}`)
  }

  private renderCastType(rawType: string): string {
    if (this.config.dialect == 'postgres') {
      let normalized = rawType.trim().toLowerCase()
      let arrayMatch = normalized.match(/^array\s*<(.+)>$/s)
      if (arrayMatch) return `${this.renderCastType(arrayMatch[1])}[]`
      if (normalized == 'string') return 'VARCHAR'
      if (normalized == 'float64' || normalized == 'double') return 'DOUBLE PRECISION'
      if (normalized == 'float32') return 'REAL'
      return rawType.toUpperCase()
    }

    if (this.config.dialect != 'clickhouse') return rawType.toUpperCase()

    // ClickHouse accepts the shared Graphene type names in analysis, but some CAST
    // targets require ClickHouse-specific spellings like Float64 and Array(VARCHAR).
    let normalized = rawType.trim().toLowerCase()
    if (normalized == 'string' || normalized == 'text' || normalized == 'varchar' || normalized == 'char') return 'VARCHAR'
    if (normalized == 'float' || normalized == 'float64' || normalized == 'double' || normalized == 'double precision') return 'Float64'
    if (normalized == 'float32' || normalized == 'real') return 'Float32'

    let arrayMatch = normalized.match(/^array\s*<(.+)>$/s)
    if (arrayMatch) return `Array(${this.renderCastType(arrayMatch[1])})`
    return rawType.toUpperCase()
  }
}
