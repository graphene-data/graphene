import {readFileSync} from 'node:fs'
import path from 'path'

import {analysisOptions, analyzeProject, config, loadWorkspace, type AnalysisFileInput} from '../lang/core.ts'
import {mockFileMap} from './mockFiles.ts'
import {normalizeFile} from './normalizeFile.ts'
import {printDiagnostics} from './printer.ts'

interface CheckOptions {
  fileArg?: string
  log?: (...args: any[]) => void
}

export async function check(options: CheckOptions): Promise<boolean> {
  let log = options.log || console.log
  let targetFile = options.fileArg && normalizeFile(options.fileArg)

  if (options.fileArg && !targetFile) {
    log(`Couldn't find ${options.fileArg}`)
    return false
  }

  let files = withMockFiles(await loadWorkspace(config.root, !targetFile), !targetFile)
  if (targetFile) {
    let contents = process.env.NODE_ENV == 'test' && mockFileMap[targetFile] ? mockFileMap[targetFile] : readFileSync(path.resolve(config.root, targetFile), 'utf-8')
    files = upsertFile(files, {path: targetFile, contents})
  }

  let result = analyzeProject({files, options: analysisOptions()})
  if (result.diagnostics.length > 0) {
    printDiagnostics(result.diagnostics, result.files, log)
    return false
  }

  log('No errors found 💎')
  return true
}

function upsertFile(files: AnalysisFileInput[], nextFile: AnalysisFileInput) {
  return [...files.filter(file => file.path != nextFile.path), nextFile]
}

function withMockFiles(files: AnalysisFileInput[], includeMd: boolean) {
  if (process.env.NODE_ENV != 'test') return files
  return Object.entries(mockFileMap).reduce((acc, [path, contents]) => {
    if (!includeMd && path.endsWith('.md')) return acc
    return upsertFile(acc, {path, contents})
  }, files)
}
