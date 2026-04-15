import {type QueryConnection, type QueryResult, type QueryParams, type SchemaColumn} from './types.ts'

export interface ClickHouseOptions {
  url: string
  username: string
  password: string
  database?: string
}

type ClickHouseModule = typeof import('@clickhouse/client')
type ClickHouseClient = ReturnType<ClickHouseModule['createClient']>

export class ClickHouseConnection implements QueryConnection {
  private ready: Promise<void>
  private client!: ClickHouseClient
  private defaultDatabase: string

  constructor(options: ClickHouseOptions) {
    this.defaultDatabase = options.database || 'default'
    this.ready = this.initialize(options)
  }

  private async initialize(options: ClickHouseOptions) {
    let mod = await loadClickHouse()
    this.client = mod.createClient({
      url: options.url,
      username: options.username,
      password: options.password,
      database: this.defaultDatabase,
      application: 'Graphene',
    })
  }

  async runQuery(sql: string, _params?: QueryParams): Promise<QueryResult> {
    await this.ready
    let result = await this.client.query({query: sql, format: 'JSONEachRow'})
    let rows = (await result.json()) as Array<Record<string, unknown>>
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
    await this.ready
    await this.client.close()
  }
}

function escapeClickHouseString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

let clickhouseModule: ClickHouseModule | null = null

async function loadClickHouse(): Promise<ClickHouseModule> {
  clickhouseModule ||= await import('@clickhouse/client')
  return clickhouseModule
}
