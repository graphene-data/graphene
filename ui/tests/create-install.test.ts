import {spawn} from 'node:child_process'
import * as fsp from 'node:fs/promises'
import * as net from 'node:net'
import * as os from 'node:os'
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

const shouldRunCreatePackTest = !!process.env.CI || process.env.GRAPHENE_CREATE_PACK_TEST === '1'

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<RunResult> {
  return new Promise(resolve => {
    let child = spawn(command, args, {cwd, env})
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
  throw new Error(`[create-install.test] ${step} failed (code ${result.code})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
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

function parseTarballPath(result: RunResult, cwd: string) {
  let matches = Array.from((result.stdout + result.stderr).matchAll(/([^\s]+\.tgz)/g), m => m[1])
  let tarball = matches.at(-1)
  if (!tarball) throw new Error('Could not find packed .tgz path in pnpm pack output')
  return path.isAbsolute(tarball) ? tarball : path.resolve(cwd, tarball)
}

test.skipIf(!shouldRunCreatePackTest)('packs create and scaffolds a project that renders', {timeout: 300_000}, async ({page}) => {
  let testsDir = path.dirname(fileURLToPath(import.meta.url))
  let coreDir = path.resolve(testsDir, '../..')
  let createDir = path.join(coreDir, 'create')
  let cliDir = path.join(coreDir, 'cli')
  let tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-create-pack-'))
  let port = await getAvailablePort()
  let childEnv = {...process.env, NODE_ENV: 'development', GRAPHENE_PORT: String(port)}
  let projectDir = path.join(tempRoot, 'demo-app')

  try {
    await page.setViewportSize({width: 1600, height: 1000})

    let packCreate = await run('pnpm', ['pack'], createDir)
    expectSuccess('pnpm pack create', packCreate)
    let createTarball = parseTarballPath(packCreate, createDir)

    let packCli = await run('pnpm', ['pack'], cliDir)
    expectSuccess('pnpm pack cli', packCli)
    let cliTarball = parseTarballPath(packCli, cliDir)

    let scaffold = await run('npm', ['exec', '--yes', '--package', createTarball, '--', 'create-graphenedata', 'demo-app', '--yes', '--no-install'], tempRoot, childEnv)
    expectSuccess('npm exec create-graphenedata', scaffold)

    let install = await run('npm', ['install', cliTarball], projectDir, childEnv)
    expectSuccess('npm install cli tarball', install)

    let checkResult = await run('npm', ['run', 'graphene', '--', 'check', 'index.md'], projectDir, childEnv)
    expectSuccess('graphene check index.md', checkResult)
    expect(stripAnsi(checkResult.stdout + checkResult.stderr)).toContain('No errors found')

    let serveResult = await run('npm', ['run', 'graphene', '--', 'serve', '--bg'], projectDir, childEnv)
    expectSuccess('graphene serve --bg', serveResult)

    await page.goto(`http://localhost:${port}/`)
    await waitForGrapheneLoad(page)
    await expect(page.locator('main')).screenshot('create-project-renders')
  } finally {
    expectConsoleError(/WebSocket connection to 'ws:\/\/localhost:\d+\/_api\/ws' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED/)
    await run('npm', ['run', 'graphene', '--', 'stop'], projectDir, childEnv)
    await fsp.rm(tempRoot, {recursive: true, force: true})
  }
})
