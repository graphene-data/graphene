import type {SyntaxNode} from '@lezer/common'
import type {Expr, JoinFieldDef, Query as MalloyQuery} from '@malloydata/malloy'

export function txt (node:SyntaxNode | null | undefined) {
  if (!node) return ''
  let top: SyntaxNode = node
  while (top.parent) top = top.parent
  return top?.tree?.rawText.substring(node.from, node.to) || ''
}

declare module '@lezer/common' {
  interface Tree {
    rawText: string
  }
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
}

export type Field = ColumnField | Join

export interface Table {
  type: 'table' | 'query_source'
  name: string
  fields: (Field | Join)[]
  syntaxNode: SyntaxNode
  analyzed?: boolean
  metadata: Record<string, string>
  connection?: string
  dialect?: string
  tablePath?: string
  query?: MalloyQuery
}

export interface Query {
  fields: Field[]
  malloyQuery: MalloyQuery
}

export interface Diagnostic {
  from: number
  to: number
  message: string
  severity: 'error' | 'warn'
}
