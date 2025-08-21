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
  type URLReader,
  Model,
  QueryMaterializer,
  type ModelURL,
  type ModelString,
  type InvalidationKey,
} from '@malloydata/malloy'
import {DuckDBConnection} from '@malloydata/db-duckdb'

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
  }

  run: users -> {
    group_by: name
    aggregate: total_orders, amount_paid
  }`

// Same ecommerce tables/data as in lang/testHelpers.ts
const ECOMM_SETUP = `
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

  // Always use an in-memory DuckDB
  let connection = new DuckDBConnection({name: 'duckdb', databasePath: ':memory:'})
  // Initialize tables/data
  await (connection as any).connecting
  // Run each statement individually to avoid issues with streaming
  for (let stmt of ECOMM_SETUP.split(';')) {
    let s = stmt.trim()
    if (!s) continue
    await (connection as any).runDuckDBQuery(s)
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

  let collapsed = collapseJoinTables(cloned)
  collapsed.references = 'hidden for howDoesMalloy brevity'

  let finalSQL = await materializer.loadFinalQuery().getSQL()
  console.log(`\n=== SQL (final) ===\n${finalSQL}`)

  console.log('=== ModelDef ===')
  if (format === 'json') {
    console.log(JSON.stringify(collapsed, null, 2))
  } else {
    console.log(inspect(collapsed, {depth: Infinity, colors: false, breakLength: 80}))
  }

  if ('close' in connection && typeof (connection as any).close === 'function') {
    await (connection as any).close()
  }
}

main().catch(err => {
  console.error(err?.stack || err)
  process.exit(1)
})
