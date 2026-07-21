/// <reference types="vitest/globals" />
import * as path from 'node:path'

import {loadConfig, normalizeConfig, type Config} from '../lang/config.ts'
import {formatType, parseWarehouseFieldType} from '../lang/types.ts'
import {expect, test} from './testFixtures.ts'

const dir = path.resolve(import.meta.url.replace('file://', ''), '../')
const flightDir = path.resolve(dir, '../examples/flights')
const snowflakeDir = path.resolve(dir, '../examples/snowflake')
const ecommDir = path.resolve(dir, '../examples/ecomm')
const clickhouseDir = path.resolve(dir, '../examples/clickhouse')
const postgresDir = path.resolve(dir, '../examples/postgres')
const athenaDir = path.resolve(dir, '../examples/athena')
const motherduckDir = path.resolve(dir, '../examples/motherduck')
let configs = new Map<string, Config>()
async function configFor(root: string) {
  if (!configs.has(root)) configs.set(root, await loadConfig(root, () => {}))
  return configs.get(root)!
}

function logCliFailure(step: string, res: {code: number; stdout: string; stderr: string}) {
  console.error(`[schema.test] ${step} failed (code ${res.code})\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`)
}

function expectCliSuccess(res: {code: number; stdout: string; stderr: string}, step: string) {
  if (res.code !== 0) logCliFailure(step, res)
  expect(res.code).toBe(0)
}

function parseSchemaOutput(stdout: string): string[] {
  return stdout
    .trim()
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.endsWith(':')) // filter out headers like "Datasets available:"
}

describe('duckdb', () => {
  test('uses DuckDB SQL semantics for MotherDuck config', () => {
    let cfg = normalizeConfig({motherduck: {database: 'sample_data'}, root: '/tmp/project'})
    expect(cfg.dialect).toBe('duckdb')
    expect(cfg.motherduck?.database).toBe('sample_data')
  })

  test('lists available tables when no argument is provided', async ({runCli}) => {
    let res = await runCli(['schema'], await configFor(flightDir))
    expectCliSuccess(res, 'schema list tables')
    let lines = res.stdout.trim().split(/\r?\n/).filter(Boolean)
    expect(lines.length).toBeGreaterThan(0)
    let normalized = lines.map(line => line.trim())
    expect(normalized.some(line => line === 'flights')).toBe(true)
  })

  test('describes the requested table columns', async ({runCli}) => {
    let res = await runCli(['schema', 'flights'], await configFor(flightDir))
    expectCliSuccess(res, 'schema describe table')
    let output = res.stdout.toLowerCase()
    expect(output).toContain('table flights (')
    expect(output).toContain('carrier varchar')
    expect(output.trim().endsWith(')')).toBe(true)
  })

  test('normalizes warehouse array types for schema output', () => {
    expect(formatType(parseWarehouseFieldType('VARCHAR[]').type)).toBe('array<string>')
    expect(formatType(parseWarehouseFieldType('INTEGER[]').type)).toBe('array<number>')
    expect(formatType(parseWarehouseFieldType('ARRAY<STRING>').type)).toBe('array<string>')
    expect(formatType(parseWarehouseFieldType('Nullable(Float64)').type)).toBe('number')
    expect(formatType(parseWarehouseFieldType('LowCardinality(String)').type)).toBe('string')
    expect(formatType(parseWarehouseFieldType("Enum8('CSH' = 1, 'CRE' = 2)").type)).toBe('string')
    expect(formatType(parseWarehouseFieldType('Array(String)').type)).toBe('array<string>')
  })
})

describe.skipIf(!process.env.SLOW_TEST)('motherduck', {timeout: 30_000}, () => {
  test('lists tables in the configured namespace', async ({runCli}) => {
    let res = await runCli(['schema'], await configFor(motherduckDir))
    expectCliSuccess(res, 'schema list tables (motherduck)')
    let tables = parseSchemaOutput(res.stdout)
    expect(tables).toContain('ambient_air_quality')
  })

  test('describes a table from the configured namespace', async ({runCli}) => {
    let res = await runCli(['schema', 'sample_data.who.ambient_air_quality'], await configFor(motherduckDir))
    expectCliSuccess(res, 'schema describe table (motherduck)')
    let output = res.stdout.toLowerCase()
    expect(output).toContain('table sample_data.who.ambient_air_quality (')
    expect(output).toContain('pm25_concentration double')
  })
})

