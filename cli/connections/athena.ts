import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  GetTableMetadataCommand,
  ListDatabasesCommand,
  ListTableMetadataCommand,
  StartQueryExecutionCommand,
} from '@aws-sdk/client-athena'

import {type QueryConnection, type QueryOptions, type QueryParams, type QueryResult, type SchemaColumn} from './types.ts'

export interface AthenaOptions {
  region?: string
  catalog?: string
  database?: string
  workGroup?: string
  outputLocation?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
}

// Athena is serverless SQL over external data, usually S3 files registered in Glue.
// Query execution is asynchronous: StartQueryExecution writes results to S3, then
// GetQueryResults pages those materialized rows back through the Athena API.
export class AthenaConnection implements QueryConnection {
  private client: AthenaClient
  private catalog: string
  private database?: string
  private workGroup?: string
  private outputLocation?: string

  constructor(opts: AthenaOptions = {}) {
    if (!opts.region) throw new Error('Athena requires a region in config or AWS_REGION')

    let clientConfig: any = {region: opts.region}
    if (opts.accessKeyId && opts.secretAccessKey) clientConfig.credentials = {accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey, sessionToken: opts.sessionToken}

    this.client = new AthenaClient(clientConfig)
    this.catalog = opts.catalog || 'AwsDataCatalog'
    this.database = opts.database
    this.workGroup = opts.workGroup
    this.outputLocation = opts.outputLocation
  }

  async runQuery(sql: string, options?: QueryOptions): Promise<QueryResult> {
    let queryExecutionId = await this.startQuery(sql, options?.params)
    await this.waitForQuery(queryExecutionId)
    return await this.fetchResults(queryExecutionId)
  }

  async listDatasets(): Promise<string[]> {
    let databases: string[] = []
    let nextToken: string | undefined
    while (true) {
      let res = await this.client.send(new ListDatabasesCommand({CatalogName: this.catalog, NextToken: nextToken}))
      databases.push(...(res.DatabaseList || []).map(db => String(db.Name).toLowerCase()))
      if (!res.NextToken) return databases
      nextToken = res.NextToken
    }
  }

  async listTables(database = this.database): Promise<string[]> {
    if (!database) throw new Error('Athena requires a database')
    let resolvedDatabase = await this.resolveDatabaseName(database)
    let tables: string[] = []
    let nextToken: string | undefined
    while (true) {
      let res = await this.client.send(new ListTableMetadataCommand({CatalogName: this.catalog, DatabaseName: resolvedDatabase, NextToken: nextToken}))
      let validTypes = new Set(['EXTERNAL_TABLE', 'VIRTUAL_VIEW'])
      tables.push(...(res.TableMetadataList || []).filter(t => validTypes.has(String(t.TableType))).map(t => `${resolvedDatabase}.${String(t.Name).toLowerCase()}`))
      if (!res.NextToken) return tables
      nextToken = res.NextToken
    }
  }

  async describeTable(target: string): Promise<SchemaColumn[]> {
    let parts = target.split('.').filter(Boolean)
    let table = parts.pop() || ''
    let database = parts.join('.') || this.database
    if (!database) throw new Error('No Athena database specified and no default namespace configured')
    let resolvedDatabase = await this.resolveDatabaseName(database)
    let res = await this.client.send(new GetTableMetadataCommand({CatalogName: this.catalog, DatabaseName: resolvedDatabase, TableName: table}))
    return (res.TableMetadata?.Columns || []).map(col => ({name: String(col.Name).toLowerCase(), dataType: String(col.Type)}))
  }

  close(): Promise<void> {
    this.client.destroy()
    return Promise.resolve()
  }

  private async startQuery(sql: string, params?: QueryParams) {
    // Athena execution parameters are positional only and are rendered as SQL literals by the API.
    // Named params would be misleading, because Athena cannot bind them by name.
    if (params && !Array.isArray(params)) throw new Error('Athena only supports positional query parameters')
    let res = await this.client.send(
      new StartQueryExecutionCommand({
        QueryString: sql,
        QueryExecutionContext: {Catalog: this.catalog, Database: this.database},
        WorkGroup: this.workGroup,
        ResultConfiguration: this.outputLocation ? {OutputLocation: this.outputLocation} : undefined,
        ExecutionParameters: params?.map(renderAthenaParameter),
      }),
    )
    if (!res.QueryExecutionId) throw new Error('Athena did not return a query execution id')
    return res.QueryExecutionId
  }

  private async waitForQuery(queryExecutionId: string) {
    let started = Date.now()
    let timeoutMs = 5 * 60 * 1000
    while (Date.now() - started < timeoutMs) {
      let res = await this.client.send(new GetQueryExecutionCommand({QueryExecutionId: queryExecutionId}))
      let status = res.QueryExecution?.Status
      if (status?.State == 'SUCCEEDED') return
      if (status?.State == 'FAILED' || status?.State == 'CANCELLED') throw new Error(`Athena query ${status.State.toLowerCase()}: ${status.StateChangeReason || 'unknown reason'}`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    throw new Error(`Athena query timed out after ${Math.round(timeoutMs / 1000)}s`)
  }

  private async fetchResults(queryExecutionId: string): Promise<QueryResult> {
    let rows: Array<Record<string, unknown>> = []
    let nextToken: string | undefined
    let firstPage = true

    while (true) {
      let res = await this.client.send(new GetQueryResultsCommand({QueryExecutionId: queryExecutionId, NextToken: nextToken, MaxResults: 1000}))
      let columns = res.ResultSet?.ResultSetMetadata?.ColumnInfo || []
      let resultRows = firstPage ? (res.ResultSet?.Rows || []).slice(1) : res.ResultSet?.Rows || []

      for (let row of resultRows) {
        let out: Record<string, unknown> = {}
        columns.forEach((column, idx) => {
          let value = row.Data?.[idx]?.VarCharValue
          out[String(column.Name).toLowerCase()] = parseAthenaValue(value, String(column.Type || ''))
        })
        rows.push(out)
      }

      firstPage = false
      if (!res.NextToken || rows.length >= 10000) return {rows, totalRows: rows.length}
      nextToken = res.NextToken
    }
  }

  private async resolveDatabaseName(name: string): Promise<string> {
    let databases = await this.listDatasets()
    return databases.find(db => db.toLowerCase() == name.toLowerCase()) || name
  }
}

function renderAthenaParameter(value: unknown) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value == 'number' || typeof value == 'bigint') return String(value)
  if (typeof value == 'boolean') return value ? 'true' : 'false'
  return `'${String(value).replace(/'/g, "''")}'`
}

function parseAthenaValue(value: string | undefined, type: string) {
  if (value === undefined) return null
  let normalizedType = type.toLowerCase()
  if (normalizedType == 'boolean') return value == 'true'
  if (/^(tinyint|smallint|integer|bigint|real|float|double|decimal)/.test(normalizedType)) return Number(value)
  return value
}
