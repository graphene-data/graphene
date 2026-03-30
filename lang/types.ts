import type {SyntaxNode, Tree} from '@lezer/common'

import type {ExprFanout, FanoutPath} from './fanout.ts'
import type {TimestampUnit} from './temporal.ts'

declare module '@lezer/common' {
  interface Tree {
    fileInfo: FileInfo
  }
}

export type ScalarTypeKind = 'string' | 'number' | 'boolean' | 'date' | 'timestamp' | 'json' | 'sql native' | 'error' | 'null' | 'interval' | 'record'
export interface ScalarFieldType<K extends ScalarTypeKind = ScalarTypeKind> {
  kind: K
}
export interface ArrayFieldType {
  kind: 'array'
  elementType: FieldType
}
export type FieldType = ScalarFieldType | ArrayFieldType
export type TypeKind = FieldType['kind']
export type TemporalGrain = 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second'

let SCALAR_TYPE_ALIASES: Record<string, ScalarTypeKind> = {
  int: 'number',
  int64: 'number',
  number: 'number',
  integer: 'number',
  numeric: 'number',
  float: 'number',
  float64: 'number',
  decimal: 'number',
  double: 'number',
  bigint: 'number',
  smallint: 'number',
  tinyint: 'number',
  byteint: 'number',
  bigdecimal: 'number',
  variant: 'string',
  object: 'json',
  text: 'string',
  string: 'string',
  varchar: 'string',
  geography: 'string',
  bool: 'boolean',
  boolean: 'boolean',
  date: 'date',
  datetime: 'timestamp',
  time: 'timestamp',
  timestamp: 'timestamp',
  timestamp_ntz: 'timestamp',
  timestamp_tz: 'timestamp',
  timestamp_ltz: 'timestamp',
  json: 'json',
  interval: 'interval',
}

export function scalarType<K extends ScalarTypeKind>(kind: K): ScalarFieldType<K> {
  return {kind}
}

export function arrayOf(elementType: FieldType): ArrayFieldType {
  return {kind: 'array', elementType}
}

export function isArrayType(type: FieldType | null | undefined): type is ArrayFieldType {
  return !!type && typeof type == 'object' && type.kind == 'array'
}

export function isScalarType<K extends ScalarTypeKind>(type: FieldType | null | undefined, kind?: K): type is ScalarFieldType<K> {
  if (!type || typeof type != 'object' || type.kind == 'array') return false
  return kind ? type.kind == kind : true
}

export function isSameType(left: FieldType | null | undefined, right: FieldType | null | undefined): boolean {
  if (!left || !right) return false
  if (isArrayType(left) || isArrayType(right)) {
    if (!isArrayType(left) || !isArrayType(right)) return false
    return isSameType(left.elementType, right.elementType)
  }
  return left.kind == right.kind
}

export function formatType(type: FieldType | null | undefined): string {
  if (!type) return 'unknown'
  if (isArrayType(type)) {
    if (isScalarType(type.elementType, 'sql native')) return 'array'
    return `array<${formatType(type.elementType)}>`
  }
  return type.kind
}

export function formatTypeKind(kind: TypeKind): string {
  return kind
}

export function normalizeScalarType(rawType: string): ScalarFieldType | null {
  let kind = SCALAR_TYPE_ALIASES[normalizeTypeName(rawType)]
  return kind ? scalarType(kind) : null
}

export function parseGsqlFieldType(rawType: string): {type: FieldType | null; error?: string} {
  return parseFieldType(rawType, {allowArrayKeyword: true, allowBracketArray: false, allowNamedArray: false})
}

export function parseWarehouseFieldType(rawType: string): {type: FieldType | null; error?: string} {
  return parseFieldType(rawType, {allowArrayKeyword: true, allowBracketArray: true, allowNamedArray: true})
}

function parseFieldType(rawType: string, opts: {allowArrayKeyword: boolean; allowBracketArray: boolean; allowNamedArray: boolean}): {type: FieldType | null; error?: string} {
  let value = rawType.trim()
  if (!value) return {type: null}

  if (opts.allowBracketArray && value.endsWith('[]')) {
    let inner = parseFieldType(value.slice(0, -2), opts)
    if (!inner.type) return inner
    if (isArrayType(inner.type)) return {type: null, error: 'Nested arrays are not supported'}
    return {type: arrayOf(inner.type)}
  }

  let match = value.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*<(.+)>$/s)
  if (match) {
    let typeName = normalizeTypeName(match[1])
    if (typeName == 'array' && opts.allowArrayKeyword) return parseArrayType(match[2], opts)
    if ((typeName == 'list' || typeName == 'array') && opts.allowNamedArray) return parseArrayType(match[2], opts)
  }

  let scalarType = normalizeScalarType(value)
  return {type: scalarType}
}

function parseArrayType(innerType: string, opts: {allowArrayKeyword: boolean; allowBracketArray: boolean; allowNamedArray: boolean}): {type: FieldType | null; error?: string} {
  let parsed = parseFieldType(innerType, opts)
  if (!parsed.type) return parsed
  if (isArrayType(parsed.type)) return {type: null, error: 'Nested arrays are not supported'}
  return {type: arrayOf(parsed.type)}
}

function normalizeTypeName(rawType: string): string {
  return rawType.trim().replace(/\s+/g, '_').toLowerCase()
}

export interface TemporalFieldMetadata {
  grain: TemporalGrain
}

export interface FieldMetadata {
  temporal?: TemporalFieldMetadata
}

// An analyzed expression - contains the SQL string plus metadata for validation
export interface Expr {
  sql: string // the SQL for this expression, e.g. "users.\"name\"" or "sum(users.\"amount\")"
  type: FieldType // result type for validation
  isAgg?: boolean // true if contains an aggregate function
  canWindow?: boolean // true if expression can be used with an OVER clause
  interval?: IntervalExpr
  fanout?: ExprFanout
  fieldMetadata?: FieldMetadata
}

// A field in a query's SELECT clause
export interface QueryField extends Expr {
  name: string // output column name
  metadata?: Record<string, string>
  fieldMetadata?: FieldMetadata
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
  setOp?: 'union' | 'union all' | 'intersect' | 'except'
  branches?: {query: Query; parenthesized?: boolean}[]
}

// A column definition (from table schema or computed)
export interface Column {
  name: string
  type: FieldType
  isAgg?: boolean // for computed columns that are aggregates
  exprNode?: SyntaxNode // for computed columns, the expression AST node (analyzed lazily in query context)
  metadata?: Record<string, string>
  fieldMetadata?: FieldMetadata
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