describe.skipIf(!process.env.SLOW_TEST)('snowflake', () => {
  // Snowflake has a 3-level hierarchy: DATABASE.SCHEMA.TABLE
  // The example is configured with namespace "FOOD__BEVERAGE_ESTABLISHMENT__MENU_DATA.V02"

  test('lists available databases', async ({runCli}) => {
    let res = await runCli(['schema'], await configFor(snowflakeDir))
    expectCliSuccess(res, 'schema list databases (snowflake)')
    let databases = parseSchemaOutput(res.stdout)
    expect(databases.length).toBeGreaterThan(0)
  })

  test('lists schemas when given a database name', async ({runCli}) => {
    let res = await runCli(['schema', 'FOOD__BEVERAGE_ESTABLISHMENT__MENU_DATA'], await configFor(snowflakeDir))
    expectCliSuccess(res, 'schema list schemas (snowflake)')
    let schemas = parseSchemaOutput(res.stdout)
    expect(schemas.length).toBeGreaterThan(0)
    expect(schemas).toContain('v02')
  })

  test('lists tables in the configured namespace using case-insensitive input', async ({runCli}) => {
    let res = await runCli(['schema', 'food__beverage_establishment__menu_data.v02'], await configFor(snowflakeDir))
    expectCliSuccess(res, 'schema list tables (snowflake)')
    let tables = parseSchemaOutput(res.stdout)
    expect(tables.length).toBeGreaterThan(0)
    expect(tables.every(table => table == table.toLowerCase())).toBe(true)
  })

  test('describes a table from the namespace using case-insensitive input', async ({runCli}) => {
    let res = await runCli(['schema', 'food__beverage_establishment__menu_data.v02.menus'], await configFor(snowflakeDir))
    expectCliSuccess(res, 'schema describe table (snowflake)')
    let output = res.stdout.toLowerCase()
    expect(output).toContain('table food__beverage_establishment__menu_data.v02.menus (')
    expect(output).toContain('menu_id')
  })
})

describe.skipIf(!process.env.SLOW_TEST)('athena', {timeout: 30_000}, () => {
  test('lists available tables in the configured database', async ({runCli}) => {
    let res = await runCli(['schema', 'graphene_test'], await configFor(athenaDir))
    expectCliSuccess(res, 'schema list tables (athena)')
    let tables = parseSchemaOutput(res.stdout)
    expect(tables).toContain('graphene_test.flights')
  })

  test('describes an athena table from the configured database', async ({runCli}) => {
    let res = await runCli(['schema', 'flights'], await configFor(athenaDir))
    expectCliSuccess(res, 'schema describe table (athena)')
    let output = res.stdout.toLowerCase()
    expect(output).toContain('table flights (')
    expect(output).toContain('carrier varchar')
    expect(output).toContain('dep_delay int')
  })
})

describe.skipIf(!process.env.SLOW_TEST)('bigquery', () => {
  test('lists available tables in the configured namespace', async ({runCli}) => {
    let res = await runCli(['schema'], await configFor(ecommDir))
    expectCliSuccess(res, 'schema list tables (bigquery)')
    let lines = res.stdout.trim().split(/\r?\n/).filter(Boolean)
    expect(lines.length).toBeGreaterThan(0)
  })

  test('describes a table from the namespace', async ({runCli}) => {
    // First get a table name from the list
    let listRes = await runCli(['schema'], await configFor(ecommDir))
    expectCliSuccess(listRes, 'schema list for describe')
    let tables = parseSchemaOutput(listRes.stdout)
    if (tables.length === 0) throw new Error('No tables found in bigquery namespace')

    let tableName = tables[0]
    let res = await runCli(['schema', tableName], await configFor(ecommDir))
    expectCliSuccess(res, 'schema describe table (bigquery)')
    let output = res.stdout.toLowerCase()
    expect(output).toContain(`table ${tableName.toLowerCase()} (`)
  })
})

describe.skipIf(!process.env.SLOW_TEST)('postgres', () => {
  test('lists available tables in the configured schema', async ({runCli}) => {
    let res = await runCli(['schema'], await configFor(postgresDir))
    expectCliSuccess(res, 'schema list tables (postgres)')
    let tables = parseSchemaOutput(res.stdout)
    expect(tables).toContain('customers')
    expect(tables).toContain('orders')
    expect(tables).toContain('order_items')
  })

  test('describes a postgres table from the configured schema', async ({runCli}) => {
    let res = await runCli(['schema', 'orders'], await configFor(postgresDir))
    expectCliSuccess(res, 'schema describe table (postgres)')
    let output = res.stdout.toLowerCase()
    expect(output).toContain('table orders (')
    expect(output).toContain('order_date timestamp')
    expect(output).toContain('total numeric')
  })

  test('describes a postgres schema-qualified table', async ({runCli}) => {
    let res = await runCli(['schema', 'public.customers'], await configFor(postgresDir))
    expectCliSuccess(res, 'schema describe schema-qualified table (postgres)')
    let output = res.stdout.toLowerCase()
    expect(output).toContain('table public.customers (')
    expect(output).toContain('tags array<string>')
  })
})

// retry to work around clickhouse connection instability, see scripts/clickhouseRepoConnectError.js
// just disabled entirely because it still flakes
describe.skipIf(!process.env.SLOW_TEST || true)('clickhouse', {retry: 3, timeout: 20_000}, () => {
  test('lists available tables in the configured database', async ({runCli}) => {
    let res = await runCli(['schema'], await configFor(clickhouseDir))
    expectCliSuccess(res, 'schema list tables (clickhouse)')
    let tables = parseSchemaOutput(res.stdout)
    expect(tables).toContain('default.nyc_taxi')
  })

  test('describes a clickhouse table from the configured database', async ({runCli}) => {
    let res = await runCli(['schema', 'nyc_taxi'], await configFor(clickhouseDir))
    expectCliSuccess(res, 'schema describe table (clickhouse)')
    let output = res.stdout.toLowerCase()
    expect(output).toContain('table nyc_taxi (')
    expect(output).toContain('pickup_datetime datetime')
    expect(output).toContain('payment_type string')
  })
})
