import type {SyntaxNode, Tree} from '@lezer/common'

import type {ExprFanout, FanoutPath} from './fanout.ts'
import type {TimestampUnit} from './temporal.ts'

declare module '@lezer/common' {
  interface Tree {
    fileInfo: FileInfo
  }
}

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'timestamp' | 'json' | 'sql native' | 'error' | 'null' | 'interval' | 'array' | 'record'

export interface Workspace {
  files: Record<string, FileInfo>
  diagnostics: GrapheneError[]
  options: AnalysisOptions
  analysisStack: Set<Column>
}

export interface WorkspaceAnalysis {
  files: Record<string, FileInfo>
  diagnostics: GrapheneError[]
  queries: Query[]
}

export interface AnalysisOptions {
  dialect: string
  defaultNamespace?: string
}

export interface AnalysisFileInput {
  path: string
  contents: string
  // Only needed for legacy inline `analyze(contents, contentType)` calls, where the
  // synthetic "input" path has no extension to tell md from gsql.
  contentType?: 'gsql' | 'md'
}

export interface AnalysisInput {
  files: AnalysisFileInput[]
  options: AnalysisOptions
  targetPath?: string
}

// An analyzed expression - contains the SQL string plus metadata for validation
export interface Expr {
  sql: string // the SQL for this expression, e.g. "users.\"name\"" or "sum(users.\"amount\")"
  type: FieldType // result type for validation
  isAgg?: boolean // true if contains an aggregate function
  canWindow?: boolean // true if expression can be used with an OVER clause
  interval?: IntervalExpr
  fanout?: ExprFanout
}

// A field in a query's SELECT clause
export interface QueryField extends Expr {
  name: string // output column name
  metadata?: Record<string, string>
  definitionLocation?: Location // where this field is defined when materialized into a view
}

// A filter (WHERE or HAVING)
export interface Filter {
  sql: string
  isAgg?: boolean // if true, goes in HAVING; otherwise WHERE
}

// Interval lowering metadata carried on interval-typed expressions, so later analysis
// can rewrite them into the dialect-specific syntax each warehouse expects.
export interface IntervalExpr {
  quantitySql: string
  unit: TimestampUnit
  form: 'constant' | 'dynamic' | 'scaled'
}

// Context for analyzing expressions - table/alias change as we traverse joins, but query is shared
export interface Scope {
  query?: Query // null when analyzing table definitions (not in a query context)
  table?: Table
  alias: string // current alias for this table context (e.g., "users", "orders", "users_orders")
  fanoutPath?: FanoutPath
  otherTables?: Table[] // CTEs and other tables visible for name resolution
  joinTarget?: {name: string; table: Table; alias: string} // When analyzing a join's ON clause, tells us about the target table/alias.
}

export type JoinType = 'left' | 'right' | 'full' | 'inner' | 'cross'

// A join relation used throughout analysis.
// For table-defined joins, targetTable/onExpr are populated first.
// For analyzed query joins, table/onClause are populated.
export interface QueryJoin {
  alias: string
  source: 'from' | 'ad-hoc' | 'implicit'
  table?: Table
  targetTable?: string
  cardinality?: 'one' | 'many'
  fanoutPath?: FanoutPath
  joinType?: JoinType
  onClause?: string
  onExpr?: SyntaxNode
  targetNode?: SyntaxNode
}

// A fully analyzed query
export interface Query {
  sql: string // the complete SQL string
  fields: QueryField[] // SELECT columns
  joins: QueryJoin[] // JOINs needed for this query
  filters: Filter[] // WHERE/HAVING conditions
  groupBy: string[] // field names for GROUP BY
  orderBy: {idx: number; desc: boolean}[] // ORDER BY (1-indexed field indices)
  limit?: number
}

// A column definition (from table schema or computed)
export interface Column {
  name: string
  type: FieldType
  isAgg?: boolean // for computed columns that are aggregates
  exprNode?: SyntaxNode // for computed columns, the expression AST node (analyzed lazily in query context)
  metadata?: Record<string, string>
  symbolId?: string
  location?: Location
}

// A table definition - discriminated union so views guarantee a query
interface TableBase {
  name: string
  tablePath: string
  columns: Column[]
  joins: QueryJoin[]
  metadata?: Record<string, string>
  syntaxNode?: SyntaxNode
  symbolId?: string
  location?: Location
}
export interface PhysicalTable extends TableBase {
  type: 'table'
}
export interface ViewTable extends TableBase {
  type: 'view'
  query: Query
  analyzed?: boolean
}
export interface CteTable extends TableBase {
  type: 'cte'
  query: Query
}
export interface SubqueryTable extends TableBase {
  type: 'subquery'
  query: Query
}
export type Table = PhysicalTable | ViewTable | CteTable | SubqueryTable

export interface Position {
  offset: number
  line: number
  col: number
  lineStart?: number
  lineText?: string
}

export interface GrapheneError {
  message: string
  name?: string
  stack?: string
  cause?: unknown
  severity?: 'error' | 'warn'
  queryId?: string
  file?: string
  from?: Position
  to?: Position
  frame?: string
}

export interface Location {
  file: string
  from: Position
  to: Position
}

export type NavigationSymbolKind = 'table' | 'column'

export interface NavigationSymbol {
  id: string
  kind: NavigationSymbolKind
  name: string
  location: Location
  tableId?: string
}

export interface NavigationReference {
  kind: NavigationSymbolKind
  location: Location
  targetId: string
}

export interface FileNavigation {
  symbols: NavigationSymbol[]
  references: NavigationReference[]
}

export interface FileInfo {
  path: string
  contents: string
  tree: Tree | null
  tables: Table[]
  queries: Query[]
  navigation: FileNavigation
  virtualContents?: string
  virtualToMarkdownOffset?: number[]
}
