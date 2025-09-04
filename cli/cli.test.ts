/// <reference types="vitest/globals" />
import {spawn} from 'node:child_process'
import {expect} from 'vitest'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

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
    let child = spawn('node', [cliEntry, ...args], {cwd, env: process.env})
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('close', (code) => resolve({code: code ?? 0, stdout, stderr}))
  })
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

