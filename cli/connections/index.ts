import {readFileSync} from 'fs'

import {config} from '../../lang/config.ts'
import {authenticatedFetch} from '../auth.ts'
import {type QueryResult, type QueryConnection, type QueryParams} from './types.ts'

const warehouseClients = {
  bigquery: '@google-cloud/bigquery',
  clickhouse: '@clickhouse/client',
  duckdb: '@duckdb/node-api',
  snowflake: 'snowflake-sdk',
} as const

// Reads credentials from environment variables and passes them to the connection constructors.
// The connection classes themselves have no env-reading logic — this keeps the cloud server
// from accidentally picking up local env vars instead of database-stored credentials.
export async function getConnection(): Promise<QueryConnection> {
  if (config.dialect === 'bigquery') {
    let mod = await importWarehouseConnection(() => import('./bigQuery.ts'), warehouseClients.bigquery, 'BigQuery')
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
    return new mod.BigQueryConnection(options)
  } else if (config.dialect === 'duckdb') {
    let mod = await importWarehouseConnection(() => import('./duckdb.ts'), warehouseClients.duckdb, 'DuckDB')
    return new mod.DuckDBConnection({})
  } else if (config.dialect === 'clickhouse') {
    let mod = await importWarehouseConnection(() => import('./clickhouse.ts'), warehouseClients.clickhouse, 'ClickHouse')
    let url = config.clickhouse?.url || process.env.CLICKHOUSE_URL
    let username = config.clickhouse?.username || process.env.CLICKHOUSE_USERNAME
    let password = process.env.CLICKHOUSE_PASSWORD
    if (!url || !username || !password) throw new Error('ClickHouse requires url and username in config or env, plus CLICKHOUSE_PASSWORD in env')
    return new mod.ClickHouseConnection({
      url,
      username,
      password,
      database: config.clickhouse?.database || config.defaultNamespace || 'default',
    })
  } else if (config.dialect === 'snowflake') {
    let mod = await importWarehouseConnection(() => import('./snowflake.ts'), warehouseClients.snowflake, 'Snowflake')
    return new mod.SnowflakeConnection({
      privateKeyPath: process.env.SNOWFLAKE_PRI_KEY_PATH,
      privateKey: process.env.SNOWFLAKE_PRI_KEY,
      privateKeyPass: process.env.SNOWFLAKE_PRI_PASSPHRASE,
      logLevel: process.env.SNOWFLAKE_LOG_LEVEL,
    })
  } else {
    throw new Error(`Unsupported dialect: ${config.dialect}`)
  }
}

async function importWarehouseConnection<T>(load: () => Promise<T>, packageName: string, warehouseLabel: string): Promise<T> {
  try {
    return await load()
  } catch (err) {
    if (!isMissingWarehouseClientError(err, packageName)) throw err
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
