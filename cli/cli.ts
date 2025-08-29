#!/usr/bin/env node

import {Command} from 'commander'
import {serve} from './serve.ts'
import {printDiagnostics, printTable} from './printer.ts'
import {analyze, getDiagnostics, loadWorkspace, toSql, config, type Query} from '@graphene/lang'
import {type Connection} from '@malloydata/malloy'
import * as fs from 'fs'
import path from 'path'

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
    let sql = await readInput(input)
    let queries = analyze(sql, 'input')
    if (!validQuery(queries)) return
    console.log(toSql(queries[0]))
  })

program
  .command('run')
  .description('Run a query against your database')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .action(async (input: string | undefined) => {
    await loadWorkspace(process.cwd())
    let gsql = await readInput(input)
    let queries = analyze(gsql, 'input')
    if (!validQuery(queries)) return
    let sql = toSql(queries[0])

    let connection
    if (config.dialect === 'bigquery') {
      let mod = await import('@malloydata/db-bigquery')
      connection = new mod.BigQueryConnection("bigQuery") as Connection
    }

    if (config.dialect === 'duckdb') {
      let mod = await import('@malloydata/db-duckdb')
      let files = await fs.promises.readdir(process.cwd())
      let dbPath = files.find(f => f.endsWith('.duckdb'))
      if (!dbPath) throw new Error('No .duckdb file found in current directory')
      connection = new mod.DuckDBConnection("duckdb", dbPath) as Connection
    }

    let res = await connection?.runSQL(sql)
    printTable(res.rows)
  })

program
  .command('serve')
  .description('Run the local server')
  .action(() => serve(config))

program.parse(process.argv)


async function readInput (arg): Promise<string> {
  if (!arg || arg === '-') {
    return await new Promise<string>((resolve) => {
      let data = ''
      process.stdin.setEncoding('utf-8')
      process.stdin.on('data', (chunk) => (data += chunk))
      process.stdin.on('end', () => resolve(data))
      process.stdin.resume()
    })
  }

  let absolutePath = path.resolve(arg)
  let exists = await fs.existsSync(absolutePath)
  if (exists) {
    return await fs.promises.readFile(absolutePath, 'utf-8')
  }

  return arg
}

function validQuery (queries: Query[]): boolean {
  if (getDiagnostics().length) {
    printDiagnostics(getDiagnostics())
    process.exit(1)
  }
  if (queries.length == 0) {
    console.warn("No queries found")
    process.exit(1)
  }
  return true
}