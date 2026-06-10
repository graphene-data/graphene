import {config} from '../../lang/config.ts'
import {authenticatedFetch} from '../auth.ts'
import {type QueryResult, type QueryConnection, type QueryOptions} from './types.ts'

export async function getConnection(): Promise<QueryConnection> {
  if (config.dialect === 'bigquery') {
    let mod = await importConnection(() => import('./bigQuery.ts'), '@google-cloud/bigquery', 'BigQuery')
    let opts = await mod.localDbOptions()
    return new mod.BigQueryConnection(opts)
  } else if (config.dialect === 'duckdb') {
    let mod = await importConnection(() => import('./duckdb.ts'), '@duckdb/node-api', 'DuckDB')
    return new mod.DuckDBConnection(mod.localDbOptions())
  } else if (config.dialect === 'clickhouse') {
    let mod = await importConnection(() => import('./clickhouse.ts'), '@clickhouse/client', 'ClickHouse')
    return new mod.ClickHouseConnection(mod.localDbOptions())
  } else if (config.dialect === 'postgres') {
    let mod = await importConnection(() => import('./postgres.ts'), 'pg', 'Postgres')
    return new mod.PostgresConnection(await mod.localDbOptions())
  } else if (config.dialect === 'snowflake') {
    let mod = await importConnection(() => import('./snowflake.ts'), 'snowflake-sdk', 'Snowflake')
    return new mod.SnowflakeConnection(mod.localDbOptions())
  } else if (config.dialect === 'athena') {
    let mod = await importConnection(() => import('./athena.ts'), '@aws-sdk/client-athena', 'Athena')
    return new mod.AthenaConnection(mod.localDbOptions())
  } else {
    throw new Error(`Unsupported dialect: ${config.dialect}`)
  }
}

// Import connection, with a nice error message about what to do if a peer dep is missing.
async function importConnection<T>(load: () => Promise<T>, packageName: string, warehouseLabel: string): Promise<T> {
  try {
    return await load()
  } catch (err: any) {
    let depMissing = err.code == 'ERR_MODULE_NOT_FOUND' || (err.message || '').includes(packageName)
    if (depMissing) {
      throw new Error(`${warehouseLabel} support requires installing ${packageName}.\nAdd it to your project dependencies, for example:\nnpm install ${packageName}`, {cause: err})
    } else {
      throw err
    }
  }
}

interface RunQueryOptions extends QueryOptions {
  cacheControl?: string
}

export async function runQuery(sql: string, options: RunQueryOptions = {}): Promise<QueryResult> {
  let {cacheControl, params} = options

  if (config.host) {
    let headers: Record<string, string> = {'Content-Type': 'application/json'}
    if (cacheControl) headers['Cache-Control'] = cacheControl

    // A Cloud host path selects the repo to query, e.g. https://example.graphenedata.com/nba proxies through the `nba` repo connection.
    let repoId = new URL(config.host!).pathname.replace(/^\/+|\/+$/g, '')

    let resp = await authenticatedFetch('/_api/query', {
      method: 'POST',
      headers,
      body: JSON.stringify({sql, params, repoId}),
    })
    let json = await resp.json()
    if (!resp.ok) throw new Error(json.message || json.error || `Query failed with HTTP ${resp.status}`)
    if (!Array.isArray(json.rows)) throw new Error('Query response did not include rows')
    return json
  }

  let conn = await getConnection()
  try {
    return await conn.runQuery(sql, {params})
  } finally {
    await conn.close()
  }
}
