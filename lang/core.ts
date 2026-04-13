import {glob} from 'glob'
import {readFile} from 'node:fs/promises'
import path from 'node:path'

import type {GrapheneError} from './index.d.ts'

import {analyzeWorkspace} from './analyze.ts'
import {fillInParams} from './params.ts'
import {type AnalysisResult, type Location, type Query, type WorkspaceFileInput} from './types.ts'
import {getSourceOffset} from './util.ts'

export {analyzeWorkspace}
export type {GrapheneError} from './index.d.ts'
export type {AnalysisResult, AnalysisWorkspace, FileInfo, Query, Table, WorkspaceFileInput} from './types.ts'

export async function loadWorkspace(dir: string, includeMd: boolean, ignoredFiles: string[] = []): Promise<WorkspaceFileInput[]> {
  let ignore = ['node_modules/**', '**/.*/**', ...ignoredFiles]
  let paths = await glob(includeMd ? '**/*.{gsql,md}' : '**/*.gsql', {cwd: dir, ignore, follow: false})
  let files: WorkspaceFileInput[] = []

  for await (let file of paths) {
    try {
      let contents = await readFile(path.join(dir, file), 'utf-8')
      files.push({path: file, contents})
    } catch (err: any) {
      console.error('Failed to read file', file, err.message)
    }
  }

  return files
}

export function getTable(analysis: AnalysisResult, name: string) {
  return analysis.files.flatMap(file => file.tables).find(table => table.name == name)
}

export function getFile(analysis: AnalysisResult, name: string) {
  return analysis.files.find(file => file.path == name)
}

export function getFiles(analysis: AnalysisResult) {
  return analysis.files
}

export function getDiagnostics(analysis: AnalysisResult): GrapheneError[] {
  return analysis.diagnostics
}

export function getHover(analysis: AnalysisResult, path: string, line: number, col: number): string {
  let symbol = getNavigationTarget(analysis, path, line, col)
  return symbol?.hover || ''
}

export function getDefinition(analysis: AnalysisResult, path: string, line: number, col: number): Location | null {
  let symbol = getNavigationTarget(analysis, path, line, col)
  return symbol?.location || null
}

export function getReferences(analysis: AnalysisResult, path: string, line: number, col: number, includeDeclaration = false): Location[] {
  let symbol = getNavigationTarget(analysis, path, line, col)
  if (!symbol) return []

  let references = analysis.files.flatMap(file => file.navigation.references.filter(ref => ref.targetId == symbol.id).map(ref => ref.location))
  if (includeDeclaration) return [symbol.location, ...references]
  return references
}

function getNavigationTarget(analysis: AnalysisResult, path: string, line: number, col: number) {
  let file = getFile(analysis, path)
  if (!file) return null

  let offset = getSourceOffset(line, col, file)
  let reference = file.navigation.references.find(ref => containsOffset(ref.location, offset))
  if (reference) {
    return analysis.files.flatMap(next => next.navigation.symbols).find(symbol => symbol.id == reference.targetId)
  }

  return file.navigation.symbols.find(symbol => containsOffset(symbol.location, offset)) || null
}

function containsOffset(location: Location, offset: number) {
  return offset >= location.from.offset && offset <= location.to.offset
}

export function toSql(query: Query, params: Record<string, any> = {}): string {
  query = structuredClone(query)
  fillInParams(query, params)
  return query.sql
}
