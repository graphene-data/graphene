import {type Page} from '@playwright/test'
import {spawn} from 'node:child_process'
import fs from 'node:fs'
import * as net from 'node:net'
import * as path from 'node:path'
import {fileURLToPath} from 'node:url'
import stripAnsi from 'strip-ansi'

import {test, expect, waitForGrapheneLoad} from './fixtures.ts'
import {expectConsoleError} from './logWatcher.ts'

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

function runCli(args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<RunResult> {
  return new Promise(resolve => {
    let cliEntry = path.resolve(cwd, '../../cli/cli.ts')
    let child = spawn('node', [cliEntry, ...args], {cwd, env})
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', data => {
      stdout += data.toString()
    })
    child.stderr.on('data', data => {
      stderr += data.toString()
    })
    child.on('close', code => resolve({code: code ?? 0, stdout, stderr}))
  })
}

function expectSuccess(step: string, result: RunResult) {
  if (result.code === 0) return
  throw new Error(`[run-examples.test] ${step} failed (code ${result.code})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
}

function toPageUrl(mdPath: string) {
  let normalized = mdPath.replace(/\\/g, '/')
  if (normalized === 'index.md') return '/'
  return '/' + normalized.replace(/\.md$/, '')
}

function listMarkdownFiles(dir: string): string[] {
  let files: string[] = []

  function walk(currentDir: string) {
    let entries = fs.readdirSync(currentDir, {withFileTypes: true})
    for (let entry of entries) {
      if (entry.name === 'node_modules') continue
      let fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name == 'AGENTS.md') continue
      files.push(path.relative(dir, fullPath).replace(/\\/g, '/'))
    }
  }

  walk(dir)
  return files.sort()
}

async function getAvailablePort(): Promise<number> {
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

let testsDir = path.dirname(fileURLToPath(import.meta.url))
let coreDir = path.resolve(testsDir, '../..')
let examplesDir = path.join(coreDir, 'examples')

async function runExample(exampleName: string, page: Page) {
  let exampleDir = path.join(examplesDir, exampleName)
  let markdownFiles = listMarkdownFiles(exampleDir)
  expect(markdownFiles.length).toBeGreaterThan(0)
  expectConsoleError(/\[ECharts\] The ticks may be not readable/)
  console.log(`[run-examples] ${exampleName}: ${markdownFiles.length} markdown files`)

  let port = await getAvailablePort()
  let childEnv = {...process.env, NODE_ENV: 'test', GRAPHENE_PORT: String(port)}

  try {
    let serveResult = await runCli(['serve', '--bg'], exampleDir, childEnv)
    expectSuccess(`serve ${exampleName}`, serveResult)

    for (let mdPath of markdownFiles) {
      console.log(`[run-examples] running ${exampleName}/${mdPath}`)
      await page.goto(`http://localhost:${port}${toPageUrl(mdPath)}`)
      await waitForGrapheneLoad(page, 120_000)
      await expect(page).screenshot(`example-${exampleName}-${mdPath.replace(/\.md$/, '').replace(/[^a-z0-9]+/gi, '-')}`)

      let runResult = await runCli(['run', mdPath], exampleDir, childEnv)
      expectSuccess(`run ${exampleName}/${mdPath}`, runResult)

      let output = stripAnsi(runResult.stdout + runResult.stderr)
      expect(output).toContain('No errors found')
    }
  } finally {
    expectConsoleError(/WebSocket connection to 'ws:\/\/localhost:\d+\/_api\/ws' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED/)
    await runCli(['stop'], exampleDir, childEnv)
  }
}

test.skipIf(!process.env.SLOW_TEST)('graphene run succeeds for athena example', {timeout: 180_000}, async ({page}) => {
  await runExample('athena', page)
})

test.skipIf(!process.env.SLOW_TEST || true)('graphene run succeeds for clickhouse example', {timeout: 180_000}, async ({page}) => {
  await runExample('clickhouse', page)
})

test.skipIf(!process.env.SLOW_TEST)('graphene run succeeds for ecomm example', {timeout: 180_000}, async ({page}) => {
  await runExample('ecomm', page)
})

test.skipIf(!process.env.SLOW_TEST)('graphene run succeeds for flights example', {timeout: 180_000}, async ({page}) => {
  await runExample('flights', page)
})

test.skipIf(!process.env.SLOW_TEST)('graphene run succeeds for nba example', {timeout: 180_000}, async ({page}) => {
  await runExample('nba', page)
})

test.skipIf(!process.env.SLOW_TEST)('graphene run succeeds for snowflake example', {timeout: 180_000}, async ({page}) => {
  await runExample('snowflake', page)
})
