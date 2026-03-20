import {glob} from 'glob'
import {readFile} from 'node:fs/promises'
import path from 'node:path'

import {FILE_MAP, analyzeQuery, findTables, clearWorkspace, diagnostics, clearDiagnostics, getNodeEntity, recordSyntaxErrors, analyzeTableFully, applyExtends} from './analyze.ts'
import {config, loadConfig} from './config.ts'
import {parseMarkdown} from './markdown.ts'
import {fillInParams} from './params.ts'
import {parser} from './parser.js'
import {type Query, type Location} from './types.ts'
import {getOffset, getSourceOffset} from './util.ts'

export {clearWorkspace}
export {config, loadConfig}
export type {Query, Table, Diagnostic} from './types.ts'
export function getTable(name: string) {
  return Object.values(FILE_MAP)
    .flatMap(f => f.tables)
    .find(t => t.name == name)
}
export function getFile(name: string) {
  return FILE_MAP[name]
}
export function getFiles() {
  return Object.values(FILE_MAP)
}
export function getDiagnostics() {
  return diagnostics
}

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

export function updateFile(contents: string, path: string) {
  FILE_MAP[path] ||= {path, contents, tree: null, tables: [], queries: [], navigation: {symbols: [], references: []}}
  FILE_MAP[path].contents = contents
  FILE_MAP[path].tree = null
  FILE_MAP[path].navigation = {symbols: [], references: []}
  return FILE_MAP[path]
}

export function deleteFile(path: string) {
  delete FILE_MAP[path]
}

// Analyze all files in the workspace. If content is provided, it's added as a virtual 'input' file and its queries are returned.
export function analyze(contents?: string, contentType?: 'gsql' | 'md'): Query[] {
  clearDiagnostics()

  delete FILE_MAP['input']
  if (contents) updateFile(contents, 'input')

  Object.values(FILE_MAP).forEach(fi => {
    let isMd = fi.path.endsWith('.md') || (fi.path == 'input' && contentType == 'md')
    fi.navigation = {symbols: [], references: []}
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

  Object.values(FILE_MAP)
    .flatMap(f => f.tables)
    .forEach(analyzeTableFully)
  Object.values(FILE_MAP).forEach(fi => {
    let nodes = fi.tree!.topNode.getChildren('QueryStatement') || []
    fi.queries = nodes.map(n => analyzeQuery(n)).filter((q): q is Query => !!q)
  })
  return []
}

export function toSql(query: Query, params: Record<string, any> = {}): string {
  query = structuredClone(query)
  fillInParams(query, params)
  return query.sql
}

export function getHover(path: string, line: number, col: number): string {
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

export function getDefinition(path: string, line: number, col: number): Location | null {
  let symbol = getNavigationTarget(path, line, col)
  return symbol?.location || null
}

export function getReferences(path: string, line: number, col: number, includeDeclaration = false): Location[] {
  let symbol = getNavigationTarget(path, line, col)
  if (!symbol) return []

  let references = Object.values(FILE_MAP).flatMap(file => file.navigation.references.filter(ref => ref.targetId == symbol.id).map(ref => ref.location))
  if (includeDeclaration) return [symbol.location, ...references]
  return references
}

function getNavigationTarget(path: string, line: number, col: number) {
  let fi = FILE_MAP[path]
  if (!fi) return null

  let offset = getSourceOffset(line, col, fi)
  let reference = fi.navigation.references.find(ref => containsOffset(ref.location, offset))
  if (reference) {
    return Object.values(FILE_MAP)
      .flatMap(file => file.navigation.symbols)
      .find(symbol => symbol.id == reference.targetId)
  }

  return fi.navigation.symbols.find(symbol => containsOffset(symbol.location, offset)) || null
}

function containsOffset(location: Location, offset: number) {
  return offset >= location.from.offset && offset <= location.to.offset
}
