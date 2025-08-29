
import * as malloy from './node_modules/@malloydata/malloy/dist/model/index.js'
import {StandardSQLDialect} from './node_modules/@malloydata/malloy/dist/dialect/standardsql/index.js'
import {registerDialect} from './node_modules/@malloydata/malloy/dist/dialect/dialect_map.js'
import {readFile, glob} from 'node:fs/promises'
import {FILE_MAP, analyzeTable, analyzeQuery, findTables, clearWorkspace, diagnostics, clearDiagnostics, getNodeEntity} from './analyze.ts'
import {parser} from './parser.js'
import {type Query} from './types.ts'
import {getOffset} from './util.ts'
import { config,loadConfig } from './config.ts'

export {clearWorkspace}
export {config}
export type {Query, Table, Diagnostic} from './types.ts'
export function getTable (name: string) { return Object.values(FILE_MAP).flatMap(f => f.tables).find(t => t.name == name) }
export function getFile (name: string) { return FILE_MAP[name] }
export function getFiles () { return Object.values(FILE_MAP) }
export function getDiagnostics () { return diagnostics }

// Loads and parses all gsql files within a directory
export async function loadWorkspace (dir:string) {
  await loadConfig(dir)

  for await (let file of glob('**/*.gsql', {cwd: dir})) {
    let contents = await readFile(file, 'utf-8')
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

// Analyzes all tables and queries in all files. You can optionally provide a file,
// which is useful in the case where you want to know the queries in that file.
// This could be more efficient, but for now we just re-analyze everything.
export function analyze (contents?: string, path?: string): Query[] {
  let fi = contents ? updateFile(contents, path || 'input') : null
  clearDiagnostics()

  Object.values(FILE_MAP).forEach(f => {
    f.tables = [] // clear out everything we've computed for now
    f.tree ||= parser.parse(f.contents)
    f.tree!.fileInfo = f
    f.tables = findTables(f)
  })
  Object.values(FILE_MAP).flatMap(f => f.tables).forEach(analyzeTable)

  // if you provided a file, we'll give you back the queries in it
  let queries = fi?.tree?.topNode.getChildren('QueryStatement') || []
  return queries.map(analyzeQuery).filter(q => !!q)
}

export function toSql (query: Query): string {
  // queryModel contents should be all the tables from gsql files, and any from the same md file as the query
  let contents = {}
  Object.values(FILE_MAP).forEach(f => f.tables.forEach(t => contents[t.name] = t))
  query.subQuerySources.forEach(t => contents[t.name] = t)

  // Send the query to malloy for generation
  let qm = new malloy.QueryModel({
    name: 'generated_model',
    contents: contents as any,
    queryList: [],
    dependencies: {},
    exports: [],
  })
  let compiled = qm.compileQuery(query.malloyQuery)
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

class BigQueryDialect extends StandardSQLDialect {
  constructor() {
    super()
    this.name = 'bigquery'
  }
}
registerDialect(new BigQueryDialect())
