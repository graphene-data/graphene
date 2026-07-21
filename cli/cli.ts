#!/usr/bin/env node

import {Command} from 'commander'
import dotenv from 'dotenv'
import fs from 'fs-extra'
import path from 'path'
import {fileURLToPath} from 'url'

import {config, loadConfig, setGlobalConfig} from '../lang/config.ts'
import {analyzeWorkspace, getFile, loadWorkspace, toSql, type Query} from '../lang/core.ts'
import {rowsToCsv} from '../lang/csv.ts'
import {parseWarehouseFieldType, type AnalysisResult} from '../lang/types.ts'
import {loginPkce} from './auth.ts'
import {getGrapheneCache, runServeInBackground, stopGrapheneIfRunning} from './background.ts'
import {check} from './check.ts'
import {getConnection, runQuery} from './connections/index.ts'
import {installBrowser} from './installBrowser.ts'
import {printDiagnostics, printTable} from './printer.ts'
import {pageUrlForMd, sendToPage} from './run.ts'
import {CliTelemetry, getPresentFlags, type TelemetryCommand} from './telemetry/index.ts'
import {checkForUpdate, showCachedUpdateNotice} from './updateNotifier.ts'

export const program = new Command()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Look at the graphene library's package.json (as opposed to the project using graphene) to get the version
// in dev: cli/cli.ts -> cli/package.json. in dist: cli/dist/cli/cli.js -> cli/package.json
const pkgPath = fs.existsSync(path.join(__dirname, 'package.json')) ? path.join(__dirname, 'package.json') : path.join(__dirname, '../../package.json')
const libPkg = fs.readJsonSync(pkgPath)
program.name('graphene').description('Graphene CLI').version(libPkg.version, '-v, --version')
registerInstallBrowserCommand(program)

let telemetry: CliTelemetry

program
  .command('compile')
  .description('Translate a query to SQL and print it')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .action(
    withTelemetry('compile', async (exit, input: string | undefined) => {
      let files = await loadWorkspace(config.root, false, config.ignoredFiles)
      let cliInput = await readInput(input)
      let analysis = analyzeWorkspace({config, files: files.filter(file => file.path != 'input').concat({path: 'input', contents: cliInput.contents})}, 'input')
      let [query] = validateInputQuery(analysis, exit)
      console.log(toSql(query))
    }),
  )

