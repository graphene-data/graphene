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
// There are a few built-in ones that Graphene already uses, but you can always attach your own metadata:
// `price: cogs * 1.15 #units=usd #format="US Dollar"` -> {units: 'usd', format: 'US Dollar'}
export type FieldMeta = {
  ratio?: true // 0 to 1 value
  pct?: true // 0 to 100 value
  units?: string
  timeGrain?: TimeGrain // resolution when the field is a date or timestamp
  [key: string]: string | true | undefined
}

export type FieldType = ScalarField | ArrayField
export type ScalarField = 'string' | 'number' | 'boolean' | 'date' | 'timestamp' | 'json' | 'sql native' | 'error' | 'null' | 'interval' | 'record'
export type ArrayField = {type: 'array'; elementType: FieldType}

export type TimeGrain = 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second'

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

export interface Position {
  offset: number
  line: number
  col: number
  lineStart?: number
  lineText?: string
}
