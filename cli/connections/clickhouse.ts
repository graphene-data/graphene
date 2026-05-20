import {createClient, type ClickHouseClient} from '@clickhouse/client'

import {type QueryConnection, type QueryResult, type SchemaColumn, type QueryOptions} from './types.ts'

export interface ClickHouseOptions {
  url: string
  username: string
  password: string
  database?: string
  requestTimeout?: number
}

export class ClickHouseConnection implements QueryConnection {
  private client: ClickHouseClient
  private defaultDatabase: string

  constructor(options: ClickHouseOptions) {
    this.defaultDatabase = options.database || 'default'
    this.client = createClient({
      url: options.url,
      username: options.username,
      password: options.password,
      database: this.defaultDatabase,
      application: 'Graphene',
      request_timeout: options.requestTimeout,
    })
  }

  async runQuery(sql: string, options: QueryOptions = {}): Promise<QueryResult> {
    let useQueryCache = options.queryCache && options.queryCache != 'none'
    let result = await this.client.query({
      query: sql,
      format: 'JSONEachRow',
      ...(useQueryCache ? {clickhouse_settings: {use_query_cache: 1, query_cache_ttl: 86400}} : {}),
    })
    let rows = (await result.json()) as Array<Record<string, unknown>>
    return {rows, totalRows: rows.length, ...(useQueryCache ? {cache: {status: 'delegated' as const, provider: 'clickhouse' as const}} : {})}
  }

  queryCacheIdentity() {
    return {provider: 'clickhouse' as const, database: this.defaultDatabase}
  }

  async listDatasets(): Promise<string[]> {
    let res = await this.runQuery(`
      select name
      from system.databases
      where lower(name) not in ('system', 'information_schema')
      order by name
    `)
    return res.rows.map(row => String(row['name']).toLowerCase())
  }

  async listTables(database = this.defaultDatabase): Promise<string[]> {
    let sql = `
      select database, name
      from system.tables
      where lower(database) = lower('${escapeClickHouseString(database)}')
      order by name
    `.trim()
    let res = await this.runQuery(sql)
    return res.rows.map(row => `${String(row['database']).toLowerCase()}.${String(row['name']).toLowerCase()}`)
  }

  async describeTable(target: string): Promise<SchemaColumn[]> {
    let parts = target.split('.').filter(Boolean)
    let table = parts.pop() || ''
    let database = parts.join('.') || this.defaultDatabase
    let sql = `
      select name, type, position
      from system.columns
      where lower(database) = lower('${escapeClickHouseString(database)}')
        and lower(table) = lower('${escapeClickHouseString(table)}')
      order by position
    `.trim()
    let res = await this.runQuery(sql)
    return res.rows.map(row => ({name: String(row['name']).toLowerCase(), dataType: String(row['type'])}))
  }

  async close(): Promise<void> {
    await this.client.close()
  }
}

function escapeClickHouseString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
