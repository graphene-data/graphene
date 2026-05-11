// Standard Graphene error shape used by query responses and diagnostics.
// Result payload returned by Graphene query execution endpoints.
export interface QueryResult {
  rows: any[]
  fields: Field[]
  error?: GrapheneError
  hash?: string // hash of the compiled sql for caching
  sql?: string
}

// A single output column in a query result.
export type Field = {
  name: string
  type: FieldType
  metadata?: FieldMeta
}

// Metadata attached to fields.
// Graphene validates user-authored metadata annotations, while inferred metadata may add internal keys.
// `price: cogs * 1.15 #ratio #format="US Dollar"` -> {ratio: true, format: 'US Dollar'}
export type FieldMeta = {
  ratio?: true // 0 to 1 value
  pct?: true // 0 to 100 value
  currency?: string // ISO 4217 currency code
  unit?: string // physical unit label
  timeGrain?: TimeGrain // resolution when the field is a date or timestamp
  timePart?: string // extracted temporal part, normalized across backend spellings
  timeOrdinal?: TimeOrdinal // if the value represents something special like day_of_week, week_of_year, etc
  defaultName?: string // preferred output column name when an expression is selected without an alias
  [key: string]: string | true | undefined
}

export type FieldType = ScalarField | ArrayField
export type ScalarField = 'string' | 'number' | 'boolean' | 'date' | 'timestamp' | 'json' | 'sql native' | 'error' | 'null' | 'interval' | 'record'
export type ArrayField = {type: 'array'; elementType: FieldType}

export type TimeGrain = 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second'
export type TimeOrdinal = 'hour_of_day' | DayOfWeekOrdinal | 'day_of_month' | 'day_of_year' | 'week_of_year' | 'month_of_year' | 'quarter_of_year'

export type DayOfWeekOrdinal =
  | 'dow_1s' // 1-7, starting sunday
  | 'dow_0s' // 0-6, starting sunday
  | 'dow_1m' // 1-7, starting monday

export interface GrapheneError {
  message: string
  name?: string
  stack?: string
  cause?: unknown
  severity?: 'error' | 'warn'
  componentId?: string
  file?: string
  from?: Position
  to?: Position
  frame?: string
}

export interface Position {
  offset: number
  line: number
  col: number
  lineStart?: number
  lineText?: string
}
