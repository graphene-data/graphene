import type * as ClickHouseTypes from '@clickhouse/client'
import type * as DuckDBTypes from '@duckdb/node-api'
import type * as BigQueryTypes from '@google-cloud/bigquery'
import type * as SnowflakeTypes from 'snowflake-sdk'

import {readFileSync} from 'fs'

import type * as BigQueryConnectionTypes from './bigQuery.ts'
import type * as ClickHouseConnectionTypes from './clickhouse.ts'
import type * as DuckDBConnectionTypes from './duckdb.ts'
import type * as SnowflakeConnectionTypes from './snowflake.ts'

import {config} from '../../lang/config.ts'
import {authenticatedFetch} from '../auth.ts'
import {type QueryResult, type QueryConnection, type QueryParams} from './types.ts'

const warehouseClients = {
  bigquery: '@google-cloud/bigquery',
  clickhouse: '@clickhouse/client',
  duckdb: '@duckdb/node-api',
  snowflake: 'snowflake-sdk',
} as const

type BigQueryConnectionModule = typeof BigQueryConnectionTypes
type ClickHouseConnectionModule = typeof ClickHouseConnectionTypes
type DuckDBConnectionModule = typeof DuckDBConnectionTypes
type SnowflakeConnectionModule = typeof SnowflakeConnectionTypes

type BigQueryModule = typeof BigQueryTypes
type ClickHouseModule = typeof ClickHouseTypes
type DuckDBModule = typeof DuckDBTypes
type SnowflakeModule = typeof SnowflakeTypes

let bigQueryResources: Promise<{connectionModule: BigQueryConnectionModule; clientModule: BigQueryModule}> | null = null
let clickHouseResources: Promise<{connectionModule: ClickHouseConnectionModule; clientModule: ClickHouseModule}> | null = null
let duckDBResources: Promise<{connectionModule: DuckDBConnectionModule; clientModule: DuckDBModule}> | null = null
let snowflakeResources: Promise<{connectionModule: SnowflakeConnectionModule; clientModule: SnowflakeModule}> | null = null

// Reads credentials from environment variables and passes them to the connection constructors.
// The connection classes themselves have no env-reading logic — this keeps the cloud server
// from accidentally picking up local env vars instead of database-stored credentials.
export async function getConnection(): Promise<QueryConnection> {
  if (config.dialect === 'bigquery') {
    let {connectionModule, clientModule} = await loadBigQueryResources()
    let options: any = {}
    if (process.env.GOOGLE_CREDENTIALS_CONTENT) {
      // the actual json as an env var
      let parsed = JSON.parse(process.env.GOOGLE_CREDENTIALS_CONTENT)
      options = {projectId: parsed.project_id, credentials: parsed}
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // env var is the path of a json cred file
      let parsed = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, {encoding: 'utf-8'}))
      options = {projectId: parsed.project_id}
    }
    return new connectionModule.BigQueryConnection(clientModule, options)
  } else if (config.dialect === 'duckdb') {
    let {connectionModule, clientModule} = await loadDuckDBResources()
    return new connectionModule.DuckDBConnection(clientModule, {})
  } else if (config.dialect === 'clickhouse') {
    let {connectionModule, clientModule} = await loadClickHouseResources()
    let url = config.clickhouse?.url || process.env.CLICKHOUSE_URL
    let username = config.clickhouse?.username || process.env.CLICKHOUSE_USERNAME
    let password = process.env.CLICKHOUSE_PASSWORD
    if (!url || !username || !password) throw new Error('ClickHouse requires url and username in config or env, plus CLICKHOUSE_PASSWORD in env')
    return new connectionModule.ClickHouseConnection(clientModule, {
      url,
      username,
      password,
      database: config.clickhouse?.database || config.defaultNamespace || 'default',
    })
  } else if (config.dialect === 'snowflake') {
    let {connectionModule, clientModule} = await loadSnowflakeResources()
    return new connectionModule.SnowflakeConnection(clientModule, {
      privateKeyPath: process.env.SNOWFLAKE_PRI_KEY_PATH,
      privateKey: process.env.SNOWFLAKE_PRI_KEY,
      privateKeyPass: process.env.SNOWFLAKE_PRI_PASSPHRASE,
      logLevel: process.env.SNOWFLAKE_LOG_LEVEL,
    })
  } else {
    throw new Error(`Unsupported dialect: ${config.dialect}`)
  }
}

// Cloud uses the same connection layer as the CLI, but all warehouse deps are required there.
// Preloading them at startup avoids request-time dynamic imports while still letting the CLI
// lazily load only the active dialect.
export async function preloadWarehouseConnections(): Promise<void> {
  await Promise.all([loadBigQueryResources(), loadDuckDBResources(), loadClickHouseResources(), loadSnowflakeResources()])
}

async function loadBigQueryResources() {
  bigQueryResources ||= Promise.all([import('./bigQuery.ts'), importWarehouseClient(() => import('@google-cloud/bigquery'), warehouseClients.bigquery, 'BigQuery')]).then(
    ([connectionModule, clientModule]) => ({connectionModule, clientModule}),
  )
  return await bigQueryResources
}

async function loadClickHouseResources() {
  clickHouseResources ||= Promise.all([import('./clickhouse.ts'), importWarehouseClient(() => import('@clickhouse/client'), warehouseClients.clickhouse, 'ClickHouse')]).then(
    ([connectionModule, clientModule]) => ({connectionModule, clientModule}),
  )
  return await clickHouseResources
}

async function loadDuckDBResources() {
  duckDBResources ||= Promise.all([import('./duckdb.ts'), importWarehouseClient(() => import('@duckdb/node-api'), warehouseClients.duckdb, 'DuckDB')]).then(([connectionModule, clientModule]) => ({
    connectionModule,
    clientModule,
  }))
  return await duckDBResources
}

async function loadSnowflakeResources() {
  snowflakeResources ||= Promise.all([
    import('./snowflake.ts'),
    importWarehouseClient(
      async () => {
        let mod = await import('snowflake-sdk')
        return ((mod as any).default || mod) as SnowflakeModule
      },
      warehouseClients.snowflake,
      'Snowflake',
    ),
  ]).then(([connectionModule, clientModule]) => ({connectionModule, clientModule}))
  return await snowflakeResources
}

async function importWarehouseClient<T>(load: () => Promise<T>, packageName: string, warehouseLabel: string): Promise<T> {
  try {
    return await load()
  } catch (err) {
    if (!isMissingWarehouseClientError(err, packageName)) throw err
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`${warehouseLabel} support requires installing ${packageName}. Add it to your project dependencies, for example: npm install ${packageName}`)
  }
}

function isMissingWarehouseClientError(err: unknown, packageName: string): boolean {
  let error = err as NodeJS.ErrnoException | undefined
  return error?.code === 'ERR_MODULE_NOT_FOUND' && String(error.message || '').includes(packageName)
}

export async function runQuery(sql: string, params?: QueryParams): Promise<QueryResult> {
  if (config.host) {
    let resp = await authenticatedFetch('/_api/query', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sql, params}),
    })
    return await resp.json()
  }

  let conn = await getConnection()
  try {
    return await conn.runQuery(sql, params)
  } finally {
    await conn.close()
  }
}
