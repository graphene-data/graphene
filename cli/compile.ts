import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import {styleText as nodeStyleText} from 'node:util'
import {analyze, type Diagnostic, loadWorkspace, type Query} from '@graphene/lang'

export async function readAndCompile (inputArg?: string, debug?: boolean): Promise<Query[]> {
  await loadWorkspace(process.cwd())
  let src = await readInput(inputArg)

  let {tables, queries} = analyze(src)
  let diags = [...tables, ...queries].flatMap(x => x.diagnostics)

  if (debug) {
    console.log(queries[0].treeNode?.toString())
  }

  let errors = diags.filter((d) => d.severity === 'error')
  if (errors.length) {
    printDiagnostics(errors, src)
  }

  return queries
}

const styleText = (style: string, text: string) => {
  try {
    return nodeStyleText ? nodeStyleText(style as any, text) : text
  } catch {
    return text
  }
}

async function readStdin (): Promise<string> {
  return await new Promise<string>((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    process.stdin.resume()
  })
}

export async function readInput (inputArg?: string): Promise<string> {
  if (!inputArg || inputArg === '-') {
    return await readStdin()
  }
  let absolutePath = path.resolve(inputArg)
  let exists = await fs.existsSync(absolutePath)
  if (exists) {
    return await fsp.readFile(absolutePath, 'utf-8')
  }

  return inputArg
}

function offsetToLineCol (src: string, offset: number): { line: number; col: number; lineStart: number; lineText: string } {
  let lines = src.split(/\r?\n/)
  let acc = 0
  for (let i = 0; i < lines.length; i++) {
    let lineText = lines[i]
    let nextAcc = acc + lineText.length + 1 // +1 for newline
    if (offset < nextAcc || i === lines.length - 1) {
      let col = Math.max(0, offset - acc)
      return {line: i + 1, col, lineStart: acc, lineText}
    }
    acc = nextAcc
  }
  return {line: 1, col: 0, lineStart: 0, lineText: lines[0] || ''}
}

export function printDiagnostics (diags: Diagnostic[], src: string) {
  let parts: string[] = []
  for (let d of diags) {
    let {line, col, lineStart, lineText} = offsetToLineCol(src, d.from)
    let endCol = Math.max(col + 1, Math.min(lineText.length, d.to - lineStart))
    let caretLen = Math.max(1, endCol - col)
    let sev = d.severity === 'error' ? 'red' : 'yellow'
    let header = `${styleText(sev, d.severity.toUpperCase())}: At line ${line}, column ${col + 1}: ${d.message}`
    let gutter = '   | '
    let caretLine = `${' '.repeat(col)}${styleText(sev, '^'.repeat(caretLen))}`
    parts.push([header, `${gutter}${lineText}`, `${gutter}${caretLine}`].join('\n'))
  }
  if (parts.length) console.error(parts.join('\n'))
}
