import {type DialectFunctionOverloadDef, registerDialect, StandardSQLDialect, QueryModel, expandBlueprintMap} from '@graphenedata/malloy'
import {readFile} from 'node:fs/promises'
import {glob} from 'glob'
import {FILE_MAP, analyzeQuery, findTables, clearWorkspace, diagnostics, clearDiagnostics, getNodeEntity, recordSyntaxErrors, analyzeTable, applyExtends} from './analyze.ts'
import {type Query} from './types.ts'
import {fillInParams} from './params.ts'
import {getOffset} from './util.ts'
import {config, loadConfig} from './config.ts'
import path from 'node:path'
import {BIGQUERY_DIALECT_FUNCTIONS} from './functionDefs.ts'
import {parser} from './parser.js'
import {parseMarkdown} from './markdown.ts'
import {uppercaseMalloyQuery, uppercaseTable} from './snowflake.ts'

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
  let files = await glob(includeMd ? '**/*.{gsql,md}' : '**/*.gsql', {cwd: dir, ignore: ['node_modules/**'], follow: false})
  for await (let file of files) {
    try {
      let contents = await readFile(path.join(dir, file), 'utf-8')
      updateFile(contents, file)
    } catch (e:any) { // can fail if a file is a broken symlink
      console.error('Failed to read file', file, e.message)
    }
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
    findTables(fi) // for now, blow away previously analyzed tables
  })

  Object.values(FILE_MAP).forEach(applyExtends) // Then extend those tables

  // analyze all fields on all tables
  // TODO: we don't _need_ to do this if you provided contents. We could omit this and get lazy analysis
  Object.values(FILE_MAP).flatMap(f => f.tables).forEach(analyzeTable)

  if (contents) {
    let fi =  FILE_MAP['input']
    let nodes = fi.tree!.topNode.getChildren('QueryStatement') || []
    fi.queries = nodes.map(analyzeQuery).filter((q): q is Query => !!q)
    return fi.queries
  } else {
    return []
  }
}

export function toSql (query: Query, params: Record<string, any> = {}): string {
  if (query.rawSql) return query.rawSql

  // contents is what Malloy calls all the sources (tables and views) used when compiling.
  // These are mostly ready from analysis, but we make a few modifications the structure here, so we operate on a clone
  let contents = Object.fromEntries(Object.values(FILE_MAP).flatMap(fi => {
    return fi.tables.map(t => {
      t = structuredClone(t)
      if (fi.path == 'input' && t.query) fillInParams(t.query, params)
      if (config.dialect == 'snowflake') uppercaseTable(t)
      return [t.name, t]
    })
  }))

  // Same deal for the query: make a clone, prepare it for passing to Malloy.
  query = structuredClone(query)
  fillInParams(query, params)
  if (config.dialect == 'snowflake') uppercaseMalloyQuery(query)

  // structRef is Malloy parlance for the table on which a query is based. Malloy expects this to be a Table (more or less),
  // but for convenience we store just that table's name in `baseTableName`. Here, we look up that name and set the actual structRef.
  // We do it as late as possible so we can be sure we give it the right object (ie after filling params, converting to uppercase, etc)
  // We must set structRef recursively because join fields embed entire table structures (including nested joins with queries).
  let visited = new Set()
  function setStructRefs (obj: any) {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return
    visited.add(obj)
    if (obj.baseTableName && obj.pipeline) obj.structRef = contents[obj.baseTableName] // looks like a query
    if (obj.query) setStructRefs(obj.query) // View query
    if (obj.fields) for (let f of obj.fields) setStructRefs(f) // recurse through all fields
  }
  Object.values(contents).forEach(setStructRefs)
  setStructRefs(query)

  let qm = new QueryModel({
    name: 'generated_model',
    contents: contents as any,
    queryList: [],
    dependencies: {},
    exports: [],
  })
  return qm.compileQuery(query).sql
}

export function getHover (path: string, line: number, col: number): string {
  let fi = FILE_MAP[path]
  let offset = getOffset(line, col, fi)

  // TODO: if you hover while we're analyzing, should wait for analysis to finish, then return the entity.
  // I think LSP has a way to make returning the hover async, but it's not obvious, and this seems rare.
  if (!fi.tree) return ''

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
