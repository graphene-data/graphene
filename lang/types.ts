import type {SyntaxNode, Tree} from '@lezer/common'

declare module '@lezer/common' {
  interface Tree {
    fileInfo: FileInfo
  }
}

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'timestamp' | 'json' | 'sql native' | 'error' | 'null' | 'interval' | 'array' | 'record'

// An analyzed expression - contains the SQL string plus metadata for validation
export interface Expr {
  sql: string        // the SQL for this expression, e.g. "base.\"name\"" or "sum(base.\"amount\")"
  type: FieldType    // result type for validation
  isAgg?: boolean    // true if contains an aggregate function
}

// A field in a query's SELECT clause
export interface QueryField extends Expr {
  name: string                 // output column name
  metadata?: Record<string, string>
}

// A filter (WHERE or HAVING)
export interface Filter {
  sql: string
  isAgg?: boolean  // if true, goes in HAVING; otherwise WHERE
}

// A join used in a query (with alias for rendering)
export interface QueryJoin {
  alias: string                // e.g., "orders_0"
  targetTable: string          // name of the table being joined
  onClause: string             // SQL for the ON expression
}

// A fully analyzed query
export interface Query {
  sql: string                  // the complete SQL string
  baseTable: string            // name of the table in FROM
  fields: QueryField[]         // SELECT columns
  joins: QueryJoin[]           // JOINs needed for this query
  filters: Filter[]            // WHERE/HAVING conditions
  groupBy: number[]            // indices into fields for GROUP BY (1-indexed)
  orderBy: {idx: number, desc: boolean}[]  // ORDER BY (1-indexed field indices)
  limit?: number
  isAggregate: boolean         // true if this query has any aggregation
}

// A column definition (from table schema or computed)
export interface Column {
  name: string
  type: FieldType
  isAgg?: boolean              // for computed columns that are aggregates
  exprNode?: SyntaxNode        // for computed columns, the expression AST node (analyzed lazily in query context)
  metadata?: Record<string, string>
}

// Join definition on a table
export interface Join {
  name: string                 // alias for this join in the current table
  targetTable: string          // name of the table being joined
  joinType: 'one' | 'many'
  onExpr: SyntaxNode          // ON clause AST node (analyzed lazily with correct aliases)
  targetNode: SyntaxNode
}

// A table definition - discriminated union so views guarantee a query
interface TableBase {
  name: string
  tablePath: string
  columns: Column[]
  joins: Join[]
  metadata?: Record<string, string>
  syntaxNode?: SyntaxNode
}
export interface PhysicalTable extends TableBase { type: 'table' }
export interface ViewTable extends TableBase { type: 'view', query: Query }
export type Table = PhysicalTable | ViewTable

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
