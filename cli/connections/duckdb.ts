import {promises as fs} from 'fs'
import path from 'path'
import {config} from '../../lang/config.ts'
import {type QueryConnection} from './types.ts'
import {DuckDBTimestampValue, DuckDBInstance, DuckDBDateValue, type DuckDBConnection as InnerConnection} from '@duckdb/node-api'

interface DuckDbOptions {
  path?: string
}

export class DuckDBConnection implements QueryConnection {
  options: DuckDbOptions
  ready: Promise<void>
  connection: InnerConnection | null = null

  constructor (options?: DuckDbOptions) {
    this.options = options || {}
    this.ready = this.initialize()
  }

  private async initialize () {
    let dbPath = this.options.path
    if (!dbPath) {
      let files = await fs.readdir(config.root)
      dbPath = files.find(f => f.endsWith('.duckdb'))
      if (!dbPath) throw new Error('No .duckdb file found in current directory')
      dbPath = path.resolve(config.root, dbPath)
    }

    let db = await DuckDBInstance.create(':memory:')
    this.connection = await db.connect()
    let escapedPath = dbPath.replace(/'/g, "''")
    // Attach the project DuckDB file in read-only mode and make it the active schema
    await this.connection.run(`attach '${escapedPath}' as graphene_cli (READ_ONLY);`)
    await this.connection.run('use graphene_cli;')
  }

  async runQuery (sql: string) {
    await this.ready
    let reader = await this.connection!.runAndReadAll(sql)
    let rows = reader.getRowObjects().map(record => {
      let out: Record<string, unknown> = {}
      for (let [k, v] of Object.entries(record)) {
        if (typeof v === 'bigint') out[k] = Number(v)
        else if (v === null) out[k] = null
        else if (v instanceof DuckDBTimestampValue) out[k] = new Date(Number(v.micros / 1000n)).toUTCString()
        else if (v instanceof DuckDBDateValue) out[k] = v.toString()
        else if (typeof v === 'object') throw new Error(`Unsupported datatype ${v.constructor?.name}`)
        else out[k] = v
      }
      return out
    })
    return {rows}
  }
}
