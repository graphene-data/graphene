import {analyzeQuery, analyzeTableFully, applyExtends, createAnalysisContext, findTables, recordSyntaxErrors} from './analyze.ts'
import {config, loadConfig} from './config.ts'
import {parseMarkdown} from './markdown.ts'
import {fillInParams} from './params.ts'
import {parser} from './parser.js'
import {type AnalysisFileInput, type AnalysisInput, type WorkspaceAnalysis, type FileInfo, type Location, type Query} from './types.ts'
import {getSourceOffset} from './util.ts'

export {config, loadConfig}
export type {AnalysisFileInput, AnalysisInput, AnalysisOptions, WorkspaceAnalysis as AnalysisResult, Query, Table, GrapheneError} from './types.ts'

function createFileInfo(input: AnalysisFileInput): FileInfo {
  return {
    path: input.path,
    contents: input.contents,
    tree: null,
    tables: [],
    queries: [],
    navigation: {symbols: [], references: []},
  }
}

function isMarkdownFile(file: AnalysisFileInput) {
  if (file.contentType) return file.contentType == 'md'
  return file.path.endsWith('.md')
}

// Pure analysis API. Callers provide files and options explicitly and receive the full analyzed result.
export function analyzeProject(input: AnalysisInput): WorkspaceAnalysis {
  let files = Object.fromEntries(input.files.map(file => [file.path, createFileInfo(file)]))
  let ctx = createAnalysisContext(files, input.options)

  for (let inputFile of input.files) {
    let fi = files[inputFile.path]
    fi.navigation = {symbols: [], references: []}
    fi.tree = isMarkdownFile(inputFile) ? parseMarkdown(fi) : parser.parse(fi.contents)
    fi.tree.fileInfo = fi
    recordSyntaxErrors(ctx, fi)
    findTables(ctx, fi)
  }

  Object.values(files).forEach(fi => applyExtends(ctx, fi))
  if (input.targetPath && files[input.targetPath]) {
    let fi = files[input.targetPath]
    fi.tables.forEach(table => analyzeTableFully(ctx, table))
    let nodes = fi.tree!.topNode.getChildren('QueryStatement') || []
    fi.queries = nodes.map(node => analyzeQuery(ctx, node)).filter((query): query is Query => !!query)
  } else {
    Object.values(files)
      .flatMap(f => f.tables)
      .forEach(table => analyzeTableFully(ctx, table))
    Object.values(files).forEach(fi => {
      let nodes = fi.tree!.topNode.getChildren('QueryStatement') || []
      fi.queries = nodes.map(node => analyzeQuery(ctx, node)).filter((query): query is Query => !!query)
    })
  }

  return {
    files,
    diagnostics: ctx.diagnostics,
    queries: input.targetPath ? files[input.targetPath]?.queries || [] : [],
  }
}

export function toSql(query: Query, params: Record<string, any> = {}): string {
  query = structuredClone(query)
  fillInParams(query, params)
  return query.sql
}

export function getTable(result: WorkspaceAnalysis, name: string) {
  return Object.values(result.files)
    .flatMap(file => file.tables)
    .find(table => table.name == name)
}

export function getFile(result: WorkspaceAnalysis, name: string) {
  return result.files[name]
}

export function getFiles(result: WorkspaceAnalysis) {
  return Object.values(result.files)
}

function findColumn(result: WorkspaceAnalysis, symbolId: string) {
  for (let file of Object.values(result.files)) {
    for (let table of file.tables) {
      let column = table.columns.find(col => col.symbolId == symbolId)
      if (column) return {table, column}
    }
  }
  return null
}

function findTableBySymbol(result: WorkspaceAnalysis, symbolId: string) {
  return Object.values(result.files)
    .flatMap(file => file.tables)
    .find(table => table.symbolId == symbolId)
}

function getNavigationTarget(result: WorkspaceAnalysis, path: string, line: number, col: number) {
  let fi = result.files[path]
  if (!fi) return null

  let offset = getSourceOffset(line, col, fi)
  let reference = fi.navigation.references.find(ref => containsOffset(ref.location, offset))
  if (reference) {
    return Object.values(result.files)
      .flatMap(file => file.navigation.symbols)
      .find(symbol => symbol.id == reference.targetId)
  }

  return fi.navigation.symbols.find(symbol => containsOffset(symbol.location, offset)) || null
}

export function getHover(result: WorkspaceAnalysis, path: string, line: number, col: number): string {
  let symbol = getNavigationTarget(result, path, line, col)
  if (!symbol) return ''

  if (symbol.kind == 'column') {
    let entity = findColumn(result, symbol.id)
    if (!entity) return ''
    let desc = entity.column.metadata?.description ? `\n\n${entity.column.metadata.description}` : ''
    return `#### ${entity.table.name}.${entity.column.name}${desc}`
  }

  let table = findTableBySymbol(result, symbol.id)
  if (!table) return ''
  let desc = table.metadata?.description ? `\n\n${table.metadata.description}` : ''
  return `#### ${table.name}${desc}`
}

export function getDefinition(result: WorkspaceAnalysis, path: string, line: number, col: number): Location | null {
  let symbol = getNavigationTarget(result, path, line, col)
  return symbol?.location || null
}

export function getReferences(result: WorkspaceAnalysis, path: string, line: number, col: number, includeDeclaration = false): Location[] {
  let symbol = getNavigationTarget(result, path, line, col)
  if (!symbol) return []

  let references = Object.values(result.files).flatMap(file => file.navigation.references.filter(ref => ref.targetId == symbol.id).map(ref => ref.location))
  if (includeDeclaration) return [symbol.location, ...references]
  return references
}

function containsOffset(location: Location, offset: number) {
  return offset >= location.from.offset && offset <= location.to.offset
}
