import {config} from '../../lang/config.ts'
import {authenticatedFetch} from '../auth.ts'
import {type QueryResult} from './types.ts'

export async function runQuery (sql:string): Promise<QueryResult> {
  if (config.host) {
    let resp = await authenticatedFetch('/_api/query', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sql}),
    })
    return await resp.json()
  }

  if (config.dialect === 'bigquery') {
    let mod = await import('./bigQuery.ts')
    let conn = new mod.BigQueryConnection()
    return await conn.runQuery(sql)
  } else if (config.dialect === 'duckdb') {
    let mod = await import('./duckdb.ts')
    let conn = new mod.DuckDBConnection({})
    return await conn.runQuery(sql)
  } else if (config.dialect === 'snowflake') {
    let mod = await import('./snowflake.ts')
    let conn = new mod.SnowflakeConnection({})
    return await conn.runQuery(sql)
  } else {
    throw new Error(`Unsupported dialect: ${config.dialect}`)
  }
}
