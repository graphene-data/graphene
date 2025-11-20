/// <reference types="vitest/globals" />
import {spawn} from 'node:child_process'
import {expect} from 'vitest'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import {isServerRunning, stopGrapheneIfRunning} from './background.ts'
import {setConfig} from '../lang/config.ts'

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

const dir = path.resolve(import.meta.url.replace('file://', ''), '../')
const flightDir = path.resolve(dir, '../examples/flights')
const TEST_PORT = 4163

function runCli (args: string[], cwd?: string): Promise<RunResult> {
  return new Promise((resolve) => {
    let cliEntry = path.resolve(dir, 'cli.ts')
    let env = {...process.env, NODE_ENV: 'test', GRAPHENE_PORT: String(TEST_PORT)}
    let child = spawn('node', [cliEntry, ...args], {cwd, env})
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('close', (code) => resolve({code: code ?? 0, stdout, stderr}))
  })
}

async function cleanupTestServer (): Promise<void> {
  await stopGrapheneIfRunning()
}

function logCliFailure (step: string, res: RunResult) {
  console.error(`[cli.test] ${step} failed (code ${res.code})\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`)
}

function expectCliSuccess (res: RunResult, step: string) {
  if (res.code !== 0) logCliFailure(step, res)
  expect(res.code).toBe(0)
}

describe('cli compile', () => {
  it('compiles a basic query (happy path)', async () => {
    let res = await runCli(['compile', 'from flights select carrier'], flightDir)
    expectCliSuccess(res, 'compile basic query')
    expect(res.stdout.toLowerCase()).toContain('from flights')
    expect(res.stdout.toLowerCase()).toContain('select')
  })

  it('errors on invalid function (error path)', async () => {
    let res = await runCli(['compile', 'from flights select not_a_function()'], flightDir)
    expect(res.code).not.toBe(0)
    expect((res.stdout + res.stderr).toLowerCase()).toContain('unknown function')
  })
})

describe('cli serve (background)', () => {
  let previousServerEnv = process.env.GRAPHENE_SERVER_ENV

  beforeAll(() => {
    process.env.GRAPHENE_SERVER_ENV = 'serve'
  })
  afterAll(() => {
    if (previousServerEnv === undefined) delete process.env.GRAPHENE_SERVER_ENV
    else process.env.GRAPHENE_SERVER_ENV = previousServerEnv
  })

  beforeEach(async () => {
    setConfig({root: flightDir})
    await cleanupTestServer()
  })
  afterEach(async () => { await cleanupTestServer() })

  it('starts the server in the background and restarts cleanly', {timeout: 40000}, async () => {
    let first = await runCli(['serve'], flightDir)
    expectCliSuccess(first, 'serve start')
    expect(first.stdout).toContain('Server running at')
    expect(await isServerRunning(TEST_PORT)).toBe(true)

    let second = await runCli(['serve'], flightDir)
    expectCliSuccess(second, 'serve restart')
    expect(second.stdout).toContain('Stopping server')
    expect(await isServerRunning(TEST_PORT)).toBe(true)
  })

  it('stops the server when running', {timeout: 40000}, async () => {
    let start = await runCli(['serve'], flightDir)
    expectCliSuccess(start, 'serve start before stop')
    expect(await isServerRunning(TEST_PORT)).toBe(true)

    let stop = await runCli(['stop'], flightDir)
    expectCliSuccess(stop, 'serve stop')
    expect(stop.stdout).toContain('Stopping server')
    expect(await isServerRunning(TEST_PORT)).toBe(false)
  })
})

describe('cli run', () => {
  beforeAll(() => {
    let dbPath = path.resolve(flightDir, 'flights.duckdb')
    if (!fs.existsSync(dbPath)) throw new Error('flights.duckdb not found. Run `pnpm run setup` in examples/flights')
  })

  it('runs a query against flights.duckdb (happy path)', async () => {
    let res = await runCli(['run', 'from flights select count() as total'], flightDir)
    expectCliSuccess(res, 'run query')
    expect(res.stdout.toLowerCase()).toContain('total')
  })

  it('shows an error when no .duckdb is present (error path)', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-cli-'))
    let input = [
      'table t (a int)',
      'from t select a',
    ].join('\n')
    let res = await runCli(['run', input], tmpDir)
    expect(res.code).toBe(1)
    expect(res.stderr.toLowerCase()).toContain('no .duckdb file found')
  })
})
