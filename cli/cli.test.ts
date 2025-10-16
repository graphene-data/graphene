/// <reference types="vitest/globals" />
import {spawn} from 'node:child_process'
import {expect} from 'vitest'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import {getPidFilePath, isProcessRunning, readPid, stopGrapheneIfRunning} from './background.ts'

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

const dir = path.resolve(import.meta.url.replace('file://', ''), '../')
const flightDir = path.resolve(dir, '../examples/flights')

function runCli (args: string[], cwd?: string): Promise<RunResult> {
  return new Promise((resolve) => {
    let cliEntry = path.resolve(dir, 'cli.ts')
    let child = spawn('node', [cliEntry, ...args], {cwd, env: {...process.env, NODE_ENV: 'test', GRAPHENE_PORT: String(4163)}})
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('close', (code) => resolve({code: code ?? 0, stdout, stderr}))
  })
}

async function ensureServerStopped (root: string): Promise<void> {
  await stopGrapheneIfRunning(root)
  await removePidFile(getPidFilePath(root))
}

async function removePidFile (pidFile: string): Promise<void> {
  await fsp.rm(pidFile, {force: true}).catch(() => {})
}

describe('cli compile', () => {
  it('compiles a basic query (happy path)', async () => {
    let res = await runCli(['compile', 'from flights select carrier'], flightDir)
    expect(res.code).toBe(0)
    expect(res.stdout.toLowerCase()).toContain('from flights')
    expect(res.stdout.toLowerCase()).toContain('select')
  })

  it('errors on invalid function (error path)', async () => {
    let res = await runCli(['compile', 'from flights select not_a_function()'], flightDir)
    expect(res.code).not.toBe(0)
    expect(res.stderr.toLowerCase()).toContain('unknown function')
  })
})

describe('cli serve (background)', () => {
  let pidFile = getPidFilePath(flightDir)

  beforeEach(async () => { await ensureServerStopped(flightDir) })
  afterEach(async () => { await ensureServerStopped(flightDir) })

  it('starts the server in the background and restarts cleanly', {timeout: 10000}, async () => {
    let first = await runCli(['serve'], flightDir)
    expect(first.code).toBe(0)
    expect(first.stdout).toContain('Server running at')

    let firstPid = await readPid(pidFile)
    if (!firstPid) throw new Error('Expected a pid after starting the server')
    expect(isProcessRunning(firstPid)).toBe(true)

    let response = await fetch('http://localhost:4163/')
    expect(response.status).toBe(200)

    let second = await runCli(['serve'], flightDir)
    expect(second.code).toBe(0)
    expect(second.stdout).toContain('Stopping server')

    let secondPid = await readPid(pidFile)
    if (!secondPid) throw new Error('Expected a pid after restarting the server')
    expect(secondPid).not.toBe(firstPid)

    expect(isProcessRunning(secondPid)).toBe(true)
    expect(isProcessRunning(firstPid)).toBe(false)

    let restartResponse = await fetch('http://localhost:4163/')
    expect(restartResponse.status).toBe(200)
  })

  it('stops the server when running', {timeout: 10000}, async () => {
    let start = await runCli(['serve'], flightDir)
    expect(start.code).toBe(0)

    let pid = await readPid(pidFile)
    if (!pid) throw new Error('Expected pid file after starting server')
    expect(isProcessRunning(pid)).toBe(true)

    let stop = await runCli(['stop'], flightDir)
    expect(stop.code).toBe(0)
    expect(stop.stdout).toContain('Stopping server')

    expect(await readPid(pidFile)).toBeUndefined()
    expect(isProcessRunning(pid)).toBe(false)
  })
})

describe('cli run', () => {
  beforeAll(() => {
    let dbPath = path.resolve(flightDir, 'flights.duckdb')
    if (!fs.existsSync(dbPath)) throw new Error('flights.duckdb not found. Run `pnpm run setup` in examples/flights')
  })

  it('runs a query against flights.duckdb (happy path)', async () => {
    let res = await runCli(['run', 'from flights select count() as total'], flightDir)
    expect(res.code).toBe(0)
    expect(res.stdout.toLowerCase()).toContain('total')
  })

  it('shows an error when no .duckdb is present (error path)', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-cli-'))
    let input = [
      'table t (a int)',
      'from t select a',
    ].join('\n')
    let res = await runCli(['run', input], tmpDir)
    expect(res.code).toBe(1) // command handles the error and exits without throwing
    expect(res.stderr.toLowerCase()).toContain('no .duckdb file found')
  })
})
