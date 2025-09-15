import {config} from '@graphene/lang'
import * as fs from 'fs'
import {type Connection} from '@malloydata/malloy'

let connection: Promise<Connection> | null = null

export async function getConnection () {
  if (connection) return await connection

  if (config.dialect === 'bigquery') {
    let mod = await import('@malloydata/db-bigquery')
    // not exactly sure the difference between these, but if you don't specify billingProjectId, it will fail to connect.
    let cfg = {projectId: config.googleProjectId, billingProjectId: config.googleProjectId}
    let c = new mod.BigQueryConnection('bigQuery', undefined, cfg) as Connection
    connection = Promise.resolve(c)
    return c
  }

  if (config.dialect === 'duckdb') {
    let mod = await import('@malloydata/db-duckdb')
    let files = await fs.promises.readdir(process.cwd())
    let databasePath = files.find(f => f.endsWith('.duckdb'))
    if (!databasePath) throw new Error('No .duckdb file found in current directory')
    let c = new mod.DuckDBConnection({databasePath, readOnly: true, name: 'duckdb'}) as Connection
    connection = Promise.resolve(c)
    return connection
  }

  if (!connection) throw new Error('No connection found')
  return connection
}
