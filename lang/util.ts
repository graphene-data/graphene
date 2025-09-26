import type {Expression, FileInfo} from './types'
import type {SyntaxNode, SyntaxNodeRef} from '@lezer/common'

export function getPosition (offset: number, file: FileInfo) {
  let lines = file.contents.split(/\r?\n/)
  let acc = 0
  for (let i = 0; i < lines.length; i++) {
    let lineText = lines[i]
    let nextAcc = acc + lineText.length + 1 // +1 for newline
    if (offset < nextAcc || i === lines.length - 1) {
      let col = Math.max(0, offset - acc)
      return {offset, line: i, col, lineStart: acc, lineText}
    }
    acc = nextAcc
  }
  return {offset, line: 1, col: 0}
}

export function getOffset (line: number, col: number, file: FileInfo) {
  let lines = file.contents.split(/\r?\n/)
  let acc = 0
  for (let i = 0; i < line; i++) {
    acc += lines[i].length + 1
  }
  return acc + col
}

export function getFile (node: SyntaxNode | SyntaxNodeRef): FileInfo {
  if (node.node) node = node.node // SyntaxNodeRef has a `tree` prop, but it's wrong, so create a SyntaxNode and walk up
  let top: SyntaxNode = node as SyntaxNode
  while (top.parent) top = top.parent
  return top!.tree!.fileInfo
}

export function txt (node:SyntaxNode | null | undefined) {
  if (!node) return ''
  return getFile(node).contents.substring(node.from, node.to) || ''
}

export function compact<T> (obj: T): T {
  return Object.fromEntries(Object.entries(obj as any).filter(([_, v]) => v !== undefined)) as T
}

export function walkExpression (root: any, fn: (expr: Expression, parent?: Expression | null) => void, parent: Expression | null = null) {
  if (!root) return
  fn(root, parent)
  if (root.e) walkExpression(root.e, fn, root)
  if (root.kids) {
    Object.values(root.kids).forEach(kid => {
      if (Array.isArray(kid)) kid.forEach(k => walkExpression(k, fn, root))
      else walkExpression(kid, fn, root)
    })
  }
}

export function trimIndentation (str:string) {
  let lines = str.split('\n')
  let indent = lines.slice(1)
    .filter(l => l.trim() !== '') // empty lines don't count
    .map(l => l.match(/^\s*/)![0].length)

  let toRemove = Math.min(...indent)
  return lines.map((line, index) => {
    if (index == 0) return line
    if (line.trim() === '') return '' // empty lines don't count
    return line.slice(toRemove)
  }).join('\n')
}
