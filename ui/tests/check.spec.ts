import {test, expect, waitForGrapheneQueries, type ServerFixture, type ServerOptions} from './fixtures'
import type {Page} from '@playwright/test'
import path from 'path'
import fs from 'fs-extra'
import {fileURLToPath} from 'url'
import os from 'node:os'
import {check} from '../../cli/check.ts'
import {clearWorkspace} from '../../lang/core.ts'
import {setConfig} from '../../lang/config.ts'

const flightsRoot = path.join(fileURLToPath(import.meta.url), '../../../examples/flights')
const flightsModelsPath = path.join(flightsRoot, 'models.gsql')
const flightsDbPath = path.join(flightsRoot, 'flights.duckdb')

test.describe.configure({mode: 'serial'})

test('check without md argument reports static analysis errors', async () => {
  let workspace = await createWorkspace()
  let badGsql = path.join(workspace.root, 'tmp_bad.gsql')
  let badMd = path.join(workspace.root, 'tmp_bad.md')

  await fs.writeFile(badGsql, [
    'table tmp_bad as (',
    '  from flights select not_a_function()',
    ')',
  ].join('\n'), 'utf-8')
  await fs.writeFile(badMd, [
    '# Broken Markdown',
    '',
    '```sql md_error',
    'from tmp_bad select count(',
    '```',
  ].join('\n'), 'utf-8')

  let capture = captureConsole()
  try {
    setConfig({dialect: 'duckdb', port: 4000, root: workspace.root})
    clearWorkspace()
    let res = await check({workspaceRoot: workspace.root})
    expect(res).toBe(false)
  } finally {
    capture.restore()
    await workspace.cleanup()
    clearWorkspace()
  }

  let combined = capture.errors.join('\n')
  expect(combined).toContain('tmp_bad.gsql')
  expect(combined).toContain('tmp_bad.md')
  expect(combined).toContain('not_a_function')
})

test('check with md file reports analysis query errors', async ({page, server}) => {
  test.setTimeout(30_000)
  let heading = 'Runtime Error Page'
  let content = [
    `# ${heading}`,
    '',
    '```sql runtime_error_query',
    'from flights select not_a_function() as explode',
    '```',
    '',
    '<BarChart data="runtime_error_query" x="origin" y="explode" />',
  ].join('\n')

  await runCliCheckScenario(page, server, {
    mdFile: 'index.md',
    content,
    skipServer: true,
    assertions: ({capture}) => {
      let combinedErrors = capture.errors.join('\n')
      expect(combinedErrors).toContain('index.md')
      expect(combinedErrors).toContain('Unknown function: not_a_function')
      expect(combinedErrors).toContain('from flights select not_a_function() as explode')
      expect(combinedErrors).not.toContain('Runtime errors found in index.md')
      expect(capture.logs.some(line => line.includes('Screenshot saved to'))).toBe(false)
    },
  })
})

test('cli check command reports runtime cast errors with field metadata', async ({page, server}) => {
  test.setTimeout(30_000)
  let heading = 'Runtime Cast Error Page'
  let content = [
    `# ${heading}`,
    '',
    '```sql runtime_error_query',
    'from flights select origin, sqrt(dep_delay) as explode',
    '```',
    '',
    '<BarChart data="runtime_error_query" x="origin" y="explode" title="Runtime Cast Error" />',
  ].join('\n')

  await runCliCheckScenario(page, server, {
    mdFile: 'index.md',
    content,
    diskContent: '# Placeholder\n',
    assertions: ({capture}) => {
      let summaryLine = capture.errors.find(line => line.includes('Runtime errors found in index.md'))
      expect(summaryLine).toBeTruthy()
      let detailLine = capture.errors.find(line => line.includes('Out of Range Error') || line.includes('square root of a negative number'))
      expect(detailLine).toBeTruthy()
      expect(detailLine).toContain('index.md')
      expect(detailLine).toContain('runtime_error_query')
      let fieldsLine = capture.errors.find(line => line.includes('fields:'))
      expect(fieldsLine).toBeTruthy()
      expect(fieldsLine).toContain('x=origin')
      expect(fieldsLine).toContain('y=explode')
    },
  })
})

test('cli check command reports runtime chart configuration errors', async ({page, server}) => {
  test.setTimeout(30_000)
  let heading = 'Runtime Chart Config Error'
  let content = [
    `# ${heading}`,
    '',
    '```sql chart_data',
    'from flights select carrier, min(dep_delay) as worst_delay',
    '```',
    '',
    '<BarChart data="chart_data" x="carrier" y="worst_delay" yLog="true" title="Runtime Chart Config Error" />',
  ].join('\n')

  await runCliCheckScenario(page, server, {
    mdFile: 'index.md',
    content,
    diskContent: '# Placeholder\n',
    assertions: ({capture}) => {
      let summaryLine = capture.errors.find(line => line.includes('Runtime errors found in index.md'))
      expect(summaryLine).toBeTruthy()
      let detailLine = capture.errors.find(line => line.includes('Error in Bar Chart') && line.includes('Log axis cannot display values less than or equal to zero'))
      expect(detailLine).toBeTruthy()
    },
  })
})

