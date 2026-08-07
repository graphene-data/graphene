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

interface FormatErrorOptions {
  message?: string
  style?: boolean
}

// Formats regular errors, API failures, and diagnostics. Styled output adds diagnostic severity, location, and frames.
export function formatError(error: unknown | unknown[], options: FormatErrorOptions = {}): string {
  if (Array.isArray(error)) return error.map(item => formatError(item, options)).join('\n\n')
  if (!error || typeof error != 'object') return options.message || String(error)

  let root = error as GrapheneError & {code?: unknown}
  let value: {code?: unknown; cause?: unknown} = root
  let code = value.code
  while (!code && value.cause && typeof value.cause == 'object') {
    value = value.cause as typeof value
    code = value.code
  }

  let message = options.message || root.message || String(error)
  if (code && !message.includes(String(code))) message += ` (${code})`
  if (!options.style) return message

  let color = root.severity === 'warn' ? 'yellow' : 'red'
  let level = root.severity === 'warn' ? 'WARN' : 'ERROR'
  let line = root.from ? root.from.line + 1 : undefined
  let where = root.file ? `${root.file}${line ? ` line ${line}` : ''}` : 'input'
  let header = `${styleText(color, level)}: ${where}: ${message}`
  return root.frame ? `${header}\n${root.frame}` : header
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
