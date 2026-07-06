import {DuckDBTimestampValue, DuckDBTimestampTZValue, DuckDBInstance, DuckDBDateValue, DuckDBDecimalValue, type DuckDBConnection as InnerConnection} from '@duckdb/node-api'
import {promises as fs} from 'fs'
import path from 'path'

import {config} from '../../lang/config.ts'
import {type QueryResult, type QueryConnection, type SchemaColumn, type QueryOptions} from './types.ts'

// DuckDB has two layers: an instance owns the database/catalog, and connections run queries against it.
// Local DuckDB attaches the project file once per instance; MotherDuck uses the instance as the remote session root.
export interface DuckDbOptions {
  path?: string
  instance?: DuckDBInstance
  motherduck?: {
    database?: string
    token: string
  }
}

export class DuckDBConnection implements QueryConnection {
  options: DuckDbOptions
  ready: Promise<void>
  connection: InnerConnection | null = null

  constructor(options?: DuckDbOptions) {
    let opts = options || {}
    this.options = opts
    this.ready = (async () => {
      if (!opts.instance) throw new Error('DuckDB connections require a DuckDB instance')

      this.connection = await opts.instance.connect()
      // Local DuckDB attaches the project file at the instance level, but the active catalog is per-connection.
      if (!opts.motherduck) await this.connection.run('use graphene_cli;')
    })()
  }

  /** Run a query and normalize DuckDB-specific values into JSON-friendly values. */
  async runQuery(sql: string, options?: QueryOptions): Promise<QueryResult> {
    await this.ready
    let params = options?.params
    let reader = params ? await this.connection!.runAndReadAll(sql, params as any) : await this.connection!.runAndReadAll(sql)
    let rows = reader.getRowObjects().map(record => {
      let out: Record<string, unknown> = {}
      for (let [k, v] of Object.entries(record)) {
        if (typeof v === 'bigint') out[k] = Number(v)
        else if (v === null) out[k] = null
        else if (v instanceof DuckDBTimestampValue || v instanceof DuckDBTimestampTZValue) out[k] = new Date(Number(v.micros / 1000n)).toISOString()
        else if (v instanceof DuckDBDateValue) out[k] = v.toString()
        else if (v instanceof DuckDBDecimalValue) out[k] = v.toDouble()
        else if (typeof v === 'object') throw new Error(`Unsupported datatype ${v.constructor?.name}`)
        else out[k] = v
      }
      return out
    })
    return {rows}
  }

  async listDatasets(): Promise<string[]> {
    if (!this.options.motherduck) return await Promise.resolve([])
    let sql = `
      select distinct table_catalog as table_catalog
      from information_schema.tables
      where table_schema not in ('information_schema', 'pg_catalog') and table_catalog != 'md_information_schema'
      order by table_catalog
    `.trim()
    let res = await this.runQuery(sql)
    return res.rows.map(row => String(row['table_catalog']).toLowerCase())
  }

  async listSchemas(dataset: string): Promise<string[]> {
    let sql = `
      select distinct table_schema as table_schema
      from information_schema.tables
      where lower(table_catalog) = lower($1) and table_schema not in ('information_schema', 'pg_catalog')
      order by table_schema
    `.trim()
    let res = await this.runQuery(sql, {params: [dataset]})
    return res.rows.map(row => String(row['table_schema']).toLowerCase())
  }

  async listTables(dataset?: string): Promise<string[]> {
    let parts = this.options.motherduck ? dataset?.split('.') || [] : []
    let catalog = parts[0]
    let schema = parts[1]
    let catalogFilter = catalog ? 'and lower(table_catalog) = lower($1)' : ''
    let schemaFilter = schema ? 'and lower(table_schema) = lower($2)' : ''
    let sql = `
      select table_schema as table_schema, table_name as table_name
      from information_schema.tables
      where table_type in ('BASE TABLE', 'VIEW') and table_schema not in ('information_schema', 'pg_catalog') ${catalogFilter} ${schemaFilter}
      order by table_schema, table_name
    `.trim()
    let params = [catalog, schema].filter(Boolean)
    let res = await this.runQuery(sql, params.length ? {params} : undefined)
    return res.rows.map(row => {
      let rowSchema = String(row['table_schema']).toLowerCase()
      let name = String(row['table_name']).toLowerCase()
      return this.options.motherduck && !schema && rowSchema != 'main' ? `${rowSchema}.${name}` : name
    })
  }

  async describeTable(target: string): Promise<SchemaColumn[]> {
    let parts = target.split('.')
    let table = parts.pop() || ''
    let schema = parts.pop()
    let catalog = parts.pop()
    if (catalog && !this.options.motherduck) schema = catalog
    let schemaFilter = schema ? 'lower(table_schema) = lower($2)' : "table_schema not in ('information_schema', 'pg_catalog')"
    let catalogFilter = catalog ? 'and lower(table_catalog) = lower($3)' : ''
    let sql = `
      select column_name as column_name, data_type as data_type, ordinal_position as ordinal_position
      from information_schema.columns
      where lower(table_name) = lower($1) and ${schemaFilter} ${catalogFilter}
      order by ordinal_position
    `.trim()
    let params = [table, schema, catalog].filter(Boolean)
    let res = await this.runQuery(sql, {params})
    return res.rows.map(row => {
      return {name: String(row['column_name']).toLowerCase(), dataType: String(row['data_type'])}
    })
  }

  async close(): Promise<void> {
    await this.ready
    this.connection?.closeSync()
  }
}

/** Build DuckDB options from the global Graphene config and env vars. */
export function localDbOptions(): DuckDbOptions {
  if (config.motherduck) {
    let token = process.env.MOTHERDUCK_TOKEN
    if (!token) throw new Error('MotherDuck requires MOTHERDUCK_TOKEN.')
    return {motherduck: {...config.motherduck, token}}
  }
  return {...config.duckdb}
}

/** Create the shared DuckDB instance that one or more DuckDBConnections can connect to. */
export async function createInstance(options: DuckDbOptions = {}) {
  if (options.motherduck) {
    let database = options.motherduck.database || ''
    return await DuckDBInstance.create(`md:${database}`, {motherduck_token: options.motherduck.token, custom_user_agent: 'graphene'})
  }

  let dbPath = options.path || config.duckdb?.path
  if (!dbPath) {
    let files = await fs.readdir(config.root)
    dbPath = files.find(f => f.endsWith('.duckdb'))
    if (!dbPath) throw new Error('No .duckdb file found in current directory')
  }
  if (!path.isAbsolute(dbPath)) dbPath = path.resolve(config.root, dbPath)

  // Attach the project DuckDB file once per instance. Each connection still needs `use graphene_cli` for unqualified table names.
  let instance = await DuckDBInstance.create(':memory:')
  let connection = await instance.connect()
  let escapedPath = dbPath.replace(/'/g, "''")
  await connection.run(`attach '${escapedPath}' as graphene_cli (READ_ONLY);`)
  connection.closeSync()
  return instance
}
