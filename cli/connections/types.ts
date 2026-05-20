export interface QueryResult {
  rows: Array<Record<string, unknown>>
  totalRows?: number
  queryCacheRef?: QueryCacheRef
  cache?: QueryCacheStatus
}

export interface SchemaColumn {
  name: string
  dataType: string
}

export type QueryParams = unknown[] | Record<string, unknown>

export type QueryCacheProvider = 'snowflake' | 'bigquery' | 'clickhouse'
export type QueryCacheStatus = {status: 'hit' | 'miss' | 'delegated'; provider?: QueryCacheProvider}
export type QueryCacheRef = {provider: QueryCacheProvider; [key: string]: unknown}

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
  cache?: boolean
  bypassCache?: boolean
}

export interface QueryConnection {
  runQuery(sql: string, options?: QueryOptions): Promise<QueryResult>
  queryCacheProvider?: QueryCacheProvider
  queryCacheIdentity?(): unknown
  runCachedQuery?(entry: QueryCacheEntry): Promise<QueryResult>
  listDatasets(): Promise<string[]>
  listSchemas?(dataset: string): Promise<string[]>
  listTables(dataset?: string): Promise<string[]>
  describeTable(table: string): Promise<SchemaColumn[]>
  close(): Promise<void>
}
