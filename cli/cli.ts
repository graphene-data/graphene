#!/usr/bin/env node

import { Command } from 'commander'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { analyze, loadWorkspace } from '@graphene/lang'
import Table from 'cli-table3'
import chalk from 'chalk'
import { serve } from './serve'
import { styleText as nodeStyleText } from 'node:util'
// Import parser directly from workspace to enable --debug parse tree printing
// This relies on monorepo layout where `cli` and `lang` are siblings.
import { parser } from '../lang/parser.js'

// Minimal Diagnostic type for CLI usage
type Diag = { from: number; to: number; message: string; severity: 'error' | 'warn' }

interface Results {
  rows: any[]
}

interface Db {
  query: (query: string) => Promise<Results>
}

const styleText = (style: string, text: string) => {
  try {
    return nodeStyleText ? nodeStyleText(style as any, text) : text
  } catch {
    return text
  }
}

async function connectToDb(): Promise<Db | null> {
  const files = fs.readdirSync('.')
  const duckFiles = files.filter((file: string) => file.endsWith('.duckdb'))

  if (duckFiles[0]) {
    console.log(chalk.dim(`Using database: ${duckFiles[0]}`))
    let module: any
    try {
      module = await import('@duckdb/node-api')
    } catch (_) {
      console.error('❌  @duckdb/node-api package not installed – unable to execute. Install with `npm i @duckdb/node-api`.')
      return null
    }

    const db = await module.DuckDBInstance.create(duckFiles[0], { access_mode: 'READ_ONLY' })
    const conn = await db.connect()

    return {
      query: async (q) => {
        const reader = await conn.runAndReadAll(q)
        return { rows: reader.getRowObjects() }
      },
    }
  }
  return null
}

function printTable(rows: any[]) {
  if (!rows || rows.length === 0) {
    console.log(chalk.yellow('No results returned'))
    return
  }

  const headers = Object.keys(rows[0])
  const table = new Table({ head: headers.map((h) => chalk.blue(h)) })
  rows.forEach((row) => table.push(headers.map((h) => row[h]?.toString() || '')))
  console.log(table.toString())
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

function formatDiagnosticsPretty(diags: Diag[], src: string): string {
  const parts: string[] = []
  for (const d of diags) {
    const { line, col, lineStart, lineText } = offsetToLineCol(src, d.from)
    const endCol = Math.max(col + 1, Math.min(lineText.length, d.to - lineStart))
    const caretLen = Math.max(1, endCol - col)
    const header = `${styleText('red', 'Error')}: At line ${line}, column ${col + 1}: ${d.message}`
    const gutter = '   | '
    const caretLine = `${' '.repeat(col)}${styleText('red', '^'.repeat(caretLen))}`
    parts.push([header, `${gutter}${lineText}`, `${gutter}${caretLine}`].join('\n'))
  }
  return parts.join('\n')
}

function collectDiagnosticsFromAnalyze(source: string): { diags: Diag[]; sqls: string[] } {
  const { tables, queries } = analyze(source)
  const diags = [
    ...tables.flatMap((t: any) => t.diagnostics || []),
    ...queries.flatMap((q: any) => q.diagnostics || []),
  ] as Diag[]
  const sqls = (queries as any[]).map((q) => q.sql as string)
  return { diags, sqls }
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

async function resolveInput(inputArg?: string): Promise<string> {
  if (!inputArg || inputArg === '-') {
    return await readStdin()
  }
  // If file exists, read it; otherwise treat as literal string
  try {
    const stat = await fsp.stat(path.resolve(inputArg))
    if (stat.isFile()) {
      return await fsp.readFile(path.resolve(inputArg), 'utf-8')
    }
  } catch {}
  return inputArg
}

const program = new Command()

program
  .name('graphene')
  .description('Graphene CLI')
  .version('1.0.0')

program
  .command('compile')
  .description('Translate a query to SQL and print it')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .option('--debug', 'Print the parse tree for the input')
  .action(async (input: string | undefined, opts: { debug?: boolean }) => {
    await loadWorkspace(process.cwd())
    const src = await resolveInput(input)
    const { diags, sqls } = collectDiagnosticsFromAnalyze(src)
    const errors = diags.filter((d) => d.severity === 'error')
    if (errors.length) {
      console.error(formatDiagnosticsPretty(errors, src))
      process.exitCode = 1
      return
    }

    if (opts.debug) {
      const tree = parser.parse(src)
      // Print a simple parse tree
      console.log(tree.toString())
    }

    if (sqls.length === 0) {
      console.log(chalk.yellow('No queries found in input'))
      return
    }
    // Print all queries, separated by a blank line
    console.log(sqls.join('\n\n'))
  })

program
  .command('run')
  .description('Run a query against a DuckDB database')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .action(async (input: string | undefined) => {
    await loadWorkspace(process.cwd())
    const src = await resolveInput(input)

    const { diags, sqls } = collectDiagnosticsFromAnalyze(src)
    const errors = diags.filter((d) => d.severity === 'error')
    if (errors.length) {
      console.error(formatDiagnosticsPretty(errors, src))
      process.exitCode = 1
      return
    }

    if (sqls.length === 0) {
      console.log(chalk.yellow('No queries found in input'))
      return
    }
    // Execute the first query
    const sql = sqls[0]
    const db = await connectToDb()
    if (!db) {
      process.exitCode = 1
      return
    }
    const res = await db.query(sql)
    printTable(res.rows)
  })

program.command('serve').description('Run the local server').action(serve)

program.parse(process.argv)
