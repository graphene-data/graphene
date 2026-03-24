import {glob} from 'glob'
import {readFile} from 'node:fs/promises'
import path from 'node:path'

import {config} from './config.ts'
import {type AnalysisFileInput, type AnalysisOptions} from './types.ts'

export function toAnalysisOptions(options: Partial<AnalysisOptions> = config): AnalysisOptions {
  return {dialect: options.dialect || 'duckdb', defaultNamespace: options.defaultNamespace}
}

export async function loadWorkspaceFiles(dir: string, includeMd: boolean): Promise<Record<string, AnalysisFileInput>> {
  let ignore = ['node_modules/**', '**/.*/**', ...(config.ignoredFiles || [])]
  let paths = await glob(includeMd ? '**/*.{gsql,md}' : '**/*.gsql', {cwd: dir, ignore, follow: false})
  let files: Record<string, AnalysisFileInput> = {}

  for await (let file of paths) {
    try {
      files[file] = {path: file, contents: await readFile(path.join(dir, file), 'utf-8')}
    } catch (e: any) {
      console.error('Failed to read file', file, e.message)
    }
  }

  return files
}

export function updateWorkspaceFile(files: Record<string, AnalysisFileInput>, contents: string, filePath: string, contentType?: 'gsql' | 'md') {
  files[filePath] = {path: filePath, contents, contentType}
}

export function deleteWorkspaceFile(files: Record<string, AnalysisFileInput>, filePath: string) {
  delete files[filePath]
}

export function listWorkspaceFiles(files: Record<string, AnalysisFileInput>) {
  return Object.values(files)
}