test('cli check with --chart captures a single chart screenshot', async ({page, server}) => {
  test.setTimeout(30_000)
  let heading = 'Chart Screenshot'
  let chartTitle = 'Carrier Distance'
  let content = [
    `# ${heading}`,
    '',
    '```sql chart_data',
    'from flights select carrier, sum(distance) as total_distance',
    '```',
    '',
    `<BarChart data="chart_data" x="carrier" y="total_distance" title="${chartTitle}" />`,
  ].join('\n')

  await runCliCheckScenario(page, server, {
    mdFile: 'index.md',
    content,
    chart: chartTitle,
    expectExitCode: 0,
    assertions: async ({capture, page}) => {
      expect(capture.errors).toEqual([])
      expect(capture.logs.some(line => line.includes('Screenshot saved to'))).toBe(true)
      let usedHtml2canvas = await page.evaluate(() => Boolean(window.html2canvas))
      expect(usedHtml2canvas).toBe(false)
    },
  })
})

test('cli check reports page load errors', async ({page, server}) => {
  test.setTimeout(30_000)
  let heading = 'Broken Page'
  let content = [
    `# ${heading}`,
    '',
    '{(() => { throw new Error("Cannot read properties of undefined") })()}',
  ].join('\n')

  await runCliCheckScenario(page, server, {
    mdFile: 'page-error.md',
    content,
    diskContent: '# Page Error\n',
    assertions: ({capture}) => {
      let detailLine = capture.errors.find(line => line.includes('Cannot read properties of undefined'))
      expect(detailLine).toBeTruthy()
    },
  })
})

function captureConsole () {
  let originalError = console.error
  let originalLog = console.log
  let errors: string[] = []
  let logs: string[] = []
  console.error = (...args: any[]) => {
    errors.push(args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '))
  }
  console.log = (...args: any[]) => {
    logs.push(args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '))
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

async function createWorkspace (indexContent = '# Placeholder\n') {
  let dir = await fs.mkdtemp(path.join(os.tmpdir(), 'graphene-check-'))
  await fs.ensureSymlink(path.join(flightsRoot, 'node_modules'), path.join(dir, 'node_modules'), 'dir')
  await fs.ensureSymlink(flightsModelsPath, path.join(dir, 'models.gsql'), 'file')
  await fs.ensureSymlink(flightsDbPath, path.join(dir, 'flights.duckdb'), 'file')
  await fs.writeJson(path.join(dir, 'package.json'), {
    name: 'graphene-check-workspace',
    version: '0.0.0',
    type: 'module',
    graphene: {dialect: 'duckdb'},
  })
  let indexPath = path.join(dir, 'index.md')
  await fs.writeFile(indexPath, indexContent, 'utf-8')
  return {
    root: dir,
    indexPath,
    cleanup: async () => { await fs.remove(dir).catch(() => {}) },
  }
}

interface ScenarioOptions {
  mdFile: string
  content: string
  heading?: string
  expectExitCode?: number
  diskContent?: string
  skipServer?: boolean
  serverOptions?: ServerOptions
  chart?: string
  assertions: (ctx: {capture: ReturnType<typeof captureConsole>, workspace: Awaited<ReturnType<typeof createWorkspace>>, page: Page}) => Promise<void> | void
}

async function runCliCheckScenario (page: Page, server: ServerFixture, options: ScenarioOptions): Promise<void> {
  let initialIndexContent = options.mdFile === 'index.md' && options.diskContent !== undefined
    ? options.diskContent
    : options.mdFile === 'index.md'
      ? options.content
      : '# Placeholder\n'
  let workspace = await createWorkspace(initialIndexContent)
  let diskTarget = path.join(workspace.root, options.mdFile)
  let shouldWriteDisk =
    options.diskContent !== undefined ||
    options.mdFile !== 'index.md' ||
    !(await fs.pathExists(diskTarget))
  if (shouldWriteDisk) {
    await fs.writeFile(diskTarget, options.diskContent ?? options.content, 'utf-8')
  }

  let capture = captureConsole()
  try {
    if (!options.skipServer) {
      let serverRoot = options.serverOptions?.root ?? workspace.root
      let baseUrl = await server.url({...options.serverOptions, root: serverRoot})
      server.mockFile(`/${options.mdFile}`, options.content)
      let route = options.mdFile === 'index.md' ? '/' : `/${options.mdFile.replace(/\.md$/, '')}`
      let url = new URL(route, baseUrl).toString()
      let navResponse = await page.goto(url)
      if (navResponse?.status() === 404) {
        await page.waitForTimeout(500)
        navResponse = await page.goto(url)
      }
      expect(navResponse?.status()).toBe(200)
      await waitForGrapheneQueries(page)
      if (options.heading) await expect(page.getByRole('heading', {level: 1, name: options.heading})).toBeVisible({timeout: 10_000})
    } else {
      setConfig({dialect: 'duckdb', port: 4000, root: workspace.root})
      clearWorkspace()
    }

    let exitCode = await runCheckCommand({mdFile: options.mdFile, chart: options.chart, root: workspace.root})
    expect(exitCode).toBe(options.expectExitCode ?? 1)
    await options.assertions({capture, workspace, page})
  } finally {
    capture.restore()
    await workspace.cleanup()
    clearWorkspace()
  }
}

async function runCheckCommand ({mdFile, chart, root}: {mdFile?: string, chart?: string, root: string}): Promise<number> {
  clearWorkspace()
  let ok = await check({mdArg: mdFile, chart, workspaceRoot: root})
  return ok ? 0 : 1
}
