#!/usr/bin/env node

import {Command} from 'commander'
import {printDiagnostics, printTable} from './printer.ts'
import {analyze, getDiagnostics, loadWorkspace, toSql, type Query} from '../lang/core.ts'
import fs from 'fs-extra'
import path from 'path'
import {config, loadConfig} from '../lang/config.ts'
import {runServeInBackground, stopGrapheneIfRunning} from './background.ts'
import {check} from './check.ts'
import {getConnection, runQuery} from './connections/index.ts'
import {loginPkce} from './auth.ts'

const program = new Command()

program
  .name('graphene')
  .description('Graphene CLI')
  .version('1.0.0')

program.hook('preAction', async () => {
  if (process.env.CLI_DELAY) { // useful if you want to attach a debugger
    await new Promise(r => setTimeout(r, 1000))
  }
  loadConfig(process.cwd())
})

program
  .command('compile')
  .description('Translate a query to SQL and print it')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .action(async (input: string | undefined) => {
    await loadWorkspace(process.cwd(), false)
    let sql = await readInput(input)
    let queries = analyze(sql)
    if (!validQuery(queries)) return
    console.log(toSql(queries[0]))
  })

program
  .command('run')
  .description('Run a query against your database')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .action(async (input: string | undefined) => {
    await loadWorkspace(process.cwd(), false)
    let gsql = await readInput(input)
    let queries = analyze(gsql)
    if (!validQuery(queries)) return
    let sql = toSql(queries[0])
    let res = await runQuery(sql)
    printTable(res.rows)
  })

program.command('schema')
  .description('Inspect database tables or describe a table')
  .argument('[schema | table]', 'Optional schema or table name to describe')
  .action(async (tableArg: string) => {
    let connection = await getConnection()
    let datasets = await connection.listDatasets()

    // if there's no arg and more than one dataset, just list the datasets
    if (!tableArg && datasets.length > 1) {
      return console.log(`Datasets available:\n${datasets.join('\n')}`)
    }

    // figure out if you're wanting to list tables in a schema/dataset
    let dsToList: string | null = null
    if (datasets.includes(tableArg)) dsToList = tableArg // you gave the name of a dataset
    else if (!tableArg && datasets.length == 1) dsToList = datasets[0] // only one dataset, and no args
    else if (!tableArg && config.namespace) dsToList = config.namespace // default namespace configured
    else if (!tableArg && config.dialect == 'duckdb') dsToList = '<default>'

    if (dsToList) {
      let tables = await connection.listTables(dsToList)
      return console.log(`Tables${dsToList ? ` in ${dsToList}` : ''}:\n${tables.join('\n')}`)
    }

    // otherwise, assume you're wanting to see tables
    let cols = await connection.describeTable(tableArg)
    if (!cols.length) return console.log(`Table ${tableArg} not found`)
    console.log(`table ${tableArg} (`)
    cols.forEach(col => console.log(`  ${col.name} ${col.dataType}`))
    console.log(')')
  })

program
  .command('serve')
  .description('Run the local server')
  .option('--bg', 'Run the server in the background')
  .action(async (options: {bg?: boolean}) => {
    await stopGrapheneIfRunning()
    if (options.bg) {
      await runServeInBackground()
      process.exit(0)
    } else {
      let mod = await import('./serve2.ts') // load dynamically, so we're not pulling in a bunch of deps we might not need
      await mod.serve2()
    }
  })

program.command('stop')
  .description('Stop the local server')
  .action(async () => { await stopGrapheneIfRunning() })

program
  .command('check')
  .description('Check the project for errors, optionally capturing a page screenshot')
  .argument('[mdFile]', 'Markdown file to check (e.g., index.md)')
  .option('-c, --chart <chartTitle>', 'Title of a specific chart to capture')
  .action(async (mdArg: string | undefined, options: {chart?: string}) => {
    let res = await check({mdArg, chart: options.chart})
    process.exit(res ? 0 : 1) // import to call `exit`, bc if we started the server in the background, just returning won't actually exit the process.
  })

program.command('login')
  .description('Log in to Graphene Cloud')
  .action(async () => {
    await loginPkce()
    console.log('Successfully logged in')
    process.exit(0)
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
  if (fs.existsSync(absolutePath)) {
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
    console.warn('No queries found')
    process.exit(1)
  }
  return true
}
