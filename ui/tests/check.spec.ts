import {test, expect, waitForGrapheneQueries, type ServerFixture} from './fixtures'
import type {Page} from '@playwright/test'
import path from 'path'
import fs from 'fs-extra'
import os from 'node:os'
import {fileURLToPath} from 'url'
import {check} from '../../cli/check.ts'
import {clearWorkspace} from '../../lang/core.ts'
import {setConfig} from '../../lang/config.ts'

const flightsRoot = path.join(fileURLToPath(import.meta.url), '../../../examples/flights')

test.describe.configure({mode: 'serial'})

test('check without md argument reports static analysis errors', async () => {
  await withWorkspace({
    'tmp_bad.gsql': [
      'table tmp_bad as (',
      '  from flights select not_a_function()',
      ')',
    ].join('\n'),
    'tmp_bad.md': [
      '# Broken Markdown',
      '',
      '```sql md_error',
      'from tmp_bad select count(',
      '```',
    ].join('\n'),
  }, async workspace => {
    let result = await runCheckCli({workspace})
    expect(result.exitCode).toBe(1)
    expect(result.logs).toEqual([])
    expect(result.errors).toEqual([
      [
        'ERROR: tmp_bad.md line 5: Syntax error',
        '   | ```',
        '   |    ^',
        'ERROR: tmp_bad.gsql line 2: Unknown function: not_a_function',
        '   |   from flights select not_a_function()',
        '   |                       ^^^^^^^^^^^^^^^^',
      ].join('\n'),
    ])
  })
})

test('check with md file reports analysis query errors', async () => {
  await withWorkspace({
    'index.md': [
      '# Runtime Error Page',
      '',
      '```sql runtime_error_query',
      'from flights select not_a_function() as explode',
      '```',
      '',
      '<BarChart data="runtime_error_query" x="origin" y="explode" />',
    ].join('\n'),
  }, async workspace => {
    let result = await runCheckCli({workspace, mdFile: 'index.md'})
    expect(result.exitCode).toBe(1)
    expect(result.logs).toEqual([])
    expect(result.errors).toEqual([
      [
        'ERROR: index.md line 4: Unknown function: not_a_function',
        '   | from flights select not_a_function() as explode',
        '   |                     ^^^^^^^^^^^^^^^^',
      ].join('\n'),
    ])
  })
})

test('cli check command reports runtime cast errors with field metadata', async ({page, server}) => {
  test.setTimeout(30_000)
  let content = [
    '# Runtime Cast Error Page',
    '',
    '```sql runtime_error_query',
    'from flights select origin, sqrt(dep_delay) as explode',
    '```',
    '',
    '<BarChart data="runtime_error_query" x="origin" y="explode" title="Runtime Cast Error" />',
  ].join('\n')

  await withWorkspace({'index.md': '# Placeholder\n'}, async workspace => {
    let port = await openPage({page, server, workspace, mdFile: 'index.md', content, waitForGraphene: false})
    let result = await runCheckCli({workspace, mdFile: 'index.md', port})
    expect(result.exitCode).toBe(1)
    expect(result.errors).toEqual([
      '- index.md · runtime_error_query: Out of Range Error: cannot take square root of a negative number',
      '    fields: x=origin, y=explode',
      'Error: Out of Range Error: cannot take square root of a negative number',
      'Runtime errors found in index.md',
    ])
  })
})

test('cli check command reports runtime chart configuration errors', async ({page, server}) => {
  test.setTimeout(30_000)
  let content = [
    '# Runtime Chart Config Error',
    '',
    '```sql chart_data',
    'from flights select carrier, min(dep_delay) as worst_delay',
    '```',
    '',
    '<BarChart data="chart_data" x="carrier" y="worst_delay" yLog="true" title="Runtime Chart Config Error" />',
  ].join('\n')

  await withWorkspace({'index.md': '# Placeholder\n'}, async workspace => {
    let port = await openPage({page, server, workspace, mdFile: 'index.md', content, waitForGraphene: false})
    let result = await runCheckCli({workspace, mdFile: 'index.md', port})
    expect(result.exitCode).toBe(1)
    expect(result.logs).toEqual([
      expect.stringMatching(/^\[browser log\] Got message/),
      expect.stringMatching(/^Screenshot saved to /),
    ])
    expect(result.errors).toEqual([
      '- index.md: [object Object]',
      'Runtime errors found in index.md',
    ])
    await expect(page.getByRole('alert')).toHaveText(/Log axis cannot display values less than or equal to zero/)
  })
})

test('cli check with --chart captures a single chart screenshot', async ({page, server}) => {
  test.setTimeout(30_000)
  let chartTitle = 'Carrier Distance'
  let content = [
    '# Chart Screenshot',
    '',
    '```sql chart_data',
    'from flights select carrier, sum(distance) as total_distance',
    '```',
    '',
    `<BarChart data="chart_data" x="carrier" y="total_distance" title="${chartTitle}" />`,
  ].join('\n')

  await withWorkspace({'index.md': '# Placeholder\n'}, async workspace => {
    let port = await openPage({page, server, workspace, mdFile: 'index.md', content, waitForGraphene: false})
    let result = await runCheckCli({workspace, mdFile: 'index.md', chart: chartTitle, port})
    expect(result.exitCode).toBe(0)
    expect(result.errors).toEqual([])
    expect(result.logs).toEqual([
      expect.stringMatching(/^\[browser log\] Got message/),
      expect.stringMatching(/^Screenshot saved to /),
      'No errors found 💎',
    ])

    let usedHtml2canvas = await page.evaluate(() => Boolean(window.html2canvas))
    expect(usedHtml2canvas).toBe(false)
  })
})

