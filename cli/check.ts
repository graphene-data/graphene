import {readFileSync} from 'node:fs'
import path from 'path'

import {analyzeProject, config} from '../lang/core.ts'
import {listWorkspaceFiles, loadWorkspaceFiles, toAnalysisOptions, updateWorkspaceFile} from '../lang/workspace.ts'
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

  let files = await loadWorkspaceFiles(config.root, !targetFile, config.ignoredFiles)
  if (process.env.NODE_ENV == 'test') {
    for (let [mockPath, contents] of Object.entries(mockFileMap)) {
      if (targetFile && (mockPath == targetFile || mockPath.endsWith('.md'))) continue
      updateWorkspaceFile(files, contents, mockPath, mockPath.endsWith('.md') ? 'md' : 'gsql')
    }
  }

  if (targetFile) {
    if (process.env.NODE_ENV == 'test' && mockFileMap[targetFile]) {
      updateWorkspaceFile(files, mockFileMap[targetFile], targetFile, targetFile.endsWith('.md') ? 'md' : 'gsql')
    } else {
      let content = readFileSync(path.resolve(config.root, targetFile), 'utf-8')
      updateWorkspaceFile(files, content, targetFile, targetFile.endsWith('.md') ? 'md' : 'gsql')
    }
  }

  let result = analyzeProject({files: listWorkspaceFiles(files), options: toAnalysisOptions(config)})
  if (result.diagnostics.length > 0) {
    printDiagnostics(result.diagnostics, log)
    return false
  }

  log('No errors found 💎')
  return true
}
