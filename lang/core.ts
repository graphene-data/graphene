import type {SyntaxNode} from '@lezer/common'
import type * as malloy from './malloyTypes.ts'
import type {Query as MalloyQuery} from '@malloydata/malloy'

export const TABLE_MAP: Record<string, Table> = {}

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

export type Expression = malloy.Expression & {
  type: string
  isAgg?: boolean
}

export interface Join extends malloy.JoinFieldDef {
  expression?: SyntaxNode | null
}

export interface Field {
  name: string
  type: string
  metadata: Record<string, string>
  e?: Expression
  path?: string[]
  isAgg?: boolean
  targetType?: string
}

export interface Table {
  type: 'table' | 'query_source'
  name: string
  analyzed: boolean
  syntaxNode: SyntaxNode
  fields: (Field | Join)[]
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
