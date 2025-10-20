import {BigQuery, type BigQueryOptions} from '@google-cloud/bigquery'
import {config} from '../../lang/config.ts'
import {type QueryConnection} from './types.ts'

export class BigQueryConnection implements QueryConnection {
  private readonly client: BigQuery

  constructor (options: BigQueryOptions = {}) {
    options.projectId ||= config.googleProjectId
    options.maxRetries ||= 3
    options.userAgent ||= 'Graphene'

    if (!options.projectId) throw new Error('googleProjectId must be set in config or provided in service account credentials')
    this.client = new BigQuery(options)
  }

  async runQuery (sql: string) {
    let [job] = await this.client.createQueryJob({query: sql, useLegacySql: false})
    let [rows] = await job.getQueryResults({maxResults: 10000})
    let metadata = job.metadata || (await job.getMetadata())[0]
    let totalRows = Number(metadata?.statistics?.query?.totalRows ?? rows.length)
    return {rows, totalRows}
  }
}
