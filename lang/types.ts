import type {SyntaxNode, Tree} from '@lezer/common'
import type {Expr, JoinFieldDef, Query as MalloyQuery} from '@malloydata/malloy'

declare module '@lezer/common' {
  interface Tree {
    fileInfo: FileInfo
  }
}

export interface Scope {
  table: Table,
  outputFields: ColumnField[]
}

export type Expression = Expr & {
  type: FieldType
  isAgg?: boolean
}

export type Join = JoinFieldDef & {
  expression?: SyntaxNode | null
  tablePath?: string // we set this on tables, which get cloned in to joins.
}

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'timestamp' | 'json' | 'sql native' | 'error' | 'fieldref' | 'array' | 'record';

export interface ColumnField {
  name: string
  type: FieldType
  metadata: Record<string, string>
  e?: Expression
  path?: string[]
  isAgg?: boolean
  targetType?: string
  expressionType?: string
}

export type Field = ColumnField | Join

export interface Table {
  type: 'table' | 'query_source'
  name: string
  fields: (Field | Join)[]
  analyzed?: boolean
  metadata: Record<string, string>
  connection?: string
  dialect?: string
  tablePath?: string
  primaryKey?: string
  query?: MalloyQuery
}

export interface Query {
  fields: Field[]
  subQuerySources: Table[]
  malloyQuery: MalloyQuery
}

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
}
