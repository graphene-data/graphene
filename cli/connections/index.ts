import {readFileSync} from 'fs'
import {readFile} from 'fs/promises'
import {createRequire} from 'module'
import * as net from 'net'
import path from 'path'

import {config} from '../../lang/config.ts'
import {authenticatedFetch} from '../auth.ts'
import {type QueryResult, type QueryConnection, type QueryOptions} from './types.ts'

// Reads credentials from environment variables and passes them to the connection constructors.
// The connection classes themselves have no env-reading logic — this keeps the cloud server
// from accidentally picking up local env vars instead of database-stored credentials.
export async function getConnection(): Promise<QueryConnection> {
  if (config.dialect === 'bigquery') {
    let mod = await importConnection(() => import('./bigQuery.ts'), '@google-cloud/bigquery', 'BigQuery')
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
    let mod = await importConnection(() => import('./duckdb.ts'), '@duckdb/node-api', 'DuckDB')
    return new mod.DuckDBConnection({})
  } else if (config.dialect === 'clickhouse') {
    let mod = await importConnection(() => import('./clickhouse.ts'), '@clickhouse/client', 'ClickHouse')
    let url = config.clickhouse?.url || process.env.CLICKHOUSE_URL
    let username = config.clickhouse?.username || process.env.CLICKHOUSE_USERNAME
    let password = process.env.CLICKHOUSE_PASSWORD
    if (!url || !username || !password) throw new Error('ClickHouse requires url and username in config or env, plus CLICKHOUSE_PASSWORD in env')
    return new mod.ClickHouseConnection({
      url,
      username,
      password,
      database: config.clickhouse?.database || config.defaultNamespace || 'default',
      requestTimeout: config.clickhouse?.requestTimeout,
    })
  } else if (config.dialect === 'postgres') {
    let mod = await importConnection(() => import('./postgres.ts'), 'pg', 'Postgres')
    if (config.postgres?.inMemory) return new mod.PostgresConnection(await inMemoryPostgresOptions())

    let connectionString = config.postgres?.connectionString || process.env.POSTGRES_URL || process.env.DATABASE_URL
    let host = config.postgres?.host || process.env.PGHOST || process.env.POSTGRES_HOST
    let database = config.postgres?.database || process.env.PGDATABASE || process.env.POSTGRES_DATABASE
    let user = config.postgres?.user || config.postgres?.username || process.env.PGUSER || process.env.POSTGRES_USER
    let password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD
    if (!connectionString && (!host || !database || !user)) throw new Error('Postgres requires connectionString/POSTGRES_URL/DATABASE_URL or host, database, and user in config or env')
    return new mod.PostgresConnection({
      ...config.postgres,
      connectionString,
      host,
      database,
      user,
      password,
      schema: config.postgres?.schema || config.defaultNamespace,
      port: config.postgres?.port || Number(process.env.PGPORT || process.env.POSTGRES_PORT) || undefined,
    })
  } else if (config.dialect === 'snowflake') {
    let mod = await importConnection(() => import('./snowflake.ts'), 'snowflake-sdk', 'Snowflake')
    return new mod.SnowflakeConnection({
      privateKeyPath: process.env.SNOWFLAKE_PRI_KEY_PATH,
      privateKey: process.env.SNOWFLAKE_PRI_KEY,
      privateKeyPass: process.env.SNOWFLAKE_PRI_PASSPHRASE,
      logLevel: process.env.SNOWFLAKE_LOG_LEVEL,
    })
  } else if (config.dialect === 'athena') {
    let mod = await importConnection(() => import('./athena.ts'), '@aws-sdk/client-athena', 'Athena')
    return new mod.AthenaConnection({
      ...config.athena,
      region: config.athena?.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
      database: config.athena?.database || config.defaultNamespace,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    })
  } else {
    throw new Error(`Unsupported dialect: ${config.dialect}`)
  }
}

async function inMemoryPostgresOptions() {
  let [{PGlite}, {PGLiteSocketServer}] = await Promise.all([
    importProjectDependency('@electric-sql/pglite', 'in-memory Postgres support'),
    importProjectDependency('@electric-sql/pglite-socket', 'in-memory Postgres support'),
  ])
  let host = '127.0.0.1'
  let port = await getAvailablePort(host)
  let db = await PGlite.create({dataDir: 'memory://', database: 'postgres', username: 'postgres'})
  let server = new PGLiteSocketServer({db, host, port})
  let started = false

  try {
    if (config.postgres?.seedSql) {
      let seedPath = path.resolve(config.root, config.postgres.seedSql)
      await db.exec(await readFile(seedPath, 'utf8'))
    }
    await server.start()
    started = true
  } catch (err) {
    if (started) await server.stop()
    await db.close()
    throw err
  }

  return {
    ...config.postgres,
    host,
    port,
    database: 'postgres',
    user: 'postgres',
    ssl: false,
    max: 1,
    onClose: async () => {
      try {
        await server.stop()
      } finally {
        await db.close()
      }
    },
  }
}

async function importProjectDependency(packageName: string, label: string): Promise<any> {
  try {
    let require = createRequire(path.join(config.root, 'package.json'))
    return await import(require.resolve(packageName))
  } catch (err: any) {
    let depMissing = err.code == 'MODULE_NOT_FOUND' || err.code == 'ERR_MODULE_NOT_FOUND' || (err.message || '').includes(packageName)
    if (depMissing) {
      throw new Error(`${label} requires installing ${packageName}.\nAdd it to your project dependencies, for example:\nnpm install ${packageName}`, {cause: err})
    }
    throw err
  }
}

async function getAvailablePort(host: string): Promise<number> {
  return await new Promise((resolve, reject) => {
    let srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, host, () => {
      let address = srv.address()
      if (!address || typeof address == 'string') return reject(new Error('Failed to find an available port'))
      srv.close(() => resolve(address.port))
    })
  })
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

    let resp = await authenticatedFetch('/_api/query', {
      method: 'POST',
      headers,
      body: JSON.stringify({sql, params}),
    })
    let json = await resp.json()
    if (!resp.ok) throw new Error(json.message || json.error || `Query failed with HTTP ${resp.status}`)
    if (!Array.isArray(json.rows)) throw new Error('Query response did not include rows')
    return json
  }

  let conn = await getConnection()
  try {
    return await conn.runQuery(sql, params === undefined ? undefined : {params})
  } finally {
    await conn.close()
  }
}
