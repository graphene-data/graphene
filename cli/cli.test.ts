/// <reference types="vitest/globals" />
import {spawn} from 'node:child_process'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import {expect} from 'vitest'

import {isServerRunning, stopGrapheneIfRunning} from './background.ts'

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

const dir = path.resolve(import.meta.url.replace('file://', ''), '../')
const flightDir = path.resolve(dir, '../examples/flights')
const TEST_PORT = 4163
process.env.GRAPHENE_PORT = '4163'
process.env.NODE_ENV = 'test'

function runCli(args: string[], cwd?: string): Promise<RunResult> {
  return new Promise(resolve => {
    let cliEntry = path.resolve(dir, 'cli.ts')
    let child = spawn('node', [cliEntry, ...args], {cwd, env: process.env})
    let stdout = '',
      stderr = ''
    child.stdout.on('data', d => {
      stdout += d.toString()
    })
    child.stderr.on('data', d => {
      stderr += d.toString()
    })
    child.on('close', code => resolve({code: code ?? 0, stdout, stderr}))
  })
}

function logCliFailure(step: string, res: RunResult) {
  console.error(`[cli.test] ${step} failed (code ${res.code})\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`)
}

function expectCliSuccess(res: RunResult, step: string) {
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

  it('compiles set operations', async () => {
    let res = await runCli(['compile', 'select 1 as id union all select 2 as id'], flightDir)
    expectCliSuccess(res, 'compile set operation')
    expect(res.stdout.toLowerCase()).toContain('union all')
    expect(res.stdout.toLowerCase()).toContain('select 1 as id')
    expect(res.stdout.toLowerCase()).toContain('select 2 as id')
  })

  it('errors on invalid function (error path)', async () => {
    let res = await runCli(['compile', 'from flights select not_a_function()'], flightDir)
    expect(res.code).not.toBe(0)
    expect((res.stdout + res.stderr).toLowerCase()).toContain('unknown function')
  })
})

describe('cli serve (background)', () => {
  beforeEach(async () => {
    await stopGrapheneIfRunning()
  })
  afterEach(async () => {
    await stopGrapheneIfRunning()
  })

  it('starts the server in the background and restarts cleanly', async () => {
    let first = await runCli(['serve', '--bg'], flightDir)
    expectCliSuccess(first, 'serve start')
    expect(first.stdout).toContain('Server running at')
    expect(await isServerRunning(TEST_PORT)).toBe(true)

    // running `serve` again should restart it
    let second = await runCli(['serve', '--bg'], flightDir)
    expectCliSuccess(second, 'serve restart')
    expect(second.stdout).toContain('Stopping server')
    expect(await isServerRunning(TEST_PORT)).toBe(true)

    let stop = await runCli(['stop'], flightDir)
    expectCliSuccess(stop, 'serve stop')
    expect(stop.stdout).toContain('Stopping server')
    expect(await isServerRunning(TEST_PORT)).toBe(false)
  })
})

describe('cli run', () => {
  it('runs a query against flights.duckdb (happy path)', async () => {
    let res = await runCli(['run', 'from flights select count() as total'], flightDir)
    expectCliSuccess(res, 'run query')
    expect(res.stdout.toLowerCase()).toContain('total')
  })

  it('shows an error when no .duckdb is present (error path)', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-cli-'))
    let input = ['table t (a int)', 'from t select a'].join('\n')
    let res = await runCli(['run', input], tmpDir)
    expect(res.code).toBe(1)
    expect(res.stderr.toLowerCase()).toContain('no .duckdb file found')
  })

  it('runs a named query from a markdown file', async () => {
    let res = await runCli(['run', 'index.md', '--query', 'weekly_trends'], flightDir)
    expectCliSuccess(res, 'run markdown query')
    expect(res.stdout.toLowerCase()).toContain('week')
  })

  it('rejects passing a gsql file path', async () => {
    let res = await runCli(['run', 'tables/flights.gsql'], flightDir)
    expect(res.code).toBe(1)
    expect((res.stdout + res.stderr).toLowerCase()).toContain('running .gsql files is no longer supported')
  })
})

describe('cli check', () => {
  it('checks a single gsql file', async () => {
    let res = await runCli(['check', 'tables/flights.gsql'], flightDir)
    expectCliSuccess(res, 'check gsql file')
    expect(res.stdout).toContain('No errors found')
  })
})
