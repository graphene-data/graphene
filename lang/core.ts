import type {SyntaxNode} from '@lezer/common'

export const TABLE_MAP: Record<string, Table> = {}

export function txt (node:SyntaxNode | null | undefined) {
  if (!node) return ''
  let top: SyntaxNode = node
  while (top.parent) top = top.parent
  return top?.tree?.rawText.substring(node.from, node.to) || ''
}

// function getDescendants (node:SyntaxNode, type:string) {
//   let res = [] as SyntaxNode[]
//   node.cursor().iterate(n => {
//     if (n.name == type) res.push(n.node)
//   })
//   return res
// }
//

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
}

type Field = Column | Join | Computed

export interface Table {
  name: string
  fields: Record<string, Field>
  diagnostics?: Diagnostic[]
}

export class Query {
  sql = ''
  tables: Record<string, Join> = {}
  fields: Record<string, Column> = {}
  isAgg = false
  diagnostics: Diagnostic[] = []
}

export interface Diagnostic {
  from: number
  to: number
  message: string
  severity: 'error' | 'warn'
}
