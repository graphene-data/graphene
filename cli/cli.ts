#!/usr/bin/env node

import {Command} from 'commander'
import {serve} from './serve.ts'
import {readAndCompile} from './compile.ts'
import {connectToDuckDB, printTable} from './run.ts'

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
    if (!sql) return
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
  .command('serve')
  .description('Run the local server')
  .action(serve)

program.parse(process.argv)
