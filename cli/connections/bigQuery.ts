import {BigQuery, BigQueryDate, BigQueryTimestamp, type BigQueryOptions} from '@google-cloud/bigquery'

import {config} from '../../lang/config.ts'
import {type QueryConnection, type QueryResult, type SchemaColumn, type QueryParams} from './types.ts'

// BigQuery identifiers can contain letters, numbers, underscores, and hyphens
function validateBigQueryIdent(ident: string) {
  if (!/^[\w.-]+$/.test(ident)) throw new Error(`Invalid BigQuery identifier: ${ident}`)
}

export class BigQueryConnection implements QueryConnection {
  private readonly client: BigQuery
  private readonly projectId: string
  private readonly defaultNamespace?: string

  constructor(options: BigQueryOptions = {}) {
    options.projectId ||= config.bigquery?.projectId
    if (!options.projectId) throw new Error('projectId must be set in config or provided in service account credentials')
    this.projectId = options.projectId
    this.client = new BigQuery({...options, userAgent: 'Graphene'})
    this.defaultNamespace = config.defaultNamespace
  }

  async runQuery(sql: string, params?: QueryParams): Promise<QueryResult> {
    let [job] = await this.client.createQueryJob({query: sql, useLegacySql: false, params})
    let [rows] = await job.getQueryResults({maxResults: 10000})
    let metadata = job.metadata || (await job.getMetadata())[0]
    let totalRows = Number(metadata?.statistics?.query?.totalRows ?? rows.length)

    rows.forEach(r => {
      Object.entries(r).forEach(([k, v]) => {
        if (v instanceof BigQueryTimestamp) r[k] = v.value
        if (v instanceof BigQueryDate) r[k] = v.value
      })
    })

    return {rows, totalRows}
  }

  async listDatasets(): Promise<string[]> {
    let [datasets] = await this.client.getDatasets()
    return datasets.map(d => d.id || d.metadata.datasetReference?.datasetId)
  }

  async listTables(dataset?: string): Promise<string[]> {
    if (!dataset) throw new Error('BigQuery requires a dataset')
    validateBigQueryIdent(dataset)

    let res = await this.runQuery(`select table_name as table_name
      from \`${dataset}.INFORMATION_SCHEMA.TABLES\`
      where table_type in ('BASE TABLE', 'VIEW') order by table_name`)

    return res.rows.map(r => `${dataset}.${r['table_name']}`)
  }

  async describeTable(target: string): Promise<SchemaColumn[]> {
    let parts = target.split('.')
    let table = parts.pop() || ''
    let dataset = parts.join('.') || this.defaultNamespace
    if (!dataset) throw new Error('No dataset specified and no default namespace configured')
    validateBigQueryIdent(dataset)
    let sql = `
      select column_name as column_name, data_type as data_type, ordinal_position as ordinal_position
      from \`${dataset}.INFORMATION_SCHEMA.COLUMNS\`
      where lower(table_name) = lower(@table)
      order by ordinal_position
    `.trim()
    let res = await this.runQuery(sql, {table})
    return res.rows.map(row => {
      return {name: String(row['column_name']), dataType: String(row['data_type'])}
    })
  }
}
