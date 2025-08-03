#!/usr/bin/env node

import {Command} from 'commander'
import {readFileSync} from 'node:fs'
import * as fsSync from 'node:fs'
import * as path from 'node:path'
import {analyze} from '@graphene/lang'
import {DiagnosticSeverity, type Diagnostic} from 'vscode-languageserver-types'
import Table from 'cli-table3'
import chalk from 'chalk'
import {serve} from './serve'

interface Results {
  rows: any[]
}

interface Db {
  query: (query: string) => Promise<Results>
}

async function connectToDb (): Promise<Db | null> {
  let files = fsSync.readdirSync('.')
  let duckFiles = files.filter((file: string) => file.endsWith('.duckdb'))

  if (duckFiles[0]) {
    console.log(chalk.dim(`Using database: ${duckFiles[0]}`))
    let module:any
    try {
      module = await import('@duckdb/node-api')
    } catch (_) {
      console.error('❌  @duckdb/node-api package not installed – unable to execute. Install with `npm i @duckdb/node-api` or use -p flag.')
      return null
    }

    let db = await module.DuckDBInstance.create(duckFiles[0], {access_mode: 'READ_ONLY'})
    let conn = await db.connect()

    return {
      query: async (q) => {
        let reader = await conn.runAndReadAll(q)
        return {rows: reader.getRowObjects()}
      },
    }
  }
  return null
}

function showDiagnostics (diagnostics: Diagnostic[]) {
  diagnostics.forEach(diag => {
    let isErr = diag.severity === DiagnosticSeverity.Error
    let sevColor = isErr ? chalk.red : chalk.yellow
    console.error(sevColor(`${isErr ? 'error' : 'warn'}`) + `${diag.range.start.line + 1}:${diag.range.start.character + 1} – ${diag.message}`)
  })
}

function printTable (rows: any[]) {
  if (!rows || rows.length === 0) {
    console.log(chalk.yellow('No results returned'))
    return
  }

  let headers = Object.keys(rows[0])
  let table = new Table({head: headers.map(h => chalk.blue(h))})
  rows.forEach(row => table.push(headers.map(h => row[h]?.toString() || '')))
  console.log(table.toString())
}

const program = new Command()

program
  .name('graphene')
  .description('Translator')
  .version('1.0.0')
  .argument('[file]', 'MyDialect query file; STDIN if omitted')
  .option('-p, --print', 'print translated SQL instead of executing')
  .parse()

program
  .command('run <file>')
  .description('Runs a given file against a duckdb database.')
  .action(async file => {
    let src = fsSync.readFileSync(file, 'utf-8')
    let sql = analyze(src)[0]
    console.log(sql)
    let db = await connectToDb()
    if (db) {
      let res = await db.query(sql)
      printTable(res.rows)
    }
  })

program
  .command('serve')
  .action(serve)

program.parse(process.argv)
