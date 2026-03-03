import {readFile} from 'node:fs/promises'
import {glob} from 'glob'
import {FILE_MAP, analyzeQuery, findTables, clearWorkspace, diagnostics, clearDiagnostics, getNodeEntity, recordSyntaxErrors, analyzeTableFully, applyExtends} from './analyze.ts'
import {type Query} from './types.ts'
import {fillInParams} from './params.ts'
import {getOffset} from './util.ts'
import {config, loadConfig} from './config.ts'
import path from 'node:path'
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
export async function loadWorkspace(dir: string, includeMd: boolean) {
  let ignore = ['node_modules/**', '**/.*/**', ...config.ignoredFiles]
  let files = await glob(includeMd ? '**/*.{gsql,md}' : '**/*.gsql', {cwd: dir, ignore, follow: false})
  for await (let file of files) {
    try {
      let contents = await readFile(path.join(dir, file), 'utf-8')
      updateFile(contents, file)
    } catch (e: any) {
      console.error('Failed to read file', file, e.message)
    }
  }
}

export function updateFile (contents: string, path: string) {
  FILE_MAP[path] ||= {path, contents, tree: null, tables: [], queries: []}
  FILE_MAP[path].contents = contents
  FILE_MAP[path].tree = null
  return FILE_MAP[path]
}

// Analyze all files in the workspace. If content is provided, it's added as a virtual 'input' file and its queries are returned.
export function analyze (contents?: string, contentType?: 'gsql' | 'md'): Query[] {
  clearDiagnostics()

  delete FILE_MAP['input']
  if (contents) updateFile(contents, 'input')

  Object.values(FILE_MAP).forEach(fi => {
    let isMd = fi.path.endsWith('.md') || (fi.path == 'input' && contentType == 'md')
    fi.tree ||= isMd ? parseMarkdown(fi) : parser.parse(fi.contents)
    fi.tree!.fileInfo = fi
    recordSyntaxErrors(fi)
    findTables(fi)
  })
  Object.values(FILE_MAP).forEach(applyExtends)

  if (contents) {
    let fi = FILE_MAP['input']
    fi.tables.forEach(analyzeTableFully)
    let nodes = fi.tree!.topNode.getChildren('QueryStatement') || []
    fi.queries = nodes.map(n => analyzeQuery(n)).filter((q): q is Query => !!q)
    return fi.queries
  }

  Object.values(FILE_MAP).flatMap(f => f.tables).forEach(analyzeTableFully)
  return []
}

export function toSql (query: Query, params: Record<string, any> = {}): string {
  query = structuredClone(query)
  if (config.dialect == 'snowflake') uppercaseQuery(query)
  fillInParams(query, params)
  return query.sql
}

function uppercaseQuery (query: Query) {
  query.sql = query.sql.replace(/"([^"]+)"/g, (_, name) => `"${name.toUpperCase()}"`)
}

export function getHover (path: string, line: number, col: number): string {
  let fi = FILE_MAP[path]
  let offset = getOffset(line, col, fi)

  if (!fi.tree) return ''

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
