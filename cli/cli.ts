#!/usr/bin/env node

import {Command} from 'commander'
import {serve} from './serve.ts'
import {readAndCompile} from './compile.ts'
import {connectToDuckDB, printTable} from './run.ts'
import {analyze, getDiagnostics, loadWorkspace} from '@graphene/lang'
import {printDiagnostics} from './compile.ts'

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
    let sql = await readAndCompile(input, opts.debug)
    if (!sql) {
      process.exitCode = 1
      return
    }
    console.log(sql)
  })

program
  .command('run')
  .description('Run a query against a DuckDB database')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .action(async (input: string | undefined) => {
    let sql = await readAndCompile(input, false)
    if (!sql) return

    let db = await connectToDuckDB()
    if (!db) return
    let res = await db.query(sql)
    printTable(res.rows)
  })

program
  .command('check')
  .description('Load the workspace and print diagnostics')
  .action(async () => {
    await loadWorkspace(process.cwd())
    analyze()
    let diags = getDiagnostics()
    printDiagnostics(diags)
    if (diags.length) process.exitCode = 1
  })

program
  .command('serve')
  .description('Run the local server')
  .action(serve)

program.parse(process.argv)
