import {createClient, type ClickHouseClient} from '@clickhouse/client'

import {type QueryConnection, type QueryResult, type QueryParams, type QueryOptions, type SchemaColumn} from './types.ts'

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

  async runQuery(sql: string, _params?: QueryParams, options?: QueryOptions): Promise<QueryResult> {
    let useNativeCache = !!options?.queryCache && options.queryCache != 'none'
    let result = await this.client.query({query: sql, format: 'JSONEachRow', clickhouse_settings: clickHouseCacheSettings(options)} as any)
    let rows = (await result.json()) as unknown as Array<Record<string, unknown>>
    return {rows, totalRows: rows.length, nativeCache: useNativeCache ? clickHouseCacheMetadata((result as any).response_headers) : undefined}
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

function clickHouseCacheSettings(options?: QueryOptions) {
  if (!options?.queryCache || options.queryCache == 'none') return undefined
  return {
    use_query_cache: 1,
    enable_reads_from_query_cache: options?.queryCache == 'refresh' ? 0 : 1,
    enable_writes_to_query_cache: 1,
  }
}

export function clickHouseCacheMetadata(headers?: Record<string, string | string[]>): QueryResult['nativeCache'] {
  if (!headers) return undefined
  let createdAt = numberHeader(headers, 'x-clickhouse-query-cache-created-at')
  let expiresAt = numberHeader(headers, 'x-clickhouse-query-cache-expires-at')
  if (createdAt || expiresAt) return {createdAt, expiresAt}
  return undefined
}

function numberHeader(headers: Record<string, string | string[]>, name: string) {
  let value = headers[name] || headers[name.toLowerCase()]
  let raw = Array.isArray(value) ? value[0] : value
  let numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : undefined
}
