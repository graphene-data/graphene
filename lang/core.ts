import {glob} from 'glob'
import {readFile} from 'node:fs/promises'
import path from 'node:path'

import {analyzeQuery, analyzeTableFully, applyExtends, createAnalysisContext, findTables, recordSyntaxErrors} from './analyze.ts'
import {config, loadConfig} from './config.ts'
import {parseMarkdown} from './markdown.ts'
import {fillInParams} from './params.ts'
import {parser} from './parser.js'
import {type AnalysisFileInput, type AnalysisInput, type AnalysisOptions, type AnalysisResult, type FileInfo, type Location, type Query, type Table} from './types.ts'
import {getSourceOffset} from './util.ts'

export {config, loadConfig}
export type {AnalysisFileInput, AnalysisInput, AnalysisOptions, AnalysisResult, Query, Table, GrapheneError} from './types.ts'

// `analyzeProject(...)` is the real pure API now. These module-level values only exist
// to preserve the older stateful `core.ts` interface used by the CLI/tests/IDE helpers:
// callers mutate a workspace snapshot with `updateFile/loadWorkspace`, then `analyze()`
// materializes a fresh pure result and stores it here for the legacy getter functions.
let legacyWorkspace: Record<string, FileInfo> = {}
let legacyResult: AnalysisResult = {files: {}, diagnostics: [], queries: []}

function toAnalysisOptions(options: Partial<AnalysisOptions> = config): AnalysisOptions {
  return {dialect: options.dialect || 'duckdb', defaultNamespace: options.defaultNamespace}
}

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
export function analyzeProject(input: AnalysisInput): AnalysisResult {
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

export function clearWorkspace() {
  legacyWorkspace = {}
  legacyResult = {files: {}, diagnostics: [], queries: []}
}

// Loads all gsql files within a directory into the legacy workspace state.
export async function loadWorkspace(dir: string, includeMd: boolean) {
  let ignore = ['node_modules/**', '**/.*/**', ...(config.ignoredFiles || [])]
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

export function updateFile(contents: string, path: string, contentType?: 'gsql' | 'md') {
  legacyWorkspace[path] ||= createFileInfo({path, contents, contentType})
  Object.assign(legacyWorkspace[path], {
    contents,
    tree: null,
    tables: [],
    queries: [],
    navigation: {symbols: [], references: []},
  })
  delete legacyWorkspace[path].virtualContents
  delete legacyWorkspace[path].virtualToMarkdownOffset
  return legacyWorkspace[path]
}

export function deleteFile(path: string) {
  delete legacyWorkspace[path]
  if (legacyResult.files[path]) {
    let files = {...legacyResult.files}
    delete files[path]
    legacyResult = {...legacyResult, files}
  }
}

// Legacy compatibility wrapper. If content is provided, it is analyzed as a temporary "input" file.
export function analyze(contents?: string, contentType?: 'gsql' | 'md'): Query[] {
  let files = Object.values(legacyWorkspace).map(fi => ({path: fi.path, contents: fi.contents, contentType: fi.path.endsWith('.md') ? 'md' : 'gsql'}) as AnalysisFileInput)
  let targetPath: string | undefined

  if (contents != null) {
    targetPath = 'input'
    files.push({path: 'input', contents, contentType})
  }

  legacyResult = analyzeProject({files, targetPath, options: toAnalysisOptions()})
  for (let [path, fi] of Object.entries(legacyResult.files)) {
    if (path == 'input') continue
    legacyWorkspace[path] = fi
  }
  return legacyResult.queries
}

export function toSql(query: Query, params: Record<string, any> = {}): string {
  query = structuredClone(query)
  fillInParams(query, params)
  return query.sql
}

function currentFiles(result?: AnalysisResult) {
  if (result) return result.files
  return {...legacyWorkspace, ...legacyResult.files}
}

export function getDiagnostics() {
  return legacyResult.diagnostics
}

export function getTable(name: string): Table | undefined
export function getTable(result: AnalysisResult, name: string): Table | undefined
export function getTable(arg1: string | AnalysisResult, arg2?: string) {
  let [result, name] = typeof arg1 == 'string' ? [undefined, arg1] : [arg1, arg2!]
  return Object.values(currentFiles(result))
    .flatMap(file => file.tables)
    .find(table => table.name == name)
}

export function getFile(name: string): FileInfo | undefined
export function getFile(result: AnalysisResult, name: string): FileInfo | undefined
export function getFile(arg1: string | AnalysisResult, arg2?: string) {
  let [result, name] = typeof arg1 == 'string' ? [undefined, arg1] : [arg1, arg2!]
  return currentFiles(result)[name]
}

export function getFiles(): FileInfo[]
export function getFiles(result: AnalysisResult): FileInfo[]
export function getFiles(result?: AnalysisResult) {
  return Object.values(currentFiles(result))
}

function findColumn(result: AnalysisResult, symbolId: string) {
  for (let file of Object.values(result.files)) {
    for (let table of file.tables) {
      let column = table.columns.find(col => col.symbolId == symbolId)
      if (column) return {table, column}
    }
  }
  return null
}

function findTableBySymbol(result: AnalysisResult, symbolId: string) {
  return Object.values(result.files)
    .flatMap(file => file.tables)
    .find(table => table.symbolId == symbolId)
}

function getNavigationTarget(result: AnalysisResult, path: string, line: number, col: number) {
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

export function getHover(path: string, line: number, col: number): string
export function getHover(result: AnalysisResult, path: string, line: number, col: number): string
export function getHover(arg1: string | AnalysisResult, arg2: string | number, arg3?: number, arg4?: number) {
  let [result, path, line, col] = typeof arg1 == 'string' ? [legacyResult, arg1, arg2 as number, arg3 as number] : [arg1, arg2 as string, arg3 as number, arg4 as number]
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

export function getDefinition(path: string, line: number, col: number): Location | null
export function getDefinition(result: AnalysisResult, path: string, line: number, col: number): Location | null
export function getDefinition(arg1: string | AnalysisResult, arg2: string | number, arg3?: number, arg4?: number) {
  let [result, path, line, col] = typeof arg1 == 'string' ? [legacyResult, arg1, arg2 as number, arg3 as number] : [arg1, arg2 as string, arg3 as number, arg4 as number]
  let symbol = getNavigationTarget(result, path, line, col)
  return symbol?.location || null
}

export function getReferences(path: string, line: number, col: number, includeDeclaration?: boolean): Location[]
export function getReferences(result: AnalysisResult, path: string, line: number, col: number, includeDeclaration?: boolean): Location[]
export function getReferences(arg1: string | AnalysisResult, arg2: string | number, arg3?: number, arg4?: number | boolean, arg5?: boolean) {
  let [result, path, line, col, includeDeclaration] =
    typeof arg1 == 'string' ? [legacyResult, arg1, arg2 as number, arg3 as number, (arg4 as boolean) || false] : [arg1, arg2 as string, arg3 as number, arg4 as number, arg5 || false]
  let symbol = getNavigationTarget(result, path, line, col)
  if (!symbol) return []

  let references = Object.values(result.files).flatMap(file => file.navigation.references.filter(ref => ref.targetId == symbol.id).map(ref => ref.location))
  if (includeDeclaration) return [symbol.location, ...references]
  return references
}

function containsOffset(location: Location, offset: number) {
  return offset >= location.from.offset && offset <= location.to.offset
}
