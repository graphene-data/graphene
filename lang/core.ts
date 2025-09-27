
import * as malloy from './node_modules/@malloydata/malloy/dist/model/index.js'
import {StandardSQLDialect} from './node_modules/@malloydata/malloy/dist/dialect/standardsql/index.js'
import {registerDialect} from './node_modules/@malloydata/malloy/dist/dialect/dialect_map.js'
import {expandBlueprintMap} from './node_modules/@malloydata/malloy/dist/dialect/functions/index.js'
import {readFile} from 'node:fs/promises'
import {glob} from 'glob'
import {FILE_MAP, analyzeTable, analyzeQuery, findTables, clearWorkspace, diagnostics, clearDiagnostics, getNodeEntity, recordSyntaxErrors} from './analyze.ts'
import {type Query} from './types.ts'
import {fillInParams} from './params.ts'
import {getOffset} from './util.ts'
import {config, loadConfig} from './config.ts'
import path from 'node:path'
import {type DialectFunctionOverloadDef} from '@malloydata/malloy'
import {BIGQUERY_DIALECT_FUNCTIONS} from './functions.ts'
import {parser} from './parser.js'
import {parseMarkdown} from './markdown.ts'

export {clearWorkspace}
export {config, loadConfig}
export type {Query, Table, Diagnostic} from './types.ts'
export function getTable (name: string) { return Object.values(FILE_MAP).flatMap(f => f.tables).find(t => t.name == name) }
export function getFile (name: string) { return FILE_MAP[name] }
export function getFiles () { return Object.values(FILE_MAP) }
export function getDiagnostics () { return diagnostics }

// Loads and parses all gsql files within a directory
export async function loadWorkspace (dir:string, includeMd: boolean) {
  // It'd be inefficient for `graphene serve` to watch all md files, since we always treat the running page as `input`.
  // But we do want to watch md files for the vscode extension and `graphene check`
  let files = await glob(includeMd ? '**/*.{gsql,md}' : '**/*.gsql', {cwd: dir})
  for await (let file of files) {
    let contents = await readFile(path.join(dir, file), 'utf-8')
    updateFile(contents, file)
  }
}

// when a file changes, it's parse tree becomes invalid.
export function updateFile (contents: string, path: string) {
  FILE_MAP[path] ||= {path, contents, tree: null, tables: [], queries: []}
  FILE_MAP[path].contents = contents
  FILE_MAP[path].tree = null
  return FILE_MAP[path]
}

// Analyzes all gsql files in the workspace, and optionally any gsql provided.
// This could be more efficient, but for now we just re-analyze everything.
export function analyze (contents?: string, type?: 'gsql' | 'md'): Query[] {
  clearDiagnostics()

  // if you provided contents, we'll analyze it and give you the queries without saving to the workspace
  delete FILE_MAP['input'] // clean up any previous input
  if (contents) updateFile(contents, 'input')

  // First, parse and identify tables in the workspace
  Object.values(FILE_MAP).forEach(fi => {
    let isMd = fi.path.endsWith('.md') || (fi.path == 'input' && type == 'md')
    fi.tree ||= isMd ? parseMarkdown(fi) : parser.parse(fi.contents)
    fi.tree!.fileInfo = fi
    recordSyntaxErrors(fi)
    fi.tables = findTables(fi) // for now, blow away previously analyzed tables
  })

  // Second, analyze all those tables
  Object.values(FILE_MAP).flatMap(f => f.tables).forEach(analyzeTable)

  // Finally, analyze any queries
  Object.values(FILE_MAP).forEach(fi => {
    let nodes = fi.tree!.topNode.getChildren('QueryStatement') || []
    fi.queries = nodes.map(analyzeQuery).filter(q => !!q)
  })

  return contents ? FILE_MAP['input'].queries : []
}

export function toSql (query: Query, params: Record<string, any> = {}): string {
  let contents = {} // contents is all the tables we need to provide to malloy so it can render the query

  // tables defined in gsql can't have params, so we can copy them right into the contents
  let gsqlTables = Object.values(FILE_MAP).filter(f => f.path !== 'input').flatMap(f => f.tables)
  gsqlTables.forEach(t => contents[t.name] = t)

  // tables in the same md file or a a subquery can all contain params, so we need to give malloy a copy with those params filled in.
  let inputTables = [...FILE_MAP['input']?.tables || [], ...query.subQuerySources]
  inputTables.forEach(t => contents[t.name] = {...t, query: t.query && fillInParams(t.query, params)})

  let malloyQuery = fillInParams(query.malloyQuery, params)
  let qm = new malloy.QueryModel({
    name: 'generated_model',
    contents: contents as any,
    queryList: [],
    dependencies: {},
    exports: [],
  })
  return qm.compileQuery(malloyQuery).sql
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
