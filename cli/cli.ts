#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { analyze, loadWorkspace } from '@graphene/lang'
import { serve } from './serve'
import { readInput, printDiagnostics, type CliDiagnostic } from './compile'
import { connectToDuckDB, printTable } from './run'
import { parser } from '../lang/parser.js'

function collectDiagnosticsFromAnalyze(source: string): { diags: CliDiagnostic[]; sqls: string[] } {
  const { tables, queries } = analyze(source)
  const diags = [
    ...tables.flatMap((t: any) => t.diagnostics || []),
    ...queries.flatMap((q: any) => q.diagnostics || []),
  ] as CliDiagnostic[]
  const sqls = (queries as any[]).map((q) => q.sql as string)
  return { diags, sqls }
}

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
    const src = await readInput(input)
    const { diags, sqls } = collectDiagnosticsFromAnalyze(src)
    const errors = diags.filter((d) => d.severity === 'error')
    if (errors.length) {
      printDiagnostics(errors, src)
      process.exitCode = 1
      return
    }

    if (opts.debug) {
      const tree = parser.parse(src)
      console.log(tree.toString())
    }

    if (sqls.length === 0) {
      console.log(chalk.yellow('No queries found in input'))
      return
    }
    console.log(sqls.join('\n\n'))
  })

program
  .command('run')
  .description('Run a query against a DuckDB database')
  .argument('[input]', 'Path to file, a raw string, or "-" for stdin')
  .action(async (input: string | undefined) => {
    await loadWorkspace(process.cwd())
    const src = await readInput(input)

    const { diags, sqls } = collectDiagnosticsFromAnalyze(src)
    const errors = diags.filter((d) => d.severity === 'error')
    if (errors.length) {
      printDiagnostics(errors, src)
      process.exitCode = 1
      return
    }

    if (sqls.length === 0) {
      console.log(chalk.yellow('No queries found in input'))
      return
    }
    const sql = sqls[0]
    const db = await connectToDuckDB()
    if (!db) {
      process.exitCode = 1
      return
    }
    const res = await db.query(sql)
    printTable(res.rows)
  })

program.command('serve').description('Run the local server').action(serve)

program.parse(process.argv)
