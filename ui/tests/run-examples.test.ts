import {spawn} from 'node:child_process'
import fs from 'node:fs'
import * as fsp from 'node:fs/promises'
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

async function listMarkdownFiles(dir: string): Promise<string[]> {
  let files: string[] = []

  async function walk(currentDir: string) {
    let entries = await fsp.readdir(currentDir, {withFileTypes: true})
    for (let entry of entries) {
      if (entry.name === 'node_modules') continue
      let fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      files.push(path.relative(dir, fullPath).replace(/\\/g, '/'))
    }
  }

  await walk(dir)
  return files.sort()
}

async function getExampleDirs(examplesDir: string): Promise<string[]> {
  let entries = await fsp.readdir(examplesDir, {withFileTypes: true})
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(examplesDir, entry.name))
    .filter(dir => fs.existsSync(path.join(dir, 'package.json')))
    .sort()
}

function shouldRunExample(exampleName: string) {
  if (exampleName === 'clickhouse') return !!process.env.CLICKHOUSE_URL && !!process.env.CLICKHOUSE_USERNAME && !!process.env.CLICKHOUSE_PASSWORD
  return true
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

test.skipIf(!process.env.SLOW_TEST)('graphene run succeeds for every markdown file in examples', {timeout: 900_000}, async ({page}) => {
  let testsDir = path.dirname(fileURLToPath(import.meta.url))
  let coreDir = path.resolve(testsDir, '../..')
  let examplesDir = path.join(coreDir, 'examples')
  let allExampleDirs = await getExampleDirs(examplesDir)
  let exampleDirs = allExampleDirs.filter(exampleDir => shouldRunExample(path.basename(exampleDir)))
  let skippedExamples = allExampleDirs.map(dir => path.basename(dir)).filter(name => !shouldRunExample(name))

  expect(allExampleDirs.length).toBeGreaterThan(0)
  expect(exampleDirs.length).toBeGreaterThan(0)

  expectConsoleError(/\[ECharts\] The ticks may be not readable/)

  let runPlan = await Promise.all(exampleDirs.map(async exampleDir => ({exampleDir, markdownFiles: await listMarkdownFiles(exampleDir)})))
  let plannedFiles = runPlan.flatMap(({exampleDir, markdownFiles}) => markdownFiles.map(mdPath => `${path.basename(exampleDir)}/${mdPath}`))

  console.log(`[run-examples] found ${exampleDirs.length} runnable example directories`)
  if (skippedExamples.length) console.log(`[run-examples] skipped examples: ${skippedExamples.join(', ')}`)
  console.log(`[run-examples] planned markdown files (${plannedFiles.length}):`)
  plannedFiles.forEach(file => console.log(`[run-examples]   - ${file}`))

  let totalMdFiles = 0

  for (let {exampleDir, markdownFiles} of runPlan) {
    if (!markdownFiles.length) {
      console.log(`[run-examples] ${path.basename(exampleDir)}: no markdown files, skipping`)
      continue
    }

    totalMdFiles += markdownFiles.length
    console.log(`[run-examples] ${path.basename(exampleDir)}: ${markdownFiles.length} markdown files`)

    let port = await getAvailablePort()
    let childEnv = {...process.env, NODE_ENV: 'test', GRAPHENE_PORT: String(port)}

    try {
      let serveResult = await runCli(['serve', '--bg'], exampleDir, childEnv)
      expectSuccess(`serve ${path.basename(exampleDir)}`, serveResult)

      for (let mdPath of markdownFiles) {
        console.log(`[run-examples] running ${path.basename(exampleDir)}/${mdPath}`)
        await page.goto(`http://localhost:${port}${toPageUrl(mdPath)}`)
        await waitForGrapheneLoad(page, 60_000)

        let runResult = await runCli(['run', mdPath], exampleDir, childEnv)
        expectSuccess(`run ${path.basename(exampleDir)}/${mdPath}`, runResult)

        let output = stripAnsi(runResult.stdout + runResult.stderr)
        expect(output).toContain('No errors found')
      }
    } finally {
      expectConsoleError(/WebSocket connection to 'ws:\/\/localhost:\d+\/_api\/ws' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED/)
      await runCli(['stop'], exampleDir, childEnv)
    }
  }

  expect(totalMdFiles).toBeGreaterThan(0)
  console.log(`[run-examples] processed ${totalMdFiles} markdown files total`)
})
