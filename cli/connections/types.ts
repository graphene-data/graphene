export interface QueryResult {
  rows: Array<Record<string, unknown>>
  totalRows?: number
  cache?: QueryCacheStatus
}

export interface SchemaColumn {
  name: string
  dataType: string
}

export type QueryParams = unknown[] | Record<string, unknown>

export type QueryCacheProvider = 'snowflake' | 'bigquery' | 'clickhouse'
export type QueryCacheRef = {provider: QueryCacheProvider; [key: string]: unknown}
export type QueryCacheStatus = {provider?: QueryCacheProvider; createdAt?: number; expiresAt?: number; ref?: QueryCacheRef}
export type QueryCacheIdentity = QueryCacheRef
export type QueryCacheMode = 'read-write' | 'refresh' | 'none'

export interface QueryCacheEntry {
  key: string
  provider: QueryCacheProvider
  contextHash: string
  createdAt: number
  expiresAt: number
  ref: QueryCacheRef
}

export interface QueryOptions {
  params?: QueryParams
  queryCache?: QueryCacheMode
}

export interface QueryConnection {
  runQuery(sql: string, options?: QueryOptions): Promise<QueryResult>
  retrieveCachedQuery?(entry: QueryCacheEntry): Promise<QueryResult>
  queryCacheIdentity?(): QueryCacheIdentity
  listDatasets(): Promise<string[]>
  listSchemas?(dataset: string): Promise<string[]>
  listTables(dataset?: string): Promise<string[]>
  describeTable(table: string): Promise<SchemaColumn[]>
  close(): Promise<void>
}
