import type {SyntaxNode} from '@lezer/common'

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

  interface SyntaxNode {
    sql?: string
  }
}

export interface Column {
  type: 'column'
  name: string
  dataType: string
  metadata: Record<string, string>
}

export interface Join {
  type: 'join'
  alias: string
  tableName?: string
  expression?: SyntaxNode | null
  subquery?: Query
}

export interface Computed {
  type: 'computed'
  name: string
  expression: SyntaxNode
  metadata: Record<string, string>
}

type Field = Column | Join | Computed

export class Table {
  name: string
  fields: Record<string, Field> = {}
  diagnostics: Diagnostic[] = []
  metadata: Record<string, string> = {}
  asQuery: Query | null = null

  constructor (name: string) {
    this.name = name
  }

  diag (node: SyntaxNode, message: string, severity: 'error' | 'warn' = 'error') {
    let from = node.from
    let to = Math.max(node.to, node.from)
    this.diagnostics.push({from, to, message, severity})
  }
}

export class Query {
  sql = ''
  tables: Record<string, Join> = {}
  fields: Record<string, Column> = {}
  isAgg = false
  diagnostics: Diagnostic[] = []
  treeNode: SyntaxNode | null = null

  diag (node: SyntaxNode, message: string, severity: 'error' | 'warn' = 'error') {
    let from = node.from
    let to = Math.max(node.to, node.from)
    this.diagnostics.push({from, to, message, severity})
  }
}

export interface Diagnostic {
  from: number
  to: number
  message: string
  severity: 'error' | 'warn'
}
