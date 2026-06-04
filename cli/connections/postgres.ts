import {readFile} from 'fs/promises'
import {createRequire} from 'module'
import * as net from 'net'
import path from 'path'
import pg, {type FieldDef, type PoolConfig, type QueryResult as PgQueryResult} from 'pg'

import {config} from '../../lang/config.ts'
import {type QueryConnection, type QueryOptions, type QueryParams, type QueryResult, type SchemaColumn} from './types.ts'

export interface PostgresOptions {
  connectionString?: string
  host?: string
  port?: number
  database?: string
  user?: string
  username?: string
  password?: string
  schema?: string
  ssl?: PoolConfig['ssl']
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
  queryTimeout?: number
  statementTimeout?: number
  pool?: PostgresPool
  onClose?: () => Promise<void>
}

interface PostgresPool {
  query(sql: string, params?: unknown[]): Promise<PgQueryResult>
  end(): Promise<void>
}

const NUMERIC_OIDS = new Set([20, 21, 23, 26, 700, 701, 1700])
const DATE_OID = 1082
const TIMESTAMP_OIDS = new Set([1114, 1184])
const {Pool} = pg

export class PostgresConnection implements QueryConnection {
  private pool: PostgresPool
  private defaultSchema: string
  private onClose?: () => Promise<void>

  constructor(options: PostgresOptions = {}) {
    this.defaultSchema = options.schema || config.postgres?.schema || config.defaultNamespace || 'public'
    this.onClose = options.onClose
    this.pool =
      options.pool ||
      new Pool({
        connectionString: options.connectionString,
        host: options.host,
        port: options.port,
        database: options.database,
        user: options.user || options.username,
        password: options.password,
        ssl: options.ssl,
        max: options.max,
        idleTimeoutMillis: options.idleTimeoutMillis,
        connectionTimeoutMillis: options.connectionTimeoutMillis,
        query_timeout: options.queryTimeout ?? 120_000,
        statement_timeout: options.statementTimeout ?? 120_000,
        application_name: 'Graphene',
      })
  }

  async runQuery(sql: string, options?: QueryOptions): Promise<QueryResult> {
    let [preparedSql, preparedParams] = preparePostgresParams(sql, options?.params)
    let result = await this.pool.query(preparedSql, preparedParams)
    let rows = result.rows.map(row => normalizeRow(row, result.fields))
    return {rows, totalRows: result.rowCount ?? rows.length}
  }

  async listDatasets(): Promise<string[]> {
    let res = await this.runQuery(`
      select schema_name
      from information_schema.schemata
      where schema_name not in ('information_schema', 'pg_catalog')
        and schema_name not like 'pg_toast%'
        and schema_name not like 'pg_temp%'
      order by schema_name
    `)
    return res.rows.map(row => String(row['schema_name']).toLowerCase())
  }

  async listTables(schema = this.defaultSchema): Promise<string[]> {
    let sql = `
      select table_name
      from information_schema.tables
      where lower(table_schema) = lower($1)
        and table_type in ('BASE TABLE', 'VIEW')
      order by table_name
    `.trim()
    let res = await this.runQuery(sql, {params: [schema]})
    return res.rows.map(row => String(row['table_name']).toLowerCase())
  }

  async describeTable(target: string): Promise<SchemaColumn[]> {
    let parts = target.split('.').filter(Boolean)
    let table = parts.pop() || ''
    let schema = parts.join('.') || this.defaultSchema
    let sql = `
      select column_name, data_type, udt_name, ordinal_position
      from information_schema.columns
      where lower(table_schema) = lower($1)
        and lower(table_name) = lower($2)
      order by ordinal_position
    `.trim()
    let res = await this.runQuery(sql, {params: [schema, table]})
    return res.rows.map(row => ({name: String(row['column_name']).toLowerCase(), dataType: postgresDisplayType(row)}))
  }

  async close(): Promise<void> {
    try {
      await this.pool.end()
    } finally {
      await this.onClose?.()
    }
  }
}

function preparePostgresParams(sql: string, params?: QueryParams): [string, unknown[] | undefined] {
  if (!params) return [sql, undefined]
  if (Array.isArray(params)) return [sql, params]

  let values: unknown[] = []
  let indexes = new Map<string, number>()
  let inString = false
  let out = ''

  for (let i = 0; i < sql.length; i++) {
    let ch = sql[i]
    if (ch == "'") {
      out += ch
      if (inString && sql[i + 1] == "'") {
        out += sql[++i]
        continue
      }
      inString = !inString
      continue
    }

    let match = !inString && ch == '$' ? sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)/) : null
    if (!match) {
      out += ch
      continue
    }

    let name = match[1]
    if (!(name in params)) throw new Error(`Missing param $${name}`)
    if (!indexes.has(name)) {
      values.push(params[name])
      indexes.set(name, values.length)
    }
    out += `$${indexes.get(name)}`
    i += name.length
  }

  return [out, values]
}

function normalizeRow(row: Record<string, unknown>, fields: FieldDef[]): Record<string, unknown> {
  let out: Record<string, unknown> = {}
  for (let [key, value] of Object.entries(row)) {
    let field = fields.find(f => f.name == key)
    out[key] = normalizeValue(value, field?.dataTypeID)
  }
  return out
}

function normalizeValue(value: unknown, oid?: number): unknown {
  if (value === null) return null
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && oid && NUMERIC_OIDS.has(oid) && value !== '') return Number(value)
  if (value instanceof Date && oid == DATE_OID) return value.toISOString().slice(0, 10)
  if (value instanceof Date && oid && TIMESTAMP_OIDS.has(oid)) return value.toISOString()
  if (Array.isArray(value)) return value.map(item => normalizeValue(item))
  return value
}

function postgresDisplayType(row: Record<string, unknown>) {
  let dataType = String(row['data_type'])
  let udtName = String(row['udt_name'] || '')
  let udtAliases: Record<string, string> = {int2: 'smallint', int4: 'integer', int8: 'bigint', float4: 'real', float8: 'double precision', bool: 'boolean', varchar: 'character varying'}
  if (dataType == 'ARRAY' && udtName.startsWith('_')) return `${udtAliases[udtName.slice(1)] || udtName.slice(1)}[]`
  if (dataType == 'timestamp without time zone' || dataType == 'timestamp with time zone') return 'timestamp'
  if (dataType == 'USER-DEFINED' && udtName) return udtName
  return dataType
}

export async function localDbOptions(): Promise<PostgresOptions> {
  if (config.postgres?.inMemory) return await inMemoryPostgresOptions()

  let connectionString = config.postgres?.connectionString || process.env.POSTGRES_URL || process.env.DATABASE_URL
  let host = config.postgres?.host || process.env.PGHOST || process.env.POSTGRES_HOST
  let database = config.postgres?.database || process.env.PGDATABASE || process.env.POSTGRES_DATABASE
  let user = config.postgres?.user || config.postgres?.username || process.env.PGUSER || process.env.POSTGRES_USER
  let password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD
  if (!connectionString && (!host || !database || !user)) throw new Error('Postgres requires connectionString/POSTGRES_URL/DATABASE_URL or host, database, and user in config or env')
  return {
    ...config.postgres,
    connectionString,
    host,
    database,
    user,
    password,
    schema: config.postgres?.schema || config.defaultNamespace,
    port: config.postgres?.port || Number(process.env.PGPORT || process.env.POSTGRES_PORT) || undefined,
  }
}

async function inMemoryPostgresOptions(): Promise<PostgresOptions> {
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
