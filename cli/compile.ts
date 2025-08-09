import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { styleText as nodeStyleText } from 'node:util'

export type CliDiagnostic = { from: number; to: number; message: string; severity: 'error' | 'warn' }

const styleText = (style: string, text: string) => {
  try {
    return nodeStyleText ? nodeStyleText(style as any, text) : text
  } catch {
    return text
  }
}

async function readStdin(): Promise<string> {
  return await new Promise<string>((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    process.stdin.resume()
  })
}

export async function readInput(inputArg?: string): Promise<string> {
  if (!inputArg || inputArg === '-') {
    return await readStdin()
  }
  try {
    const absolutePath = path.resolve(inputArg)
    const stat = await fsp.stat(absolutePath)
    if (stat.isFile()) {
      return await fsp.readFile(absolutePath, 'utf-8')
    }
  } catch {}
  return inputArg
}

function offsetToLineCol(src: string, offset: number): { line: number; col: number; lineStart: number; lineText: string } {
  const lines = src.split(/\r?\n/)
  let acc = 0
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i]
    const nextAcc = acc + lineText.length + 1 // +1 for newline
    if (offset < nextAcc || i === lines.length - 1) {
      const col = Math.max(0, offset - acc)
      return { line: i + 1, col, lineStart: acc, lineText }
    }
    acc = nextAcc
  }
  return { line: 1, col: 0, lineStart: 0, lineText: lines[0] || '' }
}

export function printDiagnostics(diags: CliDiagnostic[], src: string) {
  const parts: string[] = []
  for (const d of diags) {
    const { line, col, lineStart, lineText } = offsetToLineCol(src, d.from)
    const endCol = Math.max(col + 1, Math.min(lineText.length, d.to - lineStart))
    const caretLen = Math.max(1, endCol - col)
    const sev = d.severity === 'error' ? 'red' : 'yellow'
    const header = `${styleText(sev, d.severity.toUpperCase())}: At line ${line}, column ${col + 1}: ${d.message}`
    const gutter = '   | '
    const caretLine = `${' '.repeat(col)}${styleText(sev, '^'.repeat(caretLen))}`
    parts.push([header, `${gutter}${lineText}`, `${gutter}${caretLine}`].join('\n'))
  }
  if (parts.length) console.error(parts.join('\n'))
}