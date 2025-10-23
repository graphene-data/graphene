#!/usr/bin/env node

// This script lets us see Malloy's IR for given Malloy code against an in-memory DuckDB
// that is pre-populated with the same ecommerce tables/data used in tests.
//
// Usage:
//   node scripts/howDoesMalloy.ts                 # run with default example
//   node scripts/howDoesMalloy.ts path/to/model   # run with a model file
//   node scripts/howDoesMalloy.ts -               # read model from stdin
//
// Examples:
//   node scripts/howDoesMalloy.ts > /tmp/malloy && cursor /tmp/malloy

import {fileURLToPath, pathToFileURL} from 'url'
import fs from 'fs/promises'
import path from 'path'
import {inspect} from 'util'
import {
  SingleConnectionRuntime,
  mkFieldDef,
  type URLReader,
  type Model,
  type ModelURL,
  type ModelString,
  type InvalidationKey,
  type MalloyQueryData,
  type TableSourceDef,
  type SQLSourceDef,
  type QueryDataRow,
} from '@graphenedata/malloy'
import {BaseConnection} from '@graphenedata/malloy/connection'
import {
  DuckDBInstance,
  DuckDBTimestampValue,
  DuckDBDateValue,
} from '../node_modules/.pnpm/node_modules/@duckdb/node-api/lib/index.js'
import type {DuckDBConnection as InnerConnection} from '../node_modules/.pnpm/node_modules/@duckdb/node-api/lib/DuckDBConnection.js'

// Default example that matches the in-memory ecommerce schema created below
const EXAMPLE = `
  source: orders is duckdb.table('orders') extend {
    primary_key: id
    // join_one: users with user_id
  }

  source: payments is duckdb.table('payments') extend {
    primary_key: id
    // join_one: users with user_id
  }

  source: users is duckdb.table('users') extend {
    primary_key: id
    join_many: orders on orders.user_id = id
    join_many: payments on payments.user_id = id
    measure:
      total_orders is orders.count()
      amount_paid is payments.sum(payments.amount)
      avg_paid is payments.avg(payments.amount)
  }

  source: filtered_users is users -> {
    group_by: name
    aggregate: total_orders, amount_paid
    where: age > 20
  }

  // run: filtered_users -> { select: name, total_orders}
  run: users -> {
    aggregate: avg_paid
    group_by: id
  }
`

// Same ecommerce tables/data as in lang/testHelpers.ts
const ECOMM_SETUP = `
  drop table if exists payments;
  drop table if exists order_items;
  drop table if exists orders;
  drop table if exists users;

  create table users (
    id integer primary key,
    name varchar,
    email varchar,
    created_at timestamp,
    age integer
  );

  create table orders (
    id integer primary key,
    user_id integer,
    amount integer,
    status varchar
  );

  create table order_items (
    id integer primary key,
    order_id integer,
    sku varchar,
    quantity integer
  );

  create table payments (
    id integer primary key,
    user_id integer,
    payment_date date,
    amount integer
  );

  insert into users values
    (1, 'Alice', 'alice@example.com', '2024-01-01', 30),
    (2, 'Bob',   'bob@example.com',   '2024-01-10', 40);

  insert into orders values
    (100, 1, 20, 'completed'),
    (101, 1, 40, 'pending'),
    (102, 2, 40, 'completed');

  insert into order_items values
    (1000, 100, 'WIDGET', 3),
    (1001, 100, 'GADGET', 2),
    (1002, 101, 'WIDGET', 1),
    (1003, 102, 'GIZMO', 5);

  insert into payments values
    (500, 1, '2024-01-05', 100),
    (501, 2, '2024-01-12', 50);
`

// Infer the AtomicTypeDef parameter type without importing it explicitly
type AtomicTypeInput = Parameters<typeof mkFieldDef>[0]

function stripTrailingSemicolons (sql: string): string {
  return sql.replace(/;+\s*$/, '')
}

function applyRowLimit (sql: string, rowLimit?: number): string {
  if (rowLimit === undefined) return sql
  let trimmed = stripTrailingSemicolons(sql)
  return `select * from (${trimmed}) as malloy_sub limit ${rowLimit}`
}

function mapDuckDBType (raw: string): AtomicTypeInput {
  let upper = raw.trim().toUpperCase()
  if (!upper) return {type: 'sql native', rawType: raw}

  if (upper.includes('TIMESTAMP')) return {type: 'timestamp'}
  if (upper === 'DATE') return {type: 'date'}
  if (upper.startsWith('TIME')) return {type: 'string'}
  if (
    upper.includes('DOUBLE') ||
    upper.includes('FLOAT') ||
    upper.startsWith('DECIMAL') ||
    upper === 'REAL' ||
    upper === 'NUMERIC'
  ) {
    return {type: 'number', numberType: 'float'}
  }
  if (
    upper.includes('HUGEINT') ||
    upper.includes('INT') ||
    upper.includes('UBIGINT') ||
    upper.includes('UINTEGER') ||
    upper.includes('USMALLINT') ||
    upper.includes('UTINYINT')
  ) {
    return {type: 'number', numberType: 'integer'}
  }
  if (upper === 'BOOLEAN') return {type: 'boolean'}
  if (upper === 'JSON') return {type: 'json'}
  if (
    upper.includes('CHAR') ||
    upper === 'TEXT' ||
    upper === 'STRING' ||
    upper === 'UUID'
  ) {
    return {type: 'string'}
  }
  return {type: 'sql native', rawType: raw}
}

class MalloyDuckDBConnection extends BaseConnection {
  private dbInstance: DuckDBInstance | null = null
  private connection: InnerConnection | null = null
  private readyPromise: Promise<void>

  constructor () {
    super()
    this.readyPromise = this.initialize()
  }

  private async initialize (): Promise<void> {
    this.dbInstance = await DuckDBInstance.create(':memory:')
    this.connection = await this.dbInstance.connect()
  }

  async ready (): Promise<void> {
    await this.readyPromise
  }

  get name (): string {
    return 'duckdb'
  }

  get dialectName (): string {
    return 'duckdb'
  }

  async runSQL (sql: string, options?: any): Promise<MalloyQueryData> {
    let conn = await this.getConnection()
    let finalSQL = applyRowLimit(sql, options?.rowLimit)
    let reader = await conn.runAndReadAll(finalSQL)
    let rows = this.convertRows(reader.getRowObjects())
    return {rows, totalRows: rows.length}
  }

  async fetchTableSchema (tableName: string, tablePath: string): Promise<TableSourceDef | string> {
    let conn = await this.getConnection()
    let escaped = tablePath.replace(/'/g, "''")
    let reader = await conn.runAndReadAll(`pragma table_info('${escaped}')`)
    let rawRows = reader.getRowObjects()
    if (!rawRows.length) return `Table not found: ${tablePath}`

    let rows = rawRows.map(rec => this.convertRecord(rec))
    let fields = rows.map(rec => {
      let columnName = String(rec.name)
      let columnType = String(rec.type ?? '')
      return mkFieldDef(mapDuckDBType(columnType), columnName)
    })
    let pkRow = rows.find(rec => Number(rec.pk ?? 0) > 0)
    let tableDef: TableSourceDef = {
      type: 'table',
      name: tableName,
      tablePath,
      connection: this.name,
      dialect: this.dialectName,
      fields,
    }
    if (pkRow && pkRow.name) {
      tableDef.primaryKey = String(pkRow.name)
    }
    return tableDef
  }

  fetchSelectSchema (_: any): Promise<SQLSourceDef | string> {
    return Promise.resolve('')
  }

  async close (): Promise<void> {
    await this.ready()
    if (this.connection && typeof this.connection.closeSync === 'function') {
      this.connection.closeSync()
    }
    this.connection = null
    if (this.dbInstance) {
      this.dbInstance.closeSync()
      this.dbInstance = null
    }
  }

  private async getConnection (): Promise<InnerConnection> {
    await this.ready()
    if (!this.connection) throw new Error('DuckDB connection not initialized')
    return this.connection
  }

  private convertRows (records: Record<string, unknown>[]): QueryDataRow[] {
    return records.map(rec => this.convertRecord(rec) as QueryDataRow)
  }

  private convertRecord (record: Record<string, unknown>): Record<string, unknown> {
    let out: Record<string, unknown> = {}
    for (let [k, v] of Object.entries(record)) {
      out[k] = this.convertValue(v)
    }
    return out
  }

  private convertValue (value: unknown): unknown {
    if (typeof value === 'bigint') return Number(value)
    if (value === null || value === undefined) return null
    if (value instanceof DuckDBTimestampValue) {
      return new Date(Number(value.micros / 1000n)).toUTCString()
    }
    if (value instanceof DuckDBDateValue) {
      return value.toString()
    }
    if (typeof value === 'object') {
      throw new Error(`Unsupported datatype ${value.constructor?.name}`)
    }
    return value
  }
}

class FileURLReader implements URLReader {
  async readURL (url: URL): Promise<{contents: string; invalidationKey?: InvalidationKey}> {
    if (url.protocol !== 'file:') {
      throw new Error(`Unsupported URL protocol: ${url.protocol}`)
    }
    let contents = await fs.readFile(fileURLToPath(url), 'utf8')
    let stat = await fs.stat(fileURLToPath(url))
    return {contents, invalidationKey: stat.mtimeMs}
  }
  async getInvalidationKey (url: URL): Promise<InvalidationKey> {
    let stat = await fs.stat(fileURLToPath(url))
    return stat.mtimeMs
  }
}

function parseArgs (argv: string[]) {
  let args = new Map<string, string | boolean>()
  for (let i = 2; i < argv.length; i++) {
    let a = argv[i]
    if (a.startsWith('--')) {
      let [k, v] = a.split('=')
      args.set(k, v ?? true)
    } else {
      args.set('_', a)
    }
  }
  return args
}

function removeLocationAndAtWithRange (obj: unknown): void {
  if (Array.isArray(obj)) {
    for (let item of obj) removeLocationAndAtWithRange(item)
  } else if (obj && typeof obj === 'object') {
    for (let key of Object.keys(obj)) {
      let val = (obj as Record<string, unknown>)[key]
      if ((key === 'location' || key === 'at') && val && typeof val === 'object' && 'range' in (val as object)) {
        delete (obj as Record<string, unknown>)[key]
      } else {
        removeLocationAndAtWithRange(val)
      }
    }
  }
}

async function readStdinUTF8 (): Promise<string> {
  return await new Promise<string>(resolve => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => { data += chunk })
    process.stdin.on('end', () => resolve(data))
    process.stdin.resume()
  })
}

async function main () {
  let args = parseArgs(process.argv)
  let fileArg = (args.get('_') as string) || ''
  let format = ((args.get('--format') as string) || 'inspect').toLowerCase() // 'inspect' | 'json'
  let noLocs = args.get('--keep-locations') ? false : true
  let noUserArgs = process.argv.length <= 2

  let modelInput: ModelURL | ModelString
  let importBase: URL | undefined
  let urlReader: URLReader | undefined

  if (noUserArgs) {
    // Default: minimal ecommerce model with a simple query
    modelInput = EXAMPLE
  } else if (fileArg && fileArg !== '-') {
    let abs = path.resolve(process.cwd(), fileArg)
    modelInput = pathToFileURL(abs)
    importBase = pathToFileURL(path.dirname(abs) + path.sep)
    urlReader = new FileURLReader()
  } else {
    let stdin = await readStdinUTF8().catch(() => '')
    if (!stdin.trim()) {
      console.error('Usage: howDoesMalloy [path/to/model.malloy | -] [--format=json|inspect] [--keep-locations]')
      process.exit(2)
    }
    modelInput = stdin
  }

  let connection = new MalloyDuckDBConnection()
  await connection.ready()

  for (let stmt of ECOMM_SETUP.split(';')) {
    let s = stmt.trim()
    if (!s) continue
    await connection.runSQL(s)
  }

  let runtime = new SingleConnectionRuntime({connection, urlReader})

  let materializer = runtime.loadModel(modelInput, importBase ? {importBaseURL: importBase} : undefined)
  let model: Model = await materializer.getModel()

  let cloned = structuredClone(model._modelDef)
  if (noLocs) removeLocationAndAtWithRange(cloned)

  function collapseJoinTables (obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map(collapseJoinTables)
    if (obj && typeof obj === 'object') {
      // If this is a joined table field, collapse for brevity
      let rec: any = obj
      if (rec.type === 'table' && typeof rec.join === 'string') {
        return {
          type: 'table',
          name: rec.name,
          join: rec.join,
          note: 'collapsed for howDoesMalloy output brevity',
        }
      }
      // Otherwise, recurse into properties
      let out: any = Array.isArray(rec) ? [] : {}
      for (let [k, v] of Object.entries(rec)) {
        out[k] = collapseJoinTables(v)
      }
      return out
    }
    return obj
  }

  let collapsed = collapseJoinTables(cloned) as any
  collapsed.references = 'hidden for howDoesMalloy brevity'

  let finalSQL = await materializer.loadFinalQuery().getSQL()
  console.log(`\n=== SQL (final) ===\n${finalSQL}`)

  console.log('=== ModelDef ===')
  if (format === 'json') {
    console.log(JSON.stringify(collapsed, null, 2))
  } else {
    console.log(inspect(collapsed, {depth: Infinity, colors: false, breakLength: 80}))
  }

  await connection.close()
}

main().catch(err => {
  console.error(err?.stack || err)
  process.exit(1)
})
