#!/usr/bin/env node

import {Command} from 'commander'
import dotenv from 'dotenv'
import fs from 'fs-extra'
import path from 'path'
import {fileURLToPath} from 'url'

import {config, loadConfig} from '../lang/config.ts'
import {analyzeWorkspace, getFile, loadWorkspace, toSql, type Query} from '../lang/core.ts'
import {parseWarehouseFieldType, type AnalysisResult} from '../lang/types.ts'
import {loginPkce} from './auth.ts'
import {runServeInBackground, stopGrapheneIfRunning} from './background.ts'
import {check} from './check.ts'
import {getConnection, runQuery} from './connections/index.ts'
import {printDiagnostics, printTable} from './printer.ts'
import {runMdFile, runNamedQueryFromMd} from './run.ts'

const program = new Command()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Look at the graphene library's package.json (as opposed to the project using graphene) to get the version
// in dev: cli/cli.ts -> cli/package.json. in dist: cli/dist/cli/cli.js -> cli/package.json
const pkgPath = fs.existsSync(path.join(__dirname, 'package.json')) ? path.join(__dirname, 'package.json') : path.join(__dirname, '../../package.json')
const libPkg = fs.readJsonSync(pkgPath)
program.name('graphene').description('Graphene CLI').version(libPkg.version, '-v, --version')

await loadConfig(process.cwd(), envFiles => {
  dotenv.config({quiet: true, path: envFiles || '.env'})
})

program
  .command('compile')
  .description('Translate a query to SQL and print it')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .action(async (input: string | undefined) => {
    let files = await loadWorkspace(process.cwd(), false, config.ignoredFiles)
    let sql = await readInput(input)
    let analysis = analyzeWorkspace({config, files: files.filter(file => file.path != 'input').concat({path: 'input', contents: sql})}, 'input')
    let [query] = validateInputQuery(analysis)
    console.log(toSql(query))
  })

program
  .command('run')
  .description('Run a query or screenshot a Graphene page')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .option('-c, --chart <chartTitle>', 'Title of a specific chart to capture')
  .option('-q, --query <queryName>', 'Query or table name to run from a markdown page')
  .action(async (input: string | undefined, options: {chart?: string; query?: string}) => {
    if (options.chart && options.query) {
      console.error('Cannot use --chart and --query together')
      process.exit(1)
    }

    let inputPath = getExistingPath(input)
    if (inputPath && inputPath.endsWith('.md')) {
      let res = options.query ? await runNamedQueryFromMd(inputPath, options.query) : await runMdFile({mdArg: inputPath, chart: options.chart})
      process.exit(res ? 0 : 1)
    }

    if (options.chart || options.query) {
      console.error('--chart and --query can only be used with a markdown file path')
      process.exit(1)
    }

    if (inputPath && inputPath.endsWith('.gsql')) {
      console.error('Running .gsql files is no longer supported. Pass inline GSQL or use a markdown file path with --query.')
      process.exit(1)
    }

    let files = await loadWorkspace(process.cwd(), false, config.ignoredFiles)
    let gsql = await readInput(input)
    let analysis = analyzeWorkspace({config, files: files.filter(file => file.path != 'input').concat({path: 'input', contents: gsql})}, 'input')
    let [query] = validateInputQuery(analysis)
    let sql = toSql(query)
    let res = await runQuery(sql)
    printTable(res.rows)
  })

program
  .command('schema')
  .description('Inspect database tables or describe a table')
  .argument('[schema | table]', 'Optional schema or table name to describe')
  .action(async (tableArg: string) => {
    let connection = await getConnection()
    try {
      let datasets = await connection.listDatasets()
      let matchedDataset = tableArg ? findCaseInsensitive(datasets, tableArg) : null

      // if there's no arg and more than one dataset, just list the datasets
      if (!tableArg && datasets.length > 1) {
        return console.log(`Datasets available:\n${datasets.join('\n')}`)
      }

      // figure out if you're wanting to list tables in a schema/dataset
      let dsToList: string | null = null
      let parts = tableArg ? tableArg.split('.') : []

      if (tableArg && connection.listSchemas && parts.length == 1 && matchedDataset) {
        let schemas = await connection.listSchemas(matchedDataset)
        return console.log(`Schemas in ${matchedDataset}:\n${schemas.join('\n')}`)
      }

      if (matchedDataset)
        dsToList = matchedDataset // you gave the name of a dataset
      else if (!tableArg && config.defaultNamespace)
        dsToList = config.defaultNamespace // default namespace configured
      else if (!tableArg && datasets.length == 1)
        dsToList = datasets[0] // only one dataset, and no args
      else if (!tableArg && config.dialect == 'duckdb') dsToList = '<default>'
      else if (tableArg && config.dialect == 'snowflake' && parts.length == 2) {
        let db = findCaseInsensitive(datasets, parts[0]) || parts[0]
        dsToList = `${db}.${parts.slice(1).join('.')}`
      }

      if (dsToList) {
        let tables = await connection.listTables(dsToList)
        return console.log(`Tables${dsToList ? ` in ${dsToList}` : ''}:\n${tables.join('\n')}`)
      }

      // otherwise, assume you're wanting to see tables
      let cols = await connection.describeTable(tableArg)
      let tableLabel = config.dialect == 'snowflake' ? String(tableArg || '').toLowerCase() : tableArg
      if (!cols.length) return console.log(`Table ${tableLabel} not found`)
      console.log(`table ${tableLabel} (`)
      cols.forEach(col => {
        let parsed = parseWarehouseFieldType(col.dataType)
        let renderedType = parsed.displayType || col.dataType
        console.log(`  ${col.name} ${renderedType}`)
      })
      console.log(')')
    } finally {
      await connection.close()
    }
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

program
  .command('stop')
  .description('Stop the local server')
  .action(async () => {
    await stopGrapheneIfRunning()
  })

program
  .command('check')
  .description('Check the project for diagnostics')
  .argument('[file]', 'Optional markdown or gsql file to check')
  .action(async (fileArg: string | undefined) => {
    let res = await check({fileArg})
    process.exit(res ? 0 : 1) // import to call `exit`, bc if we started the server in the background, just returning won't actually exit the process.
  })

program
  .command('login')
  .description('Log in to Graphene Cloud')
  .action(async () => {
    await loginPkce()
    console.log('Successfully logged in')
    process.exit(0)
  })

program.parse(process.argv)

async function readInput(arg): Promise<string> {
  if (!arg || arg === '-') {
    return await new Promise<string>(resolve => {
      let data = ''
      process.stdin.setEncoding('utf-8')
      process.stdin.on('data', chunk => (data += chunk))
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

function getExistingPath(arg: string | undefined): string | null {
  if (!arg || arg === '-') return null
  let absolutePath = path.resolve(arg)
  return fs.existsSync(absolutePath) ? absolutePath : null
}

function validateInputQuery(analysis: AnalysisResult): Query[] {
  if (analysis.diagnostics.length) {
    printDiagnostics(analysis.diagnostics)
    process.exit(1)
  }

  let queries = getFile(analysis, 'input')?.queries || []
  if (queries.length == 0) {
    console.warn('No queries found')
    process.exit(1)
  }
  return queries
}

function findCaseInsensitive(values: string[], needle: string): string | null {
  return values.find(value => value.toLowerCase() == needle.toLowerCase()) || null
}
