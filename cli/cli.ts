#!/usr/bin/env node

import {Command} from 'commander'
import {printDiagnostics, printTable} from './printer.ts'
import {analyze, getDiagnostics, loadWorkspace, toSql, config, type Query} from '@graphene/lang'
import {type Connection} from '@malloydata/malloy'
import * as fs from 'fs'
import path from 'path'
import { getConnection } from './connection.ts'

const program = new Command()

program
  .name('graphene')
  .description('Graphene CLI')
  .version('1.0.0')

program
  .command('compile')
  .description('Translate a query to SQL and print it')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .action(async (input: string | undefined) => {
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
    let connection = await getConnection()
    let res = await connection.runSQL(sql)
    printTable(res.rows)
  })

program
  .command('serve')
  .description('Run the local server')
  .action(async () => {
    // load dynamically, so we're not pulling in a bunch of deps we might not need
    let mod = await import('./serve2.ts')
    await mod.serve2()
  })

program
  .command('check')
  .description('Check the project for errors')
  .action(async () => {
    await loadWorkspace(process.cwd())
    analyze()
    if (getDiagnostics().length) {
      printDiagnostics(getDiagnostics())
      process.exit(1)
    }
    console.log('No errors found 💎')
  })

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