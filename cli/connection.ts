import {config} from '@graphene/lang'
import * as fs from 'fs'
import {type Connection} from '@malloydata/malloy'

export async function getConnection () {
  let connection
  if (config.dialect === 'bigquery') {
    let mod = await import('@malloydata/db-bigquery')
    connection = new mod.BigQueryConnection("bigQuery") as Connection
  }

  if (config.dialect === 'duckdb') {
    let mod = await import('@malloydata/db-duckdb')
    let files = await fs.promises.readdir(process.cwd())
    let dbPath = files.find(f => f.endsWith('.duckdb'))
    if (!dbPath) throw new Error('No .duckdb file found in current directory')
    connection = new mod.DuckDBConnection("duckdb", dbPath) as Connection
  }

  if (!connection) throw new Error('No connection found')
  return connection
}
