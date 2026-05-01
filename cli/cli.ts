#!/usr/bin/env node

import {Command} from 'commander'
import dotenv from 'dotenv'
import fs from 'fs-extra'
import path from 'path'
import {fileURLToPath} from 'url'

import {config, loadConfig, setGlobalConfig} from '../lang/config.ts'
import {analyzeWorkspace, getFile, loadWorkspace, toSql, type Query} from '../lang/core.ts'
import {parseWarehouseFieldType, type AnalysisResult} from '../lang/types.ts'
import {loginPkce} from './auth.ts'
import {runServeInBackground, stopGrapheneIfRunning} from './background.ts'
import {check} from './check.ts'
import {getConnection, runQuery} from './connections/index.ts'
import {printDiagnostics, printTable} from './printer.ts'
import {listMdFileQueries, runMdFile, runNamedQueryFromMd} from './run.ts'
import {CliTelemetry, getPresentFlags, getWorkspaceScanCounts, type TelemetryCommand} from './telemetry/index.ts'

const program = new Command()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Look at the graphene library's package.json (as opposed to the project using graphene) to get the version
// in dev: cli/cli.ts -> cli/package.json. in dist: cli/dist/cli/cli.js -> cli/package.json
const pkgPath = fs.existsSync(path.join(__dirname, 'package.json')) ? path.join(__dirname, 'package.json') : path.join(__dirname, '../../package.json')
const libPkg = fs.readJsonSync(pkgPath)
program.name('graphene').description('Graphene CLI').version(libPkg.version, '-v, --version')

let cfg = await loadConfig(process.cwd(), envFiles => {
  dotenv.config({quiet: true, path: envFiles})
})
setGlobalConfig(cfg)

const telemetry = new CliTelemetry(config, libPkg.version)
await telemetry.init(process.cwd())

program
  .command('compile')
  .description('Translate a query to SQL and print it')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .action(
    withTelemetry('compile', async (exit, input: string | undefined) => {
      let files = await loadWorkspace(process.cwd(), false, config.ignoredFiles)
      telemetry.event('workspace_scanned', {command: 'compile', ...getWorkspaceScanCounts(files)})
      let sql = await readInput(input)
      let analysis = analyzeWorkspace({config, files: files.filter(file => file.path != 'input').concat({path: 'input', contents: sql})}, 'input')
      let [query] = validateInputQuery(analysis, exit)
      console.log(toSql(query))
    }),
  )

program
  .command('run')
  .description('Run a query or screenshot a Graphene page')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .option('-c, --chart <chartTitleOrComponentId>', 'Title or component ID of a specific chart to capture')
  .option('-q, --query <queryName>', 'Query or table name to run from a markdown page')
  .action(
    withTelemetry('run', async (exit, input: string | undefined, options: {chart?: string; query?: string}) => {
      if (options.chart && options.query) {
        console.error('Cannot use --chart and --query together')
        return exit(1)
      }

      let inputPath = getExistingPath(input)
      if (inputPath && inputPath.endsWith('.md')) {
        let res = options.query ? await runNamedQueryFromMd(inputPath, options.query, telemetry) : await runMdFile({mdArg: inputPath, chart: options.chart, telemetry})
        return exit(res ? 0 : 1)
      }

      if (options.chart || options.query) {
        console.error('--chart and --query can only be used with a markdown file path')
        return exit(1)
      }

      if (inputPath && inputPath.endsWith('.gsql')) {
        console.error('Running .gsql files is no longer supported. Pass inline GSQL or use a markdown file path with --query.')
        return exit(1)
      }

      let files = await loadWorkspace(process.cwd(), false, config.ignoredFiles)
      telemetry.event('workspace_scanned', {command: 'run', ...getWorkspaceScanCounts(files)})
      let gsql = await readInput(input)
      let analysis = analyzeWorkspace({config, files: files.filter(file => file.path != 'input').concat({path: 'input', contents: gsql})}, 'input')
      let [query] = validateInputQuery(analysis, exit)
      let sql = toSql(query)
      let res = await runQuery(sql)
      printTable(res.rows)
    }),
  )

