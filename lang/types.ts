import type {SyntaxNode, Tree} from '@lezer/common'

import type {ExprFanout, FanoutPath} from './fanout.ts'
import type {ArrayField, FieldMeta, FieldType, GrapheneError, Position, ScalarField, TimeGrain, TimeOrdinal} from './index.d.ts'
import type {TimestampUnit} from './temporal.ts'

declare module '@lezer/common' {
  interface Tree {
    fileInfo?: FileInfo
  }
}

export interface AnalysisWorkspace {
  config: AnalysisConfig
  files: WorkspaceFileInput[]
}

export interface AnalysisResult {
  files: FileInfo[]
  diagnostics: GrapheneError[]
}

export interface AnalysisConfig {
  dialect: string
  defaultNamespace?: string
}

export interface WorkspaceFileInput {
  path: string
  contents: string
  kind?: FileKind
  parsed?: ParsedFileArtifacts
}

export type FileKind = 'gsql' | 'md'

export interface ParsedFileArtifacts {
  tree: Tree
  virtualContents?: string
  virtualToMarkdownOffset?: number[]
}

export type {FieldType, FieldMeta, GrapheneError, Position, ScalarField, ArrayField, TimeGrain, TimeOrdinal}
export type TypeKind = ScalarField | 'array'

let SCALAR_TYPE_ALIASES: Record<string, ScalarField> = {
  int: 'number',
  int64: 'number',
  number: 'number',
  integer: 'number',
  numeric: 'number',
  float: 'number',
  decimal: 'number',
  float32: 'number',
  float64: 'number',
  double: 'number',
  bigint: 'number',
  uint8: 'number',
  uint16: 'number',
  uint32: 'number',
  uint64: 'number',
  smallint: 'number',
  tinyint: 'number',
  byteint: 'number',
  bigdecimal: 'number',
  variant: 'string',
  object: 'json',
  text: 'string',
  string: 'string',
  varchar: 'string',
  char: 'string',
  fixedstring: 'string',
  geography: 'string',
  bool: 'boolean',
  boolean: 'boolean',
  date: 'date',
  datetime: 'timestamp',
  time: 'timestamp',
  timestamp: 'timestamp',
  datetime64: 'timestamp',
  timestamp_ntz: 'timestamp',
  timestamp_tz: 'timestamp',
  timestamp_ltz: 'timestamp',
  json: 'json',
  interval: 'interval',
}

export function scalarType<K extends ScalarField>(kind: K): K {
  return kind
}

export function arrayOf(elementType: FieldType): ArrayField {
  return {type: 'array', elementType}
}

export function isArrayType(type: FieldType | null | undefined): type is ArrayField {
  return !!type && typeof type == 'object' && type.type == 'array'
}

export function isScalarType<K extends ScalarField>(type: FieldType | null | undefined, kind?: K): type is K {
  if (!type || typeof type != 'string') return false
  return kind ? type == kind : true
}

export function isSameType(left: FieldType | null | undefined, right: FieldType | null | undefined): boolean {
  if (!left || !right) return false
  if (isArrayType(left) || isArrayType(right)) {
    if (!isArrayType(left) || !isArrayType(right)) return false
    return isSameType(left.elementType, right.elementType)
  }
  return left == right
}

export function formatType(type: FieldType | null | undefined): string {
  if (!type) return 'unknown'
  if (isArrayType(type)) {
    if (isScalarType(type.elementType, 'sql native')) return 'array'
    return `array<${formatType(type.elementType)}>`
  }
  return type
}

export function normalizeScalarType(rawType: string): ScalarField | null {
  let kind = SCALAR_TYPE_ALIASES[normalizeTypeName(rawType)]
  return kind ? scalarType(kind) : null
}

export function parseGsqlFieldType(rawType: string): {type: FieldType | null; error?: string} {
  return parseFieldType(rawType, {allowArrayKeyword: true, allowBracketArray: false, allowNamedArray: false})
}

export function parseWarehouseFieldType(rawType: string): {type: FieldType | null; error?: string; displayType?: string} {
  let parsed = parseFieldType(rawType, {allowArrayKeyword: true, allowBracketArray: true, allowNamedArray: true})
  let displayType = parsed.type && shouldNormalizeWarehouseType(rawType) ? formatType(parsed.type) : rawType
  return {...parsed, displayType}
}

function parseFieldType(rawType: string, opts: {allowArrayKeyword: boolean; allowBracketArray: boolean; allowNamedArray: boolean}): {type: FieldType | null; error?: string} {
  let value = unwrapWarehouseType(rawType.trim())
  if (!value) return {type: null}

  if (/^enum(?:8|16)\s*\(/i.test(value)) return {type: scalarType('string')}

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

  let callMatch = value.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.+)\)$/s)
  if (callMatch) {
    let typeName = normalizeTypeName(callMatch[1])
    if ((typeName == 'list' || typeName == 'array') && opts.allowNamedArray) return parseArrayType(callMatch[2], opts)
  }

  let normalizedScalarType = normalizeScalarType(value)
  return {type: normalizedScalarType}
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

function unwrapWarehouseType(rawType: string): string {
  let value = rawType.trim()
  while (true) {
    let wrapped = unwrapTypeCall(value, 'nullable') || unwrapTypeCall(value, 'lowcardinality')
    if (!wrapped) return value
    value = wrapped
  }
}

function shouldNormalizeWarehouseType(rawType: string) {
  // Schema output usually preserves the warehouse's native type spelling, but these
  // wrappers/syntax variants are mostly implementation detail and read better once
  // normalized to Graphene's shared type vocabulary.
  return /\[\]$/.test(rawType) || /^array\s*[<(]/i.test(rawType) || /^nullable\s*\(/i.test(rawType) || /^lowcardinality\s*\(/i.test(rawType) || /^enum(?:8|16)\s*\(/i.test(rawType)
}

function unwrapTypeCall(value: string, fn: string): string | null {
  if (!value.toLowerCase().startsWith(fn + '(') || !value.endsWith(')')) return null
  return value.slice(fn.length + 1, -1).trim() || null
}

// An analyzed expression - contains the SQL string plus metadata for validation
export interface Expr {
  sql: string // the SQL for this expression, e.g. "users.\"name\"" or "sum(users.\"amount\")"
  type: FieldType // result type for validation
  metadata?: FieldMeta
  isAgg?: boolean // true if contains an aggregate function
  canWindow?: boolean // true if expression can be used with an OVER clause
  interval?: IntervalExpr
  fanout?: ExprFanout
}

// A field in a query's SELECT clause
export interface QueryField extends Expr {
  name: string // output column name
  disambiguatedName?: string // alternate inferred name used when output names would otherwise collide
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
  file: FileInfo
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
  unnestExpr?: Expr
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
  metadata?: FieldMeta
  symbolId?: string
  location?: Location
}

// A table definition - discriminated union so views guarantee a query
interface TableBase {
  name: string
  tablePath: string
  filePath: string
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
  hover?: string
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
