
import * as malloy from './node_modules/@malloydata/malloy/dist/model/index.js'
import {StandardSQLDialect} from './node_modules/@malloydata/malloy/dist/dialect/standardsql/index.js'
import {registerDialect} from './node_modules/@malloydata/malloy/dist/dialect/dialect_map.js'
import {expandBlueprintMap} from './node_modules/@malloydata/malloy/dist/dialect/functions/index.js'
import {readFile} from 'node:fs/promises'
import {glob} from 'glob'
import {FILE_MAP, analyzeTable, analyzeQuery, findTables, clearWorkspace, diagnostics, clearDiagnostics, getNodeEntity, parse} from './analyze.ts'
import {type Query, type Table} from './types.ts'
import {fillInParams} from './params.ts'
import {getOffset} from './util.ts'
import {config, loadConfig} from './config.ts'
import path from 'node:path'
import {type DialectFunctionOverloadDef} from '@malloydata/malloy'
import {BIGQUERY_DIALECT_FUNCTIONS} from './functions.ts'

export {clearWorkspace}
export {config}
export type {Query, Table, Diagnostic} from './types.ts'
export function getTable (name: string) { return Object.values(FILE_MAP).flatMap(f => f.tables).find(t => t.name == name) }
export function getFile (name: string) { return FILE_MAP[name] }
export function getFiles () { return Object.values(FILE_MAP) }
export function getDiagnostics () { return diagnostics }

// Loads and parses all gsql files within a directory
export async function loadWorkspace (dir:string) {
  loadConfig(dir)

  let files = await glob('**/*.gsql', {cwd: dir})
  for await (let file of files) {
    let contents = await readFile(path.join(dir, file), 'utf-8')
    updateFile(contents, file)
  }
}

// when a file changes, it's parse tree becomes invalid.
export function updateFile (contents: string, path: string) {
  FILE_MAP[path] ||= {path, contents, tree: null, tables: []}
  FILE_MAP[path].contents = contents
  FILE_MAP[path].tree = null
  return FILE_MAP[path]
}

// Analyzes all gsql files in the workspace, and optionally any gsql provided.
// This could be more efficient, but for now we just re-analyze everything.
export function analyze (contents?: string): Query[] {
  clearDiagnostics()
  delete FILE_MAP['input'] // clean up any previous ephemeral tables

  Object.values(FILE_MAP).forEach(f => {
    parse(f)
    f.tables = findTables(f) // for now, blow away previously analyzed tables
  })
  Object.values(FILE_MAP).flatMap(f => f.tables).forEach(analyzeTable)

  // if you provided a file, we'll analyze it and give you the queries.
  // Any tables defined in `contents` are ephemeral, since query interpolation means multiple browser tabs
  // could be trying to define the same named table in the same file with different sql.
  // This is a bit hacky, but it works since analysis is sync, and we can clear out this "file" after we're done.
  if (contents) {
    let fi = updateFile(contents, 'input')
    parse(fi)
    fi.tables = findTables(fi)
    fi.tables.forEach(analyzeTable)

    let queries = fi.tree!.topNode.getChildren('QueryStatement') || []
    return queries.map(analyzeQuery).filter(q => !!q)
  }

  return []
}

export function toSql (query: Query, params: Record<string, any> = {}): string {
  // queryModel contents should be all the tables from gsql files, and any from the same md file as the query
  let contents = {}
  Object.values(FILE_MAP).forEach(f => f.tables.forEach(t => contents[t.name] = t))
  query.subQuerySources.forEach(t => {
    contents[t.name] = {...t, query: fillInParams(t.query!, params)}
  })

  let malloyQuery = fillInParams(query.malloyQuery, params)

  // Send the query to malloy for generation
  let qm = new malloy.QueryModel({
    name: 'generated_model',
    contents: contents as any,
    queryList: [],
    dependencies: {},
    exports: [],
  })
  let compiled = qm.compileQuery(malloyQuery)
  return compiled.sql
}

export function getHover (path: string, line: number, col: number): string {
  let fi = FILE_MAP[path]
  let offset = getOffset(line, col, fi)

  // walk up until we find a node with an entity
  let node = fi.tree!.resolve(offset)
  let entity = getNodeEntity(node)
  while (!entity && node.parent) {
    node = node.parent
    entity = getNodeEntity(node)
  }

  if (!entity) return ''
  if (entity.entityType == 'field') {
    let desc = entity.field.metadata?.description ? `\n\n${entity.field.metadata.description}` : ''
    return `#### ${entity.table.name}.${entity.field.name}${desc}`
  }

  if (entity.entityType == 'table') {
    let desc = entity.table.metadata?.description ? `\n\n${entity.table.metadata.description}` : ''
    return `#### ${entity.table.name}${desc}`
  }
  return ''
}

// Malloy doesn't provide a dialect for BigQuery, so create one.
class BigQueryDialect extends StandardSQLDialect {
  constructor () {
    super()
    this.name = 'bigquery'
  }

  getDialectFunctions (): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(BIGQUERY_DIALECT_FUNCTIONS)
  }
}
registerDialect(new BigQueryDialect())
