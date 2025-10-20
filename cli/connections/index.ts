import {config} from '../../lang/config.ts'

export interface QueryResult {
  rows: Array<Record<string, unknown>>
  totalRows?: number
}

export interface QueryConnection {
  runQuery(sql: string): Promise<QueryResult>
}

export async function getConnection (): Promise<QueryConnection> {
  if (config.dialect === 'bigquery') {
    let mod = await import('./bigQuery.ts')
    return new mod.BigQueryConnection()
  } else if (config.dialect === 'duckdb') {
    let mod = await import('./duckdb.ts')
    return new mod.DuckDBConnection()
  } else {
    throw new Error(`Unsupported dialect: ${config.dialect}`)
  }
}
