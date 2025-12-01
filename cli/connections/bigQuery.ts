import {BigQuery, BigQueryDate, BigQueryTimestamp, type BigQueryOptions} from '@google-cloud/bigquery'
import {type QueryConnection} from './types.ts'
import {config} from '../../lang/config.ts'
import {readFileSync} from 'fs'

// You can also set GOOGLE_APPLICATION_CREDENTIALS to point at a service account key file

export class BigQueryConnection implements QueryConnection {
  private readonly client: BigQuery

  constructor (options: BigQueryOptions = {}) {
    options.projectId ||= config.bigquery?.projectId
    if (process.env.GOOGLE_CREDENTIALS_CONTENT) {
      let parsed = JSON.parse(process.env.GOOGLE_CREDENTIALS_CONTENT)
      options.projectId = parsed.project_id
      options.credentials = parsed
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      let tmp = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, {encoding: 'utf-8'}))
      options.projectId = tmp.project_id
    }

    if (!options.projectId) throw new Error('projectId must be set in config or provided in service account credentials')
    this.projectId = options.projectId
    this.client = new BigQuery({...options, userAgent: 'Graphene'})
    this.defaultNamespace = config.namespace
  }

  async runQuery (sql: string): Promise<QueryResult> {
    let [job] = await this.client.createQueryJob({query: sql, useLegacySql: false})
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
}
