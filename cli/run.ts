import * as fs from 'node:fs'
import Table from 'cli-table3'
import chalk from 'chalk'

export interface Results {
  rows: any[]
}

export interface Db {
  query: (query: string) => Promise<Results>
}

export async function connectToDuckDB(): Promise<Db | null> {
  const files = fs.readdirSync('.')
  const duckFiles = files.filter((file: string) => file.endsWith('.duckdb'))

  if (duckFiles[0]) {
    console.log(chalk.dim(`Using database: ${duckFiles[0]}`))
    let module: any
    try {
      module = await import('@duckdb/node-api')
    } catch (_) {
      console.error('❌  @duckdb/node-api package not installed – unable to execute. Install with `npm i @duckdb/node-api`.')
      return null
    }

    const db = await module.DuckDBInstance.create(duckFiles[0], { access_mode: 'READ_ONLY' })
    const conn = await db.connect()

    return {
      query: async (q) => {
        const reader = await conn.runAndReadAll(q)
        return { rows: reader.getRowObjects() }
      },
    }
  }
  return null
}

export function printTable(rows: any[]) {
  if (!rows || rows.length === 0) {
    console.log(chalk.yellow('No results returned'))
    return
  }

  const headers = Object.keys(rows[0])
  const table = new Table({ head: headers.map((h) => chalk.blue(h)) })
  rows.forEach((row) => table.push(headers.map((h) => row[h]?.toString() || '')))
  console.log(table.toString())
}