#!/usr/bin/env node

// This script lets us see Malloy's IR for given Malloy code.
// node scripts/howDoesMalloy.ts > /tmp/malloy && cursor /tmp/malloy
// node scripts/howDoesMalloy.ts examples/flights/test.malloysql --duckdb=examples/flights/flights.duckdb

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

const EXAMPLE = `
  source: carriers is duckdb.table('carriers') extend {
    primary_key: code
  }

  source: airports is duckdb.table('airports') extend {
    primary_key: code
  }

  source: aircraft_models is duckdb.table('aircraft_models') extend {
    primary_key: aircraft_model_code
  }

  source: aircraft is duckdb.table('aircraft') extend {
    primary_key: tail_num
    join_one: aircraft_models with aircraft_model_code
  }

  source: flights is duckdb.table('flights') extend {
    primary_key: id2

    rename: origin_code is origin
    rename: destination_code is destination

    join_one: carriers with carrier
    join_one: origin is airports with origin_code
    join_one: destination is airports with destination_code
    join_one: aircraft with tail_num
  }

  run: aircraft -> {
    aggregate: wtf is aircraft_models.count()
    limit: 10
  }`

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
  let duckdbPath = (args.get('--duckdb') as string) || ':memory:'
  let dumpAllNamed = Boolean(args.get('--all-named'))
  let queryNamesCsv = (args.get('--queries') as string) || ''
  let format = ((args.get('--format') as string) || 'inspect').toLowerCase() // 'inspect' | 'json'
  let noLocs = args.get('--keep-locations') ? false : true
  let noUserArgs = process.argv.length <= 2

  let modelInput: ModelURL | ModelString
  let importBase: URL | undefined
  let urlReader: URLReader | undefined

  if (noUserArgs) {
    // Default: minimal flights model with a simple query
    modelInput = EXAMPLE
    // Prefer the example DuckDB if present
    let defaultDb = path.resolve(process.cwd(), 'examples/flights/flights.duckdb')
    try {
      await fs.stat(defaultDb)
      duckdbPath = defaultDb
    } catch {
      // keep ':memory:'
    }
  } else if (fileArg && fileArg !== '-') {
    let abs = path.resolve(process.cwd(), fileArg)
    modelInput = pathToFileURL(abs)
    importBase = pathToFileURL(path.dirname(abs) + path.sep)
    urlReader = new FileURLReader()
  } else {
    let stdin = await readStdinUTF8().catch(() => '')
    if (!stdin.trim()) {
      console.error('Usage: malloy-ir [path/to/model.malloy | -] [--duckdb=/path/to.db] [--all-named] [--queries=name1,name2] [--format=json|inspect] [--keep-locations]')
      process.exit(2)
    }
    modelInput = stdin
  }

  let connection = new DuckDBConnection({name: 'duckdb', databasePath: duckdbPath})
  let runtime = new SingleConnectionRuntime({connection, urlReader})

  let materializer = runtime.loadModel(modelInput, importBase ? {importBaseURL: importBase} : undefined)
  let model: Model = await materializer.getModel()

  let cloned = structuredClone(model._modelDef)
  if (noLocs) removeLocationAndAtWithRange(cloned)

  console.log('=== ModelDef ===')
  if (format === 'json') {
    console.log(JSON.stringify(cloned, null, 2))
  } else {
    console.log(inspect(cloned, {depth: Infinity, colors: false, breakLength: 80}))
  }

  let selectedNames: string[] = []
  if (queryNamesCsv) {
    selectedNames = queryNamesCsv.split(',').map(s => s.trim()).filter(Boolean)
  } else if (dumpAllNamed) {
    selectedNames = model.namedQueries.map(q => q.name)
  }

  if (selectedNames.length > 0) {
    for (let name of selectedNames) {
      let qm: QueryMaterializer = materializer.loadQueryByName(name)
      let sql = await qm.getSQL()
      console.log(`\n=== SQL (${name}) ===\n${sql}`)
    }
  } else {
    let finalSQL = await materializer.loadFinalQuery().getSQL()
    console.log(`\n=== SQL (final) ===\n${finalSQL}`)
  }

  if ('close' in connection && typeof (connection as any).close === 'function') {
    await (connection as any).close()
  }
}

main().catch(err => {
  console.error(err?.stack || err)
  process.exit(1)
})
