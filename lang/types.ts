import type {SyntaxNode, Tree} from '@lezer/common'

import type {FanoutPath} from './fanout.ts'

declare module '@lezer/common' {
  interface Tree {
    fileInfo: FileInfo
  }
}

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'timestamp' | 'json' | 'sql native' | 'error' | 'null' | 'interval' | 'array' | 'record'

// An analyzed expression - contains the SQL string plus metadata for validation
export interface Expr {
  sql: string // the SQL for this expression, e.g. "users.\"name\"" or "sum(users.\"amount\")"
  type: FieldType // result type for validation
  isAgg?: boolean // true if contains an aggregate function
  canWindow?: boolean // true if expression can be used with an OVER clause
  fanoutPath?: FanoutPath // grain implied by this scalar expression, relative to the base table
  fanoutSensitivePaths?: FanoutPath[] // aggregate grains in this expression that are sensitive to row duplication
  fanoutConflict?: boolean // true if the expression mixes incompatible grains
}

// A field in a query's SELECT clause
export interface QueryField extends Expr {
  name: string // output column name
  metadata?: Record<string, string>
}

// A filter (WHERE or HAVING)
export interface Filter {
  sql: string
  isAgg?: boolean // if true, goes in HAVING; otherwise WHERE
}

// Context for analyzing expressions - table/alias change as we traverse joins, but query is shared
export interface Scope {
  query?: Query // null when analyzing table definitions (not in a query context)
  table?: Table
  alias: string // current alias for this table context (e.g., "users", "orders", "users_orders")
  localityPath?: FanoutPath
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
  localityPath?: FanoutPath
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
  groupBy: number[] // indices into fields for GROUP BY (1-indexed)
  orderBy: {idx: number; desc: boolean}[] // ORDER BY (1-indexed field indices)
  limit?: number
  isAggregate: boolean // true if this query has any aggregation
}

// A column definition (from table schema or computed)
export interface Column {
  name: string
  type: FieldType
  isAgg?: boolean // for computed columns that are aggregates
  exprNode?: SyntaxNode // for computed columns, the expression AST node (analyzed lazily in query context)
  metadata?: Record<string, string>
}

// A table definition - discriminated union so views guarantee a query
interface TableBase {
  name: string
  tablePath: string
  columns: Column[]
  joins: QueryJoin[]
  metadata?: Record<string, string>
  syntaxNode?: SyntaxNode
}
export interface PhysicalTable extends TableBase {
  type: 'table'
}
export interface ViewTable extends TableBase {
  type: 'view'
  query: Query
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
}

export interface Diagnostic {
  file: string
  from: Position
  to: Position
  message: string
  severity: 'error' | 'warn'
}

export interface FileInfo {
  path: string
  contents: string
  tree: Tree | null
  tables: Table[]
  queries: Query[]
  virtualContents?: string
  virtualToMarkdownOffset?: number[]
}
