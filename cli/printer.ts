import chalk from 'chalk'
import Table from 'cli-table3'
import {styleText as nodeStyleText} from 'node:util'

import {type Diagnostic, type FileInfo} from '../lang/core.ts'
// import {logTree} from './logTree.ts'

const styleText = (style: string, text: string) => {
  try {
    return nodeStyleText ? nodeStyleText(style as any, text) : text
  } catch {
    return text
  }
}

function offsetToLineCol(src: string, offset: number): {line: number; col: number; lineStart: number; lineText: string} {
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

export function printDiagnostics(diags: Diagnostic[], files: Record<string, FileInfo>, log?: any) {
  log ||= console.log
  let parts: string[] = []
  for (let d of diags) {
    let src = files[d.file]?.contents || ''
    let {line, col, lineStart, lineText} = offsetToLineCol(src, d.from.offset)
    let endCol = Math.max(col + 1, Math.min(lineText.length, d.to.offset - lineStart))
    let caretLen = Math.max(1, endCol - col)
    let sev = d.severity === 'error' ? 'red' : 'yellow'
    let header = `${styleText(sev, d.severity.toUpperCase())}: ${d.file} line ${line}: ${d.message}`
    let gutter = '   | '
    let caretLine = `${' '.repeat(col)}${styleText(sev, '^'.repeat(caretLen))}`
    parts.push([header, `${gutter}${lineText}`, `${gutter}${caretLine}`].join('\n'))
  }
  if (parts.length) log(parts.join('\n'))
}

export function printTable(rows: any[]) {
  if (!rows || rows.length === 0) {
    console.log(chalk.yellow('No results returned'))
    return
  }

  let headers = Object.keys(rows[0])
  let table = new Table({head: headers.map(h => chalk.blue(h))})
  let MAX_DISPLAY_ROWS = 200
  let displayRows = rows.slice(0, MAX_DISPLAY_ROWS)
  displayRows.forEach(row => table.push(headers.map(h => row[h]?.toString() || '')))
  console.log(table.toString())
  if (rows.length > MAX_DISPLAY_ROWS) {
    console.log(chalk.yellow(`Displayed first ${MAX_DISPLAY_ROWS} rows (of ${rows.length} total).`))
  }
}
