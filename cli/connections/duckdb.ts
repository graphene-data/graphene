import {promises as fs} from 'fs'
import path from 'path'

import {config} from '../../lang/config.ts'
import {type QueryResult, type QueryConnection, type SchemaColumn, type QueryParams} from './types.ts'

interface DuckDbOptions {
  path?: string
}

type DuckDBModule = typeof import('@duckdb/node-api')
type InnerConnection = Awaited<ReturnType<InstanceType<DuckDBModule['DuckDBInstance']>['connect']>>

export class DuckDBConnection implements QueryConnection {
  options: DuckDbOptions
  ready: Promise<void>
  connection: InnerConnection | null = null
  module!: DuckDBModule

  constructor(options?: DuckDbOptions) {
    this.options = options || {}
    this.ready = this.initialize()
  }

  private async initialize() {
    this.module = await loadDuckDB()
    let dbPath = this.options.path || config.duckdb?.path
    if (!dbPath) {
      let files = await fs.readdir(config.root)
      dbPath = files.find(f => f.endsWith('.duckdb'))
      if (!dbPath) throw new Error('No .duckdb file found in current directory')
    }
    if (!path.isAbsolute(dbPath)) dbPath = path.resolve(config.root, dbPath)

    let db = await this.module.DuckDBInstance.create(':memory:')
    this.connection = await db.connect()
    let escapedPath = dbPath.replace(/'/g, "''")
    // Attach the project DuckDB file in read-only mode and make it the active schema
    await this.connection.run(`attach '${escapedPath}' as graphene_cli (READ_ONLY);`)
    await this.connection.run('use graphene_cli;')
  }

  async runQuery(sql: string, params?: QueryParams): Promise<QueryResult> {
    await this.ready
    let reader = params ? await this.connection!.runAndReadAll(sql, params as any) : await this.connection!.runAndReadAll(sql)
    let rows = reader.getRowObjects().map(record => {
      let out: Record<string, unknown> = {}
      for (let [k, v] of Object.entries(record)) {
        if (typeof v === 'bigint') out[k] = Number(v)
        else if (v === null) out[k] = null
        else if (v instanceof this.module.DuckDBTimestampValue) out[k] = new Date(Number(v.micros / 1000n)).toUTCString()
        else if (v instanceof this.module.DuckDBDateValue) out[k] = v.toString()
        else if (v instanceof this.module.DuckDBDecimalValue) out[k] = v.toDouble()
        else if (typeof v === 'object') throw new Error(`Unsupported datatype ${v.constructor?.name}`)
        else out[k] = v
      }
      return out
    })
    return {rows}
  }

  async listDatasets(): Promise<string[]> {
    return await Promise.resolve([])
  }

  async listTables(): Promise<string[]> {
    let sql = `
      select table_schema as table_schema, table_name as table_name
      from information_schema.tables
      where table_type in ('BASE TABLE', 'VIEW') and table_schema not in ('information_schema', 'pg_catalog')
      order by table_schema, table_name
    `.trim()
    let res = await this.runQuery(sql)
    return res.rows.map(row => String(row['table_name']).toLowerCase())
  }

  async describeTable(target: string): Promise<SchemaColumn[]> {
    let parts = target.split('.')
    let table = parts.pop() || ''
    let schema = parts[0]
    let schemaFilter = schema ? 'lower(table_schema) = lower($2)' : "table_schema not in ('information_schema', 'pg_catalog')"
    let sql = `
      select column_name as column_name, data_type as data_type, ordinal_position as ordinal_position
      from information_schema.columns
      where lower(table_name) = lower($1) and ${schemaFilter}
      order by ordinal_position
    `.trim()
    let params = schema ? [table, schema] : [table]
    let res = await this.runQuery(sql, params)
    return res.rows.map(row => {
      return {name: String(row['column_name']).toLowerCase(), dataType: String(row['data_type'])}
    })
  }

  async close(): Promise<void> {
    await this.ready
    this.connection?.closeSync()
  }
}

let duckdbModule: DuckDBModule | null = null

async function loadDuckDB(): Promise<DuckDBModule> {
  duckdbModule ||= await import('@duckdb/node-api')
  return duckdbModule
}
