import {config} from '@graphene/lang'
import * as fs from 'fs'
import {type Connection} from '@malloydata/malloy'
import path from 'path'

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
    let mod = await import('@duckdb/node-api')
    let files = await fs.promises.readdir(config.root)
    let databasePath = files.find(f => f.endsWith('.duckdb'))
    if (!databasePath) throw new Error('No .duckdb file found in current directory')
    databasePath = path.resolve(config.root, databasePath)
    let db = await mod.DuckDBInstance.create(':memory:')
    let duckdbConnection = await db.connect()
    let escapedPath = databasePath.replace(/'/g, "''")
    // Attach the project DuckDB file in read-only mode and make it the active schema
    await duckdbConnection.run(`attach '${escapedPath}' as graphene_cli (READ_ONLY);`)
    await duckdbConnection.run('use graphene_cli;')
    let c = {
      async runSQL (sql: string) {
        let reader = await duckdbConnection.runAndReadAll(sql)
        let rows = reader.getRowObjects().map(record => {
          let out: Record<string, unknown> = {}
          for (let key of Object.keys(record)) {
            let value = (record as Record<string, unknown>)[key]
            out[key] = typeof value === 'bigint' ? Number(value) : value
          }
          return out
        })
        return {rows}
      },
    } as unknown as Connection
    connection = Promise.resolve(c)
    return connection
  }

  if (!connection) throw new Error('No connection found')
  return connection
}
