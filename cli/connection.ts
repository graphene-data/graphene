import {config} from '@graphene/lang'
import * as fs from 'fs'
import {type Connection} from '@malloydata/malloy'

let connection: Promise<Connection> | null = null

export async function getConnection () {
  if (connection) return await connection

  if (config.dialect === 'bigquery') {
    console.log('wtfmate2', config.googleProjectId)
    let mod = await import('@malloydata/db-bigquery')
    let cfg = {projectId: config.googleProjectId, billingProjectId: config.googleProjectId}
    let c = new mod.BigQueryConnection('bigQuery', undefined, cfg) as Connection
    connection = Promise.resolve(c)
    return c
  }

  if (config.dialect === 'duckdb') {
    let mod = await import('@malloydata/db-duckdb')
    let files = await fs.promises.readdir(process.cwd())
    let dbPath = files.find(f => f.endsWith('.duckdb'))
    if (!dbPath) throw new Error('No .duckdb file found in current directory')
    let c = new mod.DuckDBConnection('duckdb', dbPath) as Connection
    connection = Promise.resolve(c)
    return connection
  }

  if (!connection) throw new Error('No connection found')
  return connection
}
