import * as fs from 'node:fs'
import Table from 'cli-table3'
import chalk from 'chalk'

export interface Results {
  rows: any[]
}

export interface Db {
  query: (query: string) => Promise<Results>
}

export async function connectToDuckDB (): Promise<Db | null> {
  let files = fs.readdirSync('.')
  let duckFiles = files.filter((file: string) => file.endsWith('.duckdb'))
  if (duckFiles.length === 0) {
    console.error('❌  No .duckdb file found in current directory')
    return null
  }

  console.log(chalk.dim(`Using database: ${duckFiles[0]}`))
  let module: any
  try {
    module = await import('@duckdb/node-api')
  } catch (e) {
    console.error('❌  @duckdb/node-api package not installed – unable to execute. Install with `npm i @duckdb/node-api`.')
    console.error(e)
    return null
  }

  let db = await module.DuckDBInstance.create(duckFiles[0], {access_mode: 'READ_ONLY'})
  let conn = await db.connect()

  return {
    query: async (q) => {
      let reader = await conn.runAndReadAll(q)
      return {rows: reader.getRowObjects()}
    },
  }
}

export function printTable (rows: any[]) {
  if (!rows || rows.length === 0) {
    console.log(chalk.yellow('No results returned'))
    return
  }

  let headers = Object.keys(rows[0])
  let table = new Table({head: headers.map((h) => chalk.blue(h))})
  rows.forEach((row) => table.push(headers.map((h) => row[h]?.toString() || '')))
  console.log(table.toString())
}
