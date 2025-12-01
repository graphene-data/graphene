import {config} from '../../lang/config.ts'
import {authenticatedFetch} from '../auth.ts'
import {type QueryResult, type QueryConnection} from './types.ts'

export async function getConnection (): Promise<QueryConnection> {
  if (config.dialect === 'bigquery') {
    let mod = await import('./bigQuery.ts')
    return new mod.BigQueryConnection()
  } else if (config.dialect === 'duckdb') {
    let mod = await import('./duckdb.ts')
    return new mod.DuckDBConnection({})
  } else if (config.dialect === 'snowflake') {
    let mod = await import('./snowflake.ts')
    return new mod.SnowflakeConnection({})
  } else {
    throw new Error(`Unsupported dialect: ${config.dialect}`)
  }
}

export async function runQuery (sql:string): Promise<QueryResult> {
  if (config.host) {
    let resp = await authenticatedFetch('/_api/query', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sql}),
    })
    return await resp.json()
  }

  let conn = await getConnection()
  return await conn.runQuery(sql)
}
