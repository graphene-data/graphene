
import malloy from '../node_modules/@malloydata/malloy/dist/model/index.js'
import {readFile, readdir} from 'fs/promises'
import path from 'path'
import {FILE_MAP, analyzeTable, analyzeQuery, findTables, clearWorkspace, diagnostics, clearDiagnostics} from './analyze.ts'
import {parser} from './parser.js'
import {type Query} from './types.ts'

export {clearWorkspace}
export type {Query, Table, Diagnostic} from './types.ts'
export function getTable (name: string) { return Object.values(FILE_MAP).flatMap(f => f.tables).find(t => t.name == name) }
export function getFile (name: string) { return FILE_MAP[name] }
export function getFiles () { return Object.values(FILE_MAP) }
export function getDiagnostics () { return diagnostics }

// we also need to support table defs in md files. Eventually handle them natively,
// but for now, maybe we have a silly var thats "tablesDefinedInTheCurrentMdFile". When evidence executes them, store them.
// but how do we know when to clear them?
// if an md file changes, we don't need to re-analyze anything except that md file

// Loads and parses all gsql files within a directory
// TODO: should probably respect gitignore
export async function loadWorkspace (dir:string) {
  for (let entry of await readdir(dir, {withFileTypes: true})) {
    let p = path.join(dir, entry.name)
    if (entry.name == 'node_modules') continue
    if (entry.isDirectory()) await loadWorkspace(p)
    if (entry.name.endsWith('.gsql')) {
      let contents = await readFile(p, 'utf-8')
      updateFile(contents, p)
    }
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
    f.tree.fileInfo = f
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
  // Object.values(TABLE_MAP).forEach(t => t.dialect = 'duckdb')
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
