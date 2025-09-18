#!/usr/bin/env node

import {Command} from 'commander'
import {printDiagnostics, printTable} from './printer.ts'
import {analyze, getDiagnostics, loadWorkspace, toSql, type Query} from '@graphene/lang'
import fs from 'fs-extra'
import path from 'path'
import {getConnection} from './connection.ts'
import os from 'os'
import {loadConfig} from '@graphene/lang/config.ts'

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
    await loadWorkspace(process.cwd())
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
    await loadWorkspace(process.cwd())
    let gsql = await readInput(input)
    let queries = analyze(gsql)
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

program
  .command('view')
  .description('Capture a screenshot of a rendered markdown file')
  .argument('<mdFile>', 'Markdown file to view (e.g., index.md)')
  .option('-c, --chart <chartName>', 'Name of specific chart to capture')
  .action(async (mdFile: string, options: {chart?: string}) => {
    let response = await fetch('http://localhost:4000/graphene/view', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({mdFile, chart: options.chart}),
    })
    if (!response.ok) throw new Error(`View request failed: ${await response.text()}`)
    let result = await response.json()

    if (result.errors && result.errors.length > 0) {
      console.error('Errors found:')
      result.errors.forEach(error => console.error(JSON.stringify(error)))
    }

    if (result.stillLoading) {
      console.error('Warning: Queries were still loading when the screenshot was taken')
    }

    // Save screenshot to temp file
    if (result.screenshot) {
      let filename = `graphene-screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
      let screenshotPath = path.join(os.tmpdir(), filename)
      let base64Data = result.screenshot.replace(/^data:image\/png;base64,/, '')
      await fs.writeFile(screenshotPath, base64Data, 'base64')
      console.log('Screenshot saved to', screenshotPath)
    }
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
    console.warn('No queries found')
    process.exit(1)
  }
  return true
}
