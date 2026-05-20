import {BigQuery, BigQueryDate, BigQueryTimestamp, type BigQueryOptions} from '@google-cloud/bigquery'

import {config} from '../../lang/config.ts'
import {type QueryConnection, type QueryResult, type SchemaColumn, type QueryCacheEntry, type QueryOptions} from './types.ts'

// BigQuery identifiers can contain letters, numbers, underscores, and hyphens
function validateBigQueryIdent(ident: string) {
  if (!/^[\w.-]+$/.test(ident)) throw new Error(`Invalid BigQuery identifier: ${ident}`)
}

export class BigQueryConnection implements QueryConnection {
  queryCacheProvider = 'bigquery' as const
  private readonly client: BigQuery
  private readonly projectId: string
  private readonly defaultNamespace?: string
  private readonly location?: string
  private readonly clientEmail?: string

  constructor(options: BigQueryOptions = {}) {
    options.projectId ||= config.bigquery?.projectId
    options.location ||= config.bigquery?.location
    if (!options.projectId) throw new Error('projectId must be set in config or provided in service account credentials')
    this.projectId = options.projectId
    this.location = options.location
    this.clientEmail = (options.credentials as any)?.client_email
    this.client = new BigQuery({...options, userAgent: 'Graphene'})
    this.defaultNamespace = config.defaultNamespace
  }

  async runQuery(sql: string, options: QueryOptions = {}): Promise<QueryResult> {
    let {params} = options
    let [job] = await this.client.createQueryJob({query: sql, useLegacySql: false, params, location: this.location})
    let [rows] = await job.getQueryResults({maxResults: 10000})
    let metadata = job.metadata || (await job.getMetadata())[0]
    let totalRows = Number(metadata?.statistics?.query?.totalRows ?? rows.length)
    normalizeBigQueryRows(rows)

    return {rows, totalRows, queryCacheRef: {provider: 'bigquery', projectId: this.projectId, jobId: job.id, location: job.location || this.location}}
  }

  async retrieveCachedQuery(entry: QueryCacheEntry): Promise<QueryResult> {
    let jobId = String(entry.ref.jobId || '')
    if (!jobId) throw new Error('BigQuery cache entry is missing jobId')

    let job = this.client.job(jobId, {location: String(entry.ref.location || this.location || '') || undefined})
    let [rows] = await job.getQueryResults({maxResults: 10000})
    let metadata = job.metadata || (await job.getMetadata())[0]
    let totalRows = Number(metadata?.statistics?.query?.totalRows ?? rows.length)
    normalizeBigQueryRows(rows)
    return {rows, totalRows}
  }

  queryCacheIdentity() {
    return {projectId: this.projectId, location: this.location || '', clientEmail: this.clientEmail || '', defaultNamespace: this.defaultNamespace || ''}
  }

  async listDatasets(): Promise<string[]> {
    let [datasets] = await this.client.getDatasets()
    return datasets.map(d => String(d.id || d.metadata.datasetReference?.datasetId || '').toLowerCase())
  }

  async listTables(dataset?: string): Promise<string[]> {
    if (!dataset) throw new Error('BigQuery requires a dataset')
    validateBigQueryIdent(dataset)

    let resolvedDataset = await this.resolveDatasetName(dataset)
    let res = await this.runQuery(`select table_name as table_name
      from \`${resolvedDataset}.INFORMATION_SCHEMA.TABLES\`
      where table_type in ('BASE TABLE', 'VIEW') order by table_name`)

    return res.rows.map(r => `${resolvedDataset.toLowerCase()}.${String(r['table_name']).toLowerCase()}`)
  }

  async describeTable(target: string): Promise<SchemaColumn[]> {
    let parts = target.split('.')
    let table = parts.pop() || ''
    let dataset = parts.join('.') || this.defaultNamespace
    if (!dataset) throw new Error('No dataset specified and no default namespace configured')
    validateBigQueryIdent(dataset)
    let resolvedDataset = await this.resolveDatasetName(dataset)
    let sql = `
      select column_name as column_name, data_type as data_type, ordinal_position as ordinal_position
      from \`${resolvedDataset}.INFORMATION_SCHEMA.COLUMNS\`
      where lower(table_name) = lower(@table)
      order by ordinal_position
    `.trim()
    let res = await this.runQuery(sql, {params: {table}})
    return res.rows.map(row => {
      return {name: String(row['column_name']).toLowerCase(), dataType: String(row['data_type'])}
    })
  }

  async resolveDatasetName(name: string): Promise<string> {
    let datasets = await this.listDatasets()
    return datasets.find(ds => ds.toLowerCase() == name.toLowerCase()) || name
  }

  async close(): Promise<void> {}
}

function normalizeBigQueryRows(rows: any[]) {
  rows.forEach(r => {
    Object.entries(r).forEach(([k, v]) => {
      if (v instanceof BigQueryTimestamp) r[k] = v.value
      if (v instanceof BigQueryDate) r[k] = v.value
    })
  })
}
