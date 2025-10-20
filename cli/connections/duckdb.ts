import {promises as fs} from 'fs'
import path from 'path'
import {config} from '../../lang/config.ts'
import {type QueryConnection} from './types.ts'

export class DuckDBConnection implements QueryConnection {
  private ready: Promise<void>
  private connection: any
  private DuckDBTimestampValue: any
  private DuckDBDateValue: any

  constructor () {
    this.ready = this.initialize()
  }

  private async initialize () {
    let duckModule = await import('@duckdb/node-api')
    let {DuckDBTimestampValue, DuckDBInstance, DuckDBDateValue} = duckModule

    let files = await fs.readdir(config.root)
    let databasePath = files.find(f => f.endsWith('.duckdb'))
    if (!databasePath) throw new Error('No .duckdb file found in current directory')
    databasePath = path.resolve(config.root, databasePath)

    let db = await DuckDBInstance.create(':memory:')
    let duckdbConnection = await db.connect()
    let escapedPath = databasePath.replace(/'/g, "''")
    // Attach the project DuckDB file in read-only mode and make it the active schema
    await duckdbConnection.run(`attach '${escapedPath}' as graphene_cli (READ_ONLY);`)
    await duckdbConnection.run('use graphene_cli;')

    this.connection = duckdbConnection
    this.DuckDBTimestampValue = DuckDBTimestampValue
    this.DuckDBDateValue = DuckDBDateValue
  }

  async runQuery (sql: string) {
    await this.ready
    let reader = await this.connection.runAndReadAll(sql)
    let rows = reader.getRowObjects().map(record => {
      let out: Record<string, unknown> = {}
      for (let [k, v] of Object.entries(record)) {
        if (typeof v === 'bigint') out[k] = Number(v)
        else if (v === null) out[k] = null
        else if (v instanceof this.DuckDBTimestampValue) out[k] = new Date(Number(v.micros / 1000n))
        else if (v instanceof this.DuckDBDateValue) out[k] = new Date(v.toString())
        else if (typeof v === 'object') throw new Error(`Unsupported datatype ${v.constructor?.name}`)
        else out[k] = v
      }
      return out
    })
    return {rows}
  }
}

