import {readFileSync} from 'fs'
import {config} from '../../lang/config.ts'
import {authenticatedFetch} from '../auth.ts'
import {type QueryResult, type QueryConnection, type QueryParams} from './types.ts'

// Reads credentials from environment variables and passes them to the connection constructors.
// The connection classes themselves have no env-reading logic — this keeps the cloud server
// from accidentally picking up local env vars instead of database-stored credentials.
export async function getConnection(): Promise<QueryConnection> {
  if (config.dialect === 'bigquery') {
    let mod = await import('./bigQuery.ts')
    let options: any = {}
    if (process.env.GOOGLE_CREDENTIALS_CONTENT) { // the actual json as an env var
      let parsed = JSON.parse(process.env.GOOGLE_CREDENTIALS_CONTENT)
      options = {projectId: parsed.project_id, credentials: parsed}
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) { // env var is the path of a json cred file
      let parsed = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, {encoding: 'utf-8'}))
      options = {projectId: parsed.project_id}
    }
    return new mod.BigQueryConnection(options)
  } else if (config.dialect === 'duckdb') {
    let mod = await import('./duckdb.ts')
    return new mod.DuckDBConnection({})
  } else if (config.dialect === 'snowflake') {
    let mod = await import('./snowflake.ts')
    return new mod.SnowflakeConnection({
      privateKeyPath: process.env.SNOWFLAKE_PRI_KEY_PATH,
      privateKey: process.env.SNOWFLAKE_PRI_KEY,
      privateKeyPass: process.env.SNOWFLAKE_PRI_PASSPHRASE,
      logLevel: process.env.SNOWFLAKE_LOG_LEVEL,
    })
  } else {
    throw new Error(`Unsupported dialect: ${config.dialect}`)
  }
}

export async function runQuery(sql: string, params?: QueryParams): Promise<QueryResult> {
  if (config.host) {
    let resp = await authenticatedFetch('/_api/query', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sql, params}),
    })
    return await resp.json()
  }

  let conn = await getConnection()
  return await conn.runQuery(sql, params)
}