program
  .command('run')
  .description('Run a query or screenshot a Graphene page')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .option('-c, --chart <chartTitleOrComponentId>', 'Title or component ID of a specific chart or table to capture')
  .option('--param <key=value>', 'Query parameters; repeat for multiple values', (value, previous: string[]) => previous.concat(value), [])
  .option('--format <format>', 'Output format for query or chart data: table or csv', 'table')
  .option('--headless', 'Run markdown pages in a headless browser instead of opening the system browser')
  .action(
    withTelemetry('run', async (exit, input: string | undefined, options: {chart?: string; format?: string; headless?: boolean; param?: string[]}, command: Command) => {
      if (!input) {
        command.outputHelp()
        return exit(0)
      }

      let cliInput = await readInput(input)
      let params = parseRunInputs(options.param || [], exit)
      let files = await loadWorkspace(config.root, false, config.ignoredFiles)

      if (cliInput.kind == 'file' && cliInput.path.endsWith('.gsql')) {
        console.error('Running .gsql files is no longer supported')
        return exit(1)
      }

      if (cliInput.kind == 'file' && cliInput.path.endsWith('.md')) {
        // First, analyze the specificed md file. If it has errors, no point spinning up a browser tab
        let analysis = analyzeWorkspace({config, files: files.filter(file => file.path != cliInput.path)}, cliInput.path)
        if (analysis.diagnostics.length > 0) {
          printDiagnostics(analysis.diagnostics)
          return exit(1)
        }

        // If `run` is requesting a md page, we need to run it in a browser
        let resp = await sendToPage(cliInput.path, {params, chart: options.chart}, !!options.headless)
        printDiagnostics(resp.errors || [])
        if (resp.errors?.length) exit(1)

        if (resp.screenshot) {
          if (resp.stillLoading) console.warn('Warning: Queries were still loading when the screenshot was taken')

          let screenshotDir = path.join(getGrapheneCache(config.root), 'screenshots')
          let screenshotPath = path.join(screenshotDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.png`)
          let base64Data = resp.screenshot.replace(/^data:image\/png;base64,/, '')
          await fs.ensureDir(screenshotDir)
          await fs.writeFile(screenshotPath, base64Data, 'base64')
          console.log('Screenshot saved to', screenshotPath)
        }

        if (resp.data) {
          if (options.format == 'csv') console.log(rowsToCsv(resp.data.rows, resp.data.fields))
          else printTable(resp.data.rows)
        }

        console.log('Page available at', pageUrlForMd(cliInput.path, params))
      } else {
        // otherwise, if we're just `run`ing a plain query, we can do it directly in this process, no browser needed.
        let analysis = analyzeWorkspace({config, files: files.filter(file => file.path != 'input').concat({path: 'input', contents: cliInput.contents})}, 'input')
        let [query] = validateInputQuery(analysis, exit)
        let sql = renderSql(query, params, exit)
        let res = await runQuery(sql)

        if (options.format == 'csv') console.log(rowsToCsv(res.rows, query.fields))
        else printTable(res.rows)
      }
    }),
  )

program
  .command('list')
  .description('List the component IDs for charts and tables on a markdown page')
  .argument('<file>', 'Markdown file to inspect')
  .action(
    withTelemetry('list', async (exit, fileArg: string) => {
      let cliInput = await readInput(fileArg)
      if (cliInput.kind != 'file' || !cliInput.path.endsWith('.md')) throw new Error('list requires a markdown file path')

      let {componentIds = []} = await sendToPage(cliInput.path, {params: {}}, false)
      componentIds.forEach(componentId => console.log(componentId))
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

        // If there's no configured namespace and more than one dataset, list the datasets.
        if (!tableArg && !config.defaultNamespace && datasets.length > 1) {
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
        else if (tableArg && config.motherduck && parts.length == 2) dsToList = tableArg
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
    withTelemetry('serve', async (exit, options: {bg?: boolean; port?: string}) => {
      await stopGrapheneIfRunning()
      if (options.bg) {
        let url = await runServeInBackground({entryPoint: fileURLToPath(import.meta.url)})
        console.log(`Server running at ${url}`)
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
  .description('Log in to Graphene Cloud or the configured database')
  .action(
    withTelemetry('login', async exit => {
      if (config.cloud) await loginPkce()
      else if (config.dialect == 'snowflake') {
        let conn = await getConnection() // connecting should automatically trigger auth via the sdk
        await conn.close()
      } else {
        console.error('No Graphene Cloud URL or database login is configured for this project')
        return exit(1)
      }

      console.log('Successfully logged in')
      return exit(0)
    }),
  )

function registerInstallBrowserCommand(program: Command) {
  program
    .command('install-browser')
    .description('Install the browser used by graphene run --headless screenshots')
    .option('--with-deps', 'Also install browser system dependencies where supported')
    .action(async (options: {withDeps?: boolean}) => {
      let ok = await installBrowser({withDeps: options.withDeps})
      process.exit(ok ? 0 : 1)
    })
}

type CliInput = {kind: 'file'; path: string; contents: string} | {kind: 'query'; contents: string}

// Interprets CLI input as stdin, a file relative to cwd or the project root, or an inline query.
async function readInput(arg: string | undefined): Promise<CliInput> {
  if (!arg) return {kind: 'query', contents: ''}

  if (arg === '-') {
    let contents = await new Promise<string>(resolve => {
      let data = ''
      process.stdin.setEncoding('utf-8')
      process.stdin.on('data', chunk => (data += chunk))
      process.stdin.on('end', () => resolve(data))
      process.stdin.resume()
    })
    return {kind: 'query', contents}
  }

  let absolutePath = [path.resolve(process.cwd(), arg), path.resolve(config.root, arg)].find(p => fs.existsSync(p))
  if (!absolutePath) return {kind: 'query', contents: arg}
  return {kind: 'file', path: path.relative(config.root, absolutePath), contents: await fs.promises.readFile(absolutePath, 'utf-8')}
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

function parseRunInputs(values: string[], exit: (code?: number) => never): Record<string, string | string[]> {
  let inputs = {} as Record<string, string | string[]>
  for (let value of values) {
    let index = value.indexOf('=')
    let key = index >= 0 ? value.slice(0, index) : ''
    if (index < 0 || !key) {
      console.error(`Invalid --param "${value}". Expected key=value.`)
      return exit(1)
    }

    let next = value.slice(index + 1)
    let existing = inputs[key]
    if (existing === undefined) inputs[key] = next
    else if (Array.isArray(existing)) existing.push(next)
    else inputs[key] = [existing, next]
  }
  return inputs
}

function renderSql(query: Query, inputs: Record<string, string | string[]>, exit: (code?: number) => never): string {
  try {
    return toSql(query, inputs)
  } catch (err) {
    if (err instanceof Error) console.error(err.message)
    else console.error(String(err))
    return exit(1)
  }
}

function findCaseInsensitive(values: string[], needle: string): string | null {
  return values.find(value => value.toLowerCase() == needle.toLowerCase()) || null
}

class CliExit {}

function withTelemetry(command: TelemetryCommand, action: (exit: (code?: number) => never, ...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    telemetry = new CliTelemetry(config, libPkg.version)
    await telemetry.init(config.root)

    let startedAt = Date.now()
    let exitCode = 0
    let success = true
    let exitCalled = false
    let caughtError: unknown

    telemetry.event('cli_command_started', {command, flags: getPresentFlags(command, (program as any).rawArgs || process.argv.slice(2))})
    await showCachedUpdateNotice({config, currentVersion: libPkg.version, packageIsPrivate: libPkg.private})

    let exit = (code: number = 0): never => {
      exitCalled = true
      exitCode = code
      success = exitCode == 0
      throw new CliExit()
    }

    try {
      await action(exit, ...args)
    } catch (err) {
      if (!(err instanceof CliExit)) {
        exitCode = 1
        success = false
        caughtError = err
      }
    } finally {
      if (success) {
        let {shouldSendInstallSeen, fromVersion} = await telemetry.markSuccessfulInvocation()
        if (shouldSendInstallSeen) telemetry.event('cli_install_seen')
        if (fromVersion) telemetry.event('cli_upgraded', {from_version: fromVersion, to_version: libPkg.version})
      }
      telemetry.event('cli_command_completed', {command, success, exit_code: exitCode, duration_ms: Date.now() - startedAt})
      await checkForUpdate({config, currentVersion: libPkg.version, packageIsPrivate: libPkg.private})
    }

    if (caughtError) throw caughtError
    else if (exitCalled) process.exit(exitCode)
  }
}

// Loads project config and runs the public CLI. bin.js calls this in packages, while direct source execution calls it below.
export async function main() {
  // install-browser must work outside a Graphene project, including before a browser exists.
  if (process.argv[2] != 'install-browser') {
    let cfg = await loadConfig(process.cwd(), envFiles => dotenv.config({quiet: true, path: envFiles}))
    setGlobalConfig(cfg)
  }

  try {
    await program.parseAsync(process.argv)
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

// Loading this module gives tests the user-facing program without executing it.
if (process.argv[1] && path.resolve(process.argv[1]) == fileURLToPath(import.meta.url)) await main()