program
  .command('list')
  .description('List the component IDs for charts on a markdown page')
  .argument('<file>', 'Markdown file to inspect')
  .action(
    withTelemetry('list', async (exit, fileArg: string) => {
      let inputPath = getExistingPath(fileArg)
      if (!inputPath || !inputPath.endsWith('.md')) {
        console.error('list requires a markdown file path')
        return exit(1)
      }

      let res = await listMdFileQueries(inputPath, telemetry)
      return exit(res ? 0 : 1)
    }),
  )

program
  .command('schema')
  .description('Inspect database tables or describe a table')
  .argument('[schema | table]', 'Optional schema or table name to describe')
  .action(
    withTelemetry('schema', async (_exit, tableArg: string) => {
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
    }),
  )

program
  .command('serve')
  .description('Run the local server')
  .option('--bg', 'Run the server in the background')
  .action(
    withTelemetry('serve', async (exit, options: {bg?: boolean}) => {
      await stopGrapheneIfRunning()
      if (options.bg) {
        await runServeInBackground()
        return exit(0)
      } else {
        let mod = await import('./serve2.ts') // load dynamically, so we're not pulling in a bunch of deps we might not need
        await mod.serve2(telemetry)
      }
    }),
  )

program
  .command('stop')
  .description('Stop the local server')
  .action(
    withTelemetry('stop', async _exit => {
      await stopGrapheneIfRunning()
    }),
  )

program
  .command('check')
  .description('Check the project for diagnostics')
  .argument('[file]', 'Optional markdown or gsql file to check')
  .action(
    withTelemetry('check', async (exit, fileArg: string | undefined) => {
      let res = await check({fileArg, telemetry})
      return exit(res ? 0 : 1) // if we started the server in the background, just returning won't actually exit the process.
    }),
  )

program
  .command('login')
  .description('Log in to Graphene Cloud')
  .action(
    withTelemetry('login', async exit => {
      await loginPkce()
      console.log('Successfully logged in')
      return exit(0)
    }),
  )

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

function validateInputQuery(analysis: AnalysisResult, exit: (code?: number) => never): Query[] {
  if (analysis.diagnostics.length) {
    printDiagnostics(analysis.diagnostics)
    return exit(1)
  }

  let queries = getFile(analysis, 'input')?.queries || []
  if (queries.length == 0) {
    console.warn('No queries found')
    return exit(1)
  }
  return queries
}

function findCaseInsensitive(values: string[], needle: string): string | null {
  return values.find(value => value.toLowerCase() == needle.toLowerCase()) || null
}

function withTelemetry(command: TelemetryCommand, action: (exit: (code?: number) => never, ...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    let startedAt = Date.now()
    let exitCode = 0
    let success = true
    let exitCalled = false
    let caughtError: unknown

    telemetry.event('cli_command_started', {command, flags: getPresentFlags(command, process.argv.slice(2))})

    let exit = (code: number = 0): never => {
      exitCalled = true
      exitCode = code
      success = exitCode == 0
      return undefined as never
    }

    try {
      await action(exit, ...args)
    } catch (err) {
      exitCode = 1
      success = false
      caughtError = err
    } finally {
      if (success) {
        let {shouldSendInstallSeen, fromVersion} = await telemetry.markSuccessfulInvocation()
        if (shouldSendInstallSeen) telemetry.event('cli_install_seen')
        if (fromVersion) telemetry.event('cli_upgraded', {from_version: fromVersion, to_version: libPkg.version})
      }
      telemetry.event('cli_command_completed', {command, success, exit_code: exitCode, duration_ms: Date.now() - startedAt})
    }

    if (caughtError) throw caughtError
    else if (exitCalled) process.exit(exitCode)
  }
}
