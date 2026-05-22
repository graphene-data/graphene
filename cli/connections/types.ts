export interface QueryResult {
  rows: Array<Record<string, unknown>>
  totalRows?: number
  cacheRef?: WarehouseCacheRef
  nativeCache?: NativeQueryCache
}

export interface SchemaColumn {
  name: string
  dataType: string
}

export type QueryParams = unknown[] | Record<string, unknown>
export type QueryCacheMode = 'readwrite' | 'refresh' | 'none'

export interface QueryOptions {
  params?: QueryParams
  queryCache?: QueryCacheMode
}

export interface WarehouseCacheRef {
  provider: 'bigquery' | 'snowflake'
  ref: Record<string, unknown>
}

export interface NativeQueryCache {
  createdAt?: number
  expiresAt?: number
}

export interface QueryConnection {
  runQuery(sql: string, params?: QueryParams, options?: QueryOptions): Promise<QueryResult>
  listDatasets(): Promise<string[]>
  listSchemas?(dataset: string): Promise<string[]>
  listTables(dataset?: string): Promise<string[]>
  describeTable(table: string): Promise<SchemaColumn[]>
  close(): Promise<void>
}

export interface CacheableQueryConnection extends QueryConnection {
  cacheProvider: WarehouseCacheRef['provider']
  cacheContext(): string
  retrieveQueryResults(ref: Record<string, unknown>): Promise<QueryResult>
}
