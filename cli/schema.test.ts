/// <reference types="vitest/globals" />
import {spawn} from 'node:child_process'
import {expect} from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

const dir = path.resolve(import.meta.url.replace('file://', ''), '../')
const flightDir = path.resolve(dir, '../examples/flights')
const snowflakeDir = path.resolve(dir, '../examples/snowflake')
const ecommDir = path.resolve(dir, '../examples/ecomm')

const hasSnowflakeAuth = !!process.env.SNOWFLAKE_PRI_KEY_PATH || !!process.env.SNOWFLAKE_PRI_KEY
const hasBigQueryAuth = !!process.env.GOOGLE_APPLICATION_CREDENTIALS || !!process.env.GOOGLE_CREDENTIALS_CONTENT

function ensureFlightsDatabaseExists () {
  let dbPath = path.resolve(flightDir, 'flights.duckdb')
  if (!fs.existsSync(dbPath)) throw new Error('flights.duckdb not found. Run `pnpm run setup` in examples/flights')
}

function runCli (args: string[], cwd?: string): Promise<RunResult> {
  return new Promise((resolve) => {
    let cliEntry = path.resolve(dir, 'cli.ts')
    let child = spawn('node', [cliEntry, ...args], {cwd, env: process.env})
    let stdout = '', stderr = ''
    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('close', (code) => resolve({code: code ?? 0, stdout, stderr}))
  })
}

function logCliFailure (step: string, res: RunResult) {
  console.error(`[schema.test] ${step} failed (code ${res.code})\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`)
}

function expectCliSuccess (res: RunResult, step: string) {
  if (res.code !== 0) logCliFailure(step, res)
  expect(res.code).toBe(0)
}

function parseSchemaOutput (stdout: string): string[] {
  return stdout.trim().split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.endsWith(':')) // filter out headers like "Datasets available:"
}

describe('duckdb', () => {
  beforeAll(ensureFlightsDatabaseExists)

  it('lists available tables when no argument is provided', async () => {
    let res = await runCli(['schema'], flightDir)
    expectCliSuccess(res, 'schema list tables')
    let lines = res.stdout.trim().split(/\r?\n/).filter(Boolean)
    expect(lines.length).toBeGreaterThan(0)
    let normalized = lines.map(line => line.trim())
    expect(normalized.some(line => line === 'flights')).toBe(true)
  })

  it('describes the requested table columns', async () => {
    let res = await runCli(['schema', 'flights'], flightDir)
    expectCliSuccess(res, 'schema describe table')
    let output = res.stdout.toLowerCase()
    expect(output).toContain('table flights (')
    expect(output).toContain('carrier varchar')
    expect(output.trim().endsWith(')')).toBe(true)
  })
})

describe.skipIf(!hasSnowflakeAuth)('snowflake', () => {
  if (!hasSnowflakeAuth) {
    console.warn('⚠️  Skipping Snowflake schema tests: SNOWFLAKE_PRI_KEY_PATH not set')
  }

  // Snowflake has a 3-level hierarchy: DATABASE.SCHEMA.TABLE
  // The example is configured with namespace "FOOD__BEVERAGE_ESTABLISHMENT__MENU_DATA.V02"

  it('lists available databases', async () => {
    let res = await runCli(['schema'], snowflakeDir)
    expectCliSuccess(res, 'schema list databases (snowflake)')
    let databases = parseSchemaOutput(res.stdout)
    expect(databases.length).toBeGreaterThan(0)
  })

  it('lists schemas when given a database name', async () => {
    let res = await runCli(['schema', 'FOOD__BEVERAGE_ESTABLISHMENT__MENU_DATA'], snowflakeDir)
    expectCliSuccess(res, 'schema list schemas (snowflake)')
    let schemas = parseSchemaOutput(res.stdout)
    expect(schemas.length).toBeGreaterThan(0)
    expect(schemas).toContain('V02')
  })

  it('lists tables in the configured namespace', async () => {
    let res = await runCli(['schema', 'FOOD__BEVERAGE_ESTABLISHMENT__MENU_DATA.V02'], snowflakeDir)
    expectCliSuccess(res, 'schema list tables (snowflake)')
    let tables = parseSchemaOutput(res.stdout)
    expect(tables.length).toBeGreaterThan(0)
  })

  it('describes a table from the namespace', async () => {
    let res = await runCli(['schema', 'FOOD__BEVERAGE_ESTABLISHMENT__MENU_DATA.V02.MENUS'], snowflakeDir)
    expectCliSuccess(res, 'schema describe table (snowflake)')
    let output = res.stdout.toLowerCase()
    expect(output).toContain('table food__beverage_establishment__menu_data.v02.menus (')
    expect(output).toContain('menu_id')
  })
})

describe.skipIf(!hasBigQueryAuth)('bigquery', () => {
  if (!hasBigQueryAuth) {
    console.warn('⚠️  Skipping BigQuery schema tests: GOOGLE_APPLICATION_CREDENTIALS not set')
  }

  it('lists available tables in the configured namespace', async () => {
    let res = await runCli(['schema'], ecommDir)
    expectCliSuccess(res, 'schema list tables (bigquery)')
    let lines = res.stdout.trim().split(/\r?\n/).filter(Boolean)
    expect(lines.length).toBeGreaterThan(0)
  })

  it('describes a table from the namespace', async () => {
    // First get a table name from the list
    let listRes = await runCli(['schema'], ecommDir)
    expectCliSuccess(listRes, 'schema list for describe')
    let tables = parseSchemaOutput(listRes.stdout)
    if (tables.length === 0) throw new Error('No tables found in bigquery namespace')

    let tableName = tables[0]
    let res = await runCli(['schema', tableName], ecommDir)
    expectCliSuccess(res, 'schema describe table (bigquery)')
    let output = res.stdout.toLowerCase()
    expect(output).toContain('table ')
    expect(output).toContain('(')
  })
})
