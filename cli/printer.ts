import chalk from 'chalk'
import Table from 'cli-table3'
import {styleText as nodeStyleText} from 'node:util'

import {type GrapheneError} from '../lang/core.ts'

const styleText = (style: string, text: string) => {
  try {
    return nodeStyleText ? nodeStyleText(style as any, text) : text
  } catch {
    return text
  }
}

export function printDiagnostics(diags: GrapheneError[], log?: any) {
  log ||= console.log
  let parts: string[] = []
  for (let diag of diags) {
    let sev = diag.severity === 'warn' ? 'yellow' : 'red'
    let level = diag.severity === 'warn' ? 'WARN' : 'ERROR'
    let line = diag.from ? diag.from.line + 1 : undefined
    let where = diag.file ? `${diag.file}${line ? ` line ${line}` : ''}` : 'input'
    let header = `${styleText(sev, level)}: ${where}: ${diag.message}`
    parts.push(diag.frame ? `${header}\n${diag.frame}` : header)
  }
  if (parts.length) log(parts.join('\n\n'))
}

function formatValue(v: unknown): string {
  if (v instanceof Date) {
    if (v.getUTCHours() === 0 && v.getUTCMinutes() === 0 && v.getUTCSeconds() === 0 && v.getUTCMilliseconds() === 0) {
      let y = v.getUTCFullYear()
      let m = String(v.getUTCMonth() + 1).padStart(2, '0')
      let d = String(v.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    return v.toUTCString()
  }
  return v?.toString() ?? ''
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
  displayRows.forEach(row => table.push(headers.map(h => formatValue(row[h]))))
  console.log(table.toString())
  if (rows.length > MAX_DISPLAY_ROWS) {
    console.log(chalk.yellow(`Displayed first ${MAX_DISPLAY_ROWS} rows (of ${rows.length} total).`))
  }
}
