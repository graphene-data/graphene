#!/usr/bin/env node

import {Command} from 'commander'
import dotenv from 'dotenv'
import fs from 'fs-extra'
import path from 'path'
import {fileURLToPath} from 'url'

import {config, loadConfig} from '../lang/config.ts'
import {analyze, loadWorkspace, toSql} from '../lang/core.ts'
import {mockFileMap} from '../lang/mockFiles.ts'
import {parseWarehouseFieldType} from '../lang/types.ts'
import {loginPkce} from './auth.ts'
import {runServeInBackground, stopGrapheneIfRunning} from './background.ts'
import {check} from './check.ts'
import {getConnection, runQuery} from './connections/index.ts'
import {printDiagnostics, printTable} from './printer.ts'
import {listMdFileQueries, runMdFile} from './run.ts'
import {CliTelemetry, getPresentFlags, getWorkspaceScanCounts, type TelemetryCommand} from './telemetry/index.ts'

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

const telemetry = new CliTelemetry(config, libPkg.version)
await telemetry.init(process.cwd())

program
  .command('compile')
  .description('Translate a query to SQL and print it')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .action(
    withTelemetry('compile', async (exit, input: string | undefined) => {
      let workspace = await loadWorkspace({config, files: []})
      telemetry.event('workspace_scanned', {command: 'compile', ...getWorkspaceScanCounts(workspace)})
      let sql = await readInput(input)
      let {queries, diagnostics} = analyze(workspace, sql, 'gsql')
      if (diagnostics.length) {
        printDiagnostics(diagnostics)
        return exit(1)
      }
      if (!queries.length) {
        console.warn('No queries found')
        return exit(1)
      }
      console.log(toSql(queries[0]))
    }),
  )

program
  .command('run')
  .description('Run a query or screenshot a Graphene page')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .option('-c, --chart <chartTitleOrQueryId>', 'Title or query ID of a specific chart to capture')
  .option('-q, --query <queryName>', 'Query or table name to run from a markdown page')
  .action(
    withTelemetry('run', async (exit, input: string | undefined, options: {chart?: string; query?: string}) => {
      if (options.chart && options.query) {
        console.error('Cannot use --chart and --query together')
        return exit(1)
      }

      let inputFile = resolveWorkspaceFile(input)
      if (inputFile?.endsWith('.gsql')) {
        console.error('Running .gsql files is no longer supported. Pass inline GSQL or use a markdown file path with --query.')
        return exit(1)
      }

      let workspace = await loadWorkspace({config, files: []})
      telemetry.event('workspace_scanned', {command: 'run', ...getWorkspaceScanCounts(workspace)})

      if (inputFile?.endsWith('.md')) {
        let contents = await readInput(inputFile)
        if (options.query) {
          contents += `\n\n\`\`\`sql\nfrom ${options.query} select *\n\`\`\`\n`
          let {queries, diagnostics} = analyze(workspace, contents, 'md')
          if (diagnostics.length) {
            printDiagnostics(diagnostics)
            return exit(1)
          }
          if (!queries.length) {
            console.warn('No queries found')
            return exit(1)
          }
          let res = await runQuery(toSql(queries[queries.length - 1]))
          printTable(res.rows)
          return
        }

        let res = await runMdFile({mdArg: inputFile, chart: options.chart, telemetry})
        return exit(res ? 0 : 1)
      }

      if (options.chart || options.query) {
        console.error('--chart and --query can only be used with a markdown file path')
        return exit(1)
      }

      let gsql = await readInput(input)
      let {queries, diagnostics} = analyze(workspace, gsql, 'gsql')
      if (diagnostics.length) {
        printDiagnostics(diagnostics)
        return exit(1)
      }
      if (!queries.length) {
        console.warn('No queries found')
        return exit(1)
      }
      let res = await runQuery(toSql(queries[0]))
      printTable(res.rows)
    }),
  )

program
  .command('list')
  .description('List the query IDs for charts on a markdown page')
  .argument('<file>', 'Markdown file to inspect')
  .action(
    withTelemetry('list', async (exit, fileArg: string) => {
      let inputFile = resolveWorkspaceFile(fileArg)
      if (!inputFile || !inputFile.endsWith('.md')) {
        console.error('list requires a markdown file path')
        return exit(1)
      }

      let res = await listMdFileQueries(inputFile)
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
      let targetFile = resolveWorkspaceFile(fileArg)
      if (fileArg && !targetFile) {
        console.error(`Couldn't find ${fileArg}`)
        return exit(1)
      }
      let res = await check({fileArg: targetFile, telemetry})
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

// If the input is a path, return the contents of that path. If it's `-`, read from stdin,
// otherwise just return the input arg verbatim (usually means it's a query)
async function readInput(arg): Promise<string> {
  if (!arg) return ''

  if (arg === '-') {
    return await new Promise<string>(resolve => {
      let data = ''
      process.stdin.setEncoding('utf-8')
      process.stdin.on('data', chunk => (data += chunk))
      process.stdin.on('end', () => resolve(data))
      process.stdin.resume()
    })
  }

  // cheap check to see if this is a query, rather than a path
  if (arg.includes(' ')) {
    return arg
  }

  if (process.env.NODE_ENV == 'test' && mockFileMap[arg]) {
    return mockFileMap[arg]
  }

  let absolutePath = [path.resolve(process.cwd(), arg), path.resolve(config.root, arg)].find(p => fs.existsSync(p))
  if (absolutePath) return await fs.promises.readFile(absolutePath, 'utf-8')

  return arg
}

function resolveWorkspaceFile(arg: string | undefined): string | undefined {
  let clean = arg?.trim()
  if (!clean || clean === '-') return undefined
  if (process.env.NODE_ENV == 'test' && mockFileMap[clean]) return clean

  let absolutePath = [path.resolve(process.cwd(), clean), path.resolve(config.root, clean)].find(p => fs.existsSync(p))
  return absolutePath ? path.relative(config.root, absolutePath) : undefined
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
