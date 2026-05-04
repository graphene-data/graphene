import type {SyntaxNode, SyntaxNodeRef} from '@lezer/common'

import type {FileInfo} from './types.ts'

function markdownOffset(offset: number, file: FileInfo) {
  let map = file.virtualToMarkdownOffset
  if (!map || map.length === 0) return offset
  if (offset <= 0) return map[0] ?? 0
  if (offset >= map.length) return map[map.length - 1]
  return map[offset]
}

function virtualOffset(offset: number, file: FileInfo) {
  let map = file.virtualToMarkdownOffset
  if (!map || map.length === 0) return offset
  if (offset <= map[0]) return 0
  if (offset >= map[map.length - 1]) return map.length - 1

  let low = 0
  let high = map.length - 1
  while (low < high) {
    let mid = Math.floor((low + high) / 2)
    if (map[mid] >= offset) high = mid
    else low = mid + 1
  }
  return low
}

export function getPosition(offset: number, file: FileInfo) {
  let mdOffset = markdownOffset(offset, file)
  let lines = file.contents.split(/\r?\n/)
  let acc = 0
  for (let i = 0; i < lines.length; i++) {
    let lineText = lines[i]
    let nextAcc = acc + lineText.length + 1
    if (mdOffset < nextAcc || i === lines.length - 1) {
      let col = Math.max(0, mdOffset - acc)
      return {offset: mdOffset, line: i, col, lineStart: acc, lineText}
    }
    acc = nextAcc
  }
  return {offset: mdOffset, line: 1, col: 0}
}

export function getSourceOffset(line: number, col: number, file: FileInfo) {
  let lines = file.contents.split(/\r?\n/)
  let acc = 0
  for (let i = 0; i < line; i++) {
    acc += lines[i].length + 1
  }
  return acc + col
}

export function getOffset(line: number, col: number, file: FileInfo) {
  let offset = getSourceOffset(line, col, file)
  if (file.virtualContents) return virtualOffset(offset, file)
  return offset
}

export function getFile(node: SyntaxNode | SyntaxNodeRef): FileInfo {
  if (node.node) node = node.node
  let top: SyntaxNode = node as SyntaxNode
  while (top.parent) top = top.parent
  return top!.tree!.fileInfo!
}

export function txt(node: SyntaxNode | null | undefined) {
  if (!node) return ''
  let file = getFile(node)
  let source = file.virtualContents ?? file.contents
  return source.substring(node.from, node.to) || ''
}

export function compact<T>(obj: T): T {
  return Object.fromEntries(Object.entries(obj as any).filter(([_, v]) => v !== undefined)) as T
}

export function trimIndentation(str: string) {
  let lines = str.trim().split('\n')
  let indent = lines
    .slice(1)
    .filter(l => l.trim() !== '')
    .map(l => l.match(/^\s*/)![0].length)

  let toRemove = Math.min(...indent)
  return lines
    .map((line, index) => {
      if (index == 0) return line
      if (line.trim() === '') return ''
      return line.slice(toRemove)
    })
    .join('\n')
}

export function toRelativePath(path: string): string {
  return path
    .replace(/^file:\/\//, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
}

export function buildFrame(from: {line: number; col: number; lineText?: string}, to: {line: number; col: number}) {
  let lineText = from.lineText || ''
  let endCol = from.line === to.line ? Math.max(from.col + 1, to.col) : lineText.length
  let safeEnd = Math.max(from.col + 1, Math.min(lineText.length, endCol))
  let caretLen = Math.max(1, safeEnd - from.col)
  return `${lineText}\n${' '.repeat(from.col)}${'^'.repeat(caretLen)}`
}

export function formatSourceLocation(contents: string, path: string, offset: number) {
  let before = contents.slice(0, offset)
  let line = before.split('\n').length
  let col = before.length - before.lastIndexOf('\n')
  return `${path}:${line}:${col}`
}

export async function pollFor<T>(fn: () => T, timeoutMs: number, interval?: number): Promise<T | null> {
  let end = Date.now() + timeoutMs
  while (Date.now() < end) {
    let res = fn()
    if (res) return res
    await new Promise(r => setTimeout(r, interval))
  }
  return null
}
