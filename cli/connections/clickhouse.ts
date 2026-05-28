import {createClient, type ClickHouseClient} from '@clickhouse/client'

import {config} from '../../lang/config.ts'
import {type QueryConnection, type QueryResult, type QueryOptions, type SchemaColumn} from './types.ts'

export interface ClickHouseOptions {
  url: string
  username: string
  password: string
  database?: string
  requestTimeout?: number
}

export class ClickHouseConnection implements QueryConnection {
  protected client: ClickHouseClient
  protected defaultDatabase: string

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

  async runQuery(sql: string, _options?: QueryOptions): Promise<QueryResult> {
    let result = await this.client.query({query: sql, format: 'JSONEachRow'} as any)
    let rows = (await result.json()) as unknown as Array<Record<string, unknown>>
    return {rows, totalRows: rows.length}
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

export function localDbOptions(): ClickHouseOptions {
  let url = config.clickhouse?.url || process.env.CLICKHOUSE_URL
  let username = config.clickhouse?.username || process.env.CLICKHOUSE_USERNAME
  let password = process.env.CLICKHOUSE_PASSWORD
  if (!url || !username || !password) throw new Error('ClickHouse requires url and username in config or env, plus CLICKHOUSE_PASSWORD in env')
  return {
    url,
    username,
    password,
    database: config.clickhouse?.database || config.defaultNamespace || 'default',
    requestTimeout: config.clickhouse?.requestTimeout,
  }
}
