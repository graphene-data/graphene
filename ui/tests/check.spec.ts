import {test, expect, waitForGrapheneQueries} from './fixtures'
import type {Page} from '@playwright/test'
import path from 'path'
import fs from 'fs-extra'
import {fileURLToPath} from 'url'
import os from 'node:os'
import net from 'node:net'
import type {ViteDevServer} from 'vite'
import {check} from '../../cli/check.ts'
import {clearWorkspace} from '../../lang/core.ts'
import {setConfig} from '../../lang/config.ts'
import {serve2, mockFileMap} from '../../cli/serve2.ts'

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

test('check with md file reports runtime query errors and captures fields', async ({page}) => {
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

  await runCliCheckScenario(page, {
    mdFile: 'index.md',
    content,
    diskContent: '# Placeholder\n',
    heading,
    assertions: ({capture}) => {
      let combinedErrors = capture.errors.join('\n')
      expect(combinedErrors).toContain('Runtime errors found in index.md')
      expect(combinedErrors).toContain('Unknown function')
      expect(combinedErrors).toContain('runtime_error_query')
      expect(combinedErrors).toContain('fields: x=origin, y=explode')
      expect(capture.logs.some(line => line.includes('Screenshot saved to'))).toBe(true)
    },
  })
})

test('cli check command reports runtime query errors with field metadata', async ({page}) => {
  test.setTimeout(30_000)
  let heading = 'CLI Runtime Error Page'
  let content = [
    `# ${heading}`,
    '',
    '```sql runtime_error_query',
    'from flights select not_a_function() as explode',
    '```',
    '',
    '<BarChart data="runtime_error_query" x="origin" y="explode" />',
  ].join('\n')

  await runCliCheckScenario(page, {
    mdFile: 'index.md',
    content,
    diskContent: '# Placeholder\n',
    assertions: ({capture}) => {
      let summaryLine = capture.errors.find(line => line.includes('Runtime errors found in index.md'))
      expect(summaryLine).toBeTruthy()
      let detailLine = capture.errors.find(line => line.includes('Unknown function'))
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

test('cli check reports chart configuration errors', async ({page}) => {
  test.setTimeout(30_000)
  let heading = 'Chart Config Error'
  let content = [
    `# ${heading}`,
    '',
    '```sql chart_data',
    'from flights select carrier, count() as total',
    '```',
    '',
    '<BarChart data="chart_data" x="carrier" y="missing" />',
  ].join('\n')

  await runCliCheckScenario(page, {
    mdFile: 'index.md',
    content,
    diskContent: '# Placeholder\n',
    assertions: ({capture}) => {
      let detailLine = capture.errors.find(line => line.includes('Could not find "missing" on chart_data'))
      expect(detailLine).toBeTruthy()
      let fieldsLine = capture.errors.find(line => line.includes('fields:'))
      expect(fieldsLine).toBeTruthy()
      expect(fieldsLine).toContain('x=carrier')
      expect(fieldsLine).toContain('y=missing')
    },
  })
})

test('cli check reports page load errors', async ({page}) => {
  test.setTimeout(30_000)
  let heading = 'Broken Page'
  let content = [
    `# ${heading}`,
    '',
    '{(() => { throw new Error("Cannot read properties of undefined") })()}',
  ].join('\n')

  await runCliCheckScenario(page, {
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
  assertions: (ctx: {capture: ReturnType<typeof captureConsole>, workspace: Awaited<ReturnType<typeof createWorkspace>>, page: Page}) => Promise<void> | void
}

async function runCliCheckScenario (page: Page, options: ScenarioOptions): Promise<void> {
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
  let server: ViteDevServer | undefined
  let port = 0
  try {
    ({server, port} = await startServer(workspace.root))
    mockFileMap[`/${options.mdFile}`] = options.content

    let route = options.mdFile === 'index.md' ? '/' : `/${options.mdFile.replace(/\.md$/, '')}`
    let url = `http://localhost:${port}${route}`
    let navResponse = await page.goto(url)
    if (navResponse?.status() === 404) {
      await page.waitForTimeout(500)
      navResponse = await page.goto(url)
    }
    expect(navResponse?.status()).toBe(200)
    await waitForGrapheneQueries(page)
    if (options.heading) await expect(page.getByRole('heading', {level: 1, name: options.heading})).toBeVisible({timeout: 10_000})

    let exitCode = await runCheckCommand({mdFile: options.mdFile, root: workspace.root})
    expect(exitCode).toBe(options.expectExitCode ?? 1)
    await options.assertions({capture, workspace, page})
  } finally {
    capture.restore()
    delete mockFileMap[`/${options.mdFile}`]
    await server?.close()
    await workspace.cleanup()
    clearWorkspace()
  }
}

async function startServer (root: string): Promise<{server: ViteDevServer, port: number}> {
  let port = await getAvailablePort()
  setConfig({dialect: 'duckdb', port, root})
  clearWorkspace()
  let server = await serve2()
  return {server, port}
}

async function runCheckCommand ({mdFile, chart, root}: {mdFile?: string, chart?: string, root: string}): Promise<number> {
  clearWorkspace()
  let ok = await check({mdArg: mdFile, chart, workspaceRoot: root})
  return ok ? 0 : 1
}

async function getAvailablePort (): Promise<number> {
  return await new Promise((resolve, reject) => {
    let srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      let {port} = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
  })
}