test('cli check fails when the server is not running', async () => {
  await withWorkspace({'index.md': '# Broken Page\n'}, async workspace => {
    let result = await runCheckCli({workspace, mdFile: 'index.md'})
    expect(result.exitCode).toBe(1)
    expect(result.logs).toEqual([])
    expect(result.errors).toEqual([
      "Graphene server isn't running. Start it with `graphene serve`",
    ])
  })
})

interface Workspace {
  root: string
  write: (relativePath: string, content: string) => Promise<void>
  cleanup: () => Promise<void>
}

async function withWorkspace (initialFiles: Record<string, string>, fn: (workspace: Workspace) => Promise<void>): Promise<void> {
  let workspace = await createWorkspace(initialFiles)
  try {
    await fn(workspace)
  } finally {
    await workspace.cleanup()
  }
}

async function createWorkspace (initialFiles: Record<string, string> = {}): Promise<Workspace> {
  let dir = await fs.mkdtemp(path.join(os.tmpdir(), 'graphene-check-'))
  let write = async (relativePath: string, content: string) => {
    let target = path.join(dir, relativePath)
    await fs.ensureDir(path.dirname(target))
    await fs.writeFile(target, content, 'utf-8')
  }

  await fs.ensureSymlink(path.join(flightsRoot, 'node_modules'), path.join(dir, 'node_modules'), 'dir')
  await fs.ensureSymlink(path.join(flightsRoot, 'models.gsql'), path.join(dir, 'models.gsql'), 'file')
  await fs.ensureSymlink(path.join(flightsRoot, 'flights.duckdb'), path.join(dir, 'flights.duckdb'), 'file')
  await fs.writeJson(path.join(dir, 'package.json'), {
    name: 'graphene-check-workspace',
    version: '0.0.0',
    type: 'module',
    graphene: {dialect: 'duckdb'},
  })

  let files = {'index.md': '# Placeholder\n', ...initialFiles}
  await Promise.all(Object.entries(files).map(([file, contents]) => write(file, contents)))

  return {
    root: dir,
    write,
    cleanup: async () => { await fs.remove(dir).catch(() => {}) },
  }
}

interface CheckRunResult {
  exitCode: number
  errors: string[]
  logs: string[]
}

async function runCheckCli ({workspace, mdFile, chart, port = 4000}: {workspace: Workspace, mdFile?: string, chart?: string, port?: number}): Promise<CheckRunResult> {
  return await withConsoleCapture(async capture => {
    setConfig({dialect: 'duckdb', port, root: workspace.root})
    clearWorkspace()
    let ok: boolean
    try {
      ok = await check({mdArg: mdFile, chart})
    } finally {
      clearWorkspace()
    }
    let logs = [...capture.logs]
    if (logs.some(line => line.includes('Opening page '))) {
      throw new Error(`check attempted to open a browser tab during tests:\n${logs.join('\n')}`)
    }
    return {
      exitCode: ok ? 0 : 1,
      errors: [...capture.errors],
      logs,
    }
  })
}

interface OpenPageOptions {
  page: Page
  server: ServerFixture
  workspace: Workspace
  mdFile: string
  content: string
  waitForGraphene?: boolean
}

async function openPage ({page, server, workspace, mdFile, content, waitForGraphene = true}: OpenPageOptions) {
  await workspace.write(mdFile, content)
  let baseUrl = server.url({root: workspace.root})
  let filePath = `/${mdFile.replace(/^\//, '')}`
  let routePath = routeFor(mdFile)
  server.mockFile(filePath, content)
  if (routePath !== '/' && routePath !== filePath) server.mockFile(routePath, content)
  let url = new URL(routePath, baseUrl).toString()
  let navResponse = await page.goto(url)
  if (navResponse?.status() === 404) {
    await page.waitForTimeout(500)
    navResponse = await page.goto(url)
  }
  expect(navResponse?.status()).toBe(200)
  if (waitForGraphene) await waitForGrapheneQueries(page)
  return Number(new URL(baseUrl).port)
}

function routeFor (mdFile: string): string {
  let normalised = mdFile.replace(/^\//, '').replace(/\.md$/, '')
  if (!normalised || normalised === 'index') return '/'
  return `/${normalised}`
}

async function withConsoleCapture<T> (fn: (capture: ConsoleCapture) => Promise<T>): Promise<T> {
  let capture = captureConsole()
  try {
    return await fn(capture)
  } finally {
    capture.restore()
  }
}

type ConsoleCapture = ReturnType<typeof captureConsole>

function captureConsole (): {errors: string[], logs: string[], restore: () => void} {
  let originalError = console.error
  let originalLog = console.log
  let errors: string[] = []
  let logs: string[] = []
  console.error = (...args: any[]) => {
    errors.push(cleanLog(args))
  }
  console.log = (...args: any[]) => {
    logs.push(cleanLog(args))
  }
  return {
    errors,
    logs,
    restore: () => {
      console.error = originalError
      console.log = originalLog
    },
  }
}

function cleanLog (args: any[]): string {
  let text = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ')
  return text.replace(/\u001b\[[0-9;]*m/g, '')
}
