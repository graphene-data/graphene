import {readFileSync} from 'node:fs'
import path from 'path'

import type {WorkspaceFileInput} from '../lang/types.ts'

import {config} from '../lang/config.ts'
import {analyzeWorkspace, loadWorkspace} from '../lang/core.ts'
import {mockFileMap} from './mockFiles.ts'
import {normalizeFile} from './normalizeFile.ts'
import {printDiagnostics} from './printer.ts'
import {getWorkspaceScanCounts, type CliTelemetry} from './telemetry/index.ts'

interface CheckOptions {
  fileArg?: string
  log?: (...args: any[]) => void
  telemetry?: CliTelemetry
}

export async function check(options: CheckOptions): Promise<boolean> {
  let log = options.log || console.log
  let targetFile = options.fileArg && normalizeFile(options.fileArg)

  if (options.fileArg && !targetFile) {
    log(`Couldn't find ${options.fileArg}`)
    return false
  }

  let files = await loadWorkspace(config.root, !targetFile, config.ignoredFiles)
  options.telemetry?.event('workspace_scanned', {command: 'check', ...getWorkspaceScanCounts(files)})
  if (process.env.NODE_ENV == 'test') {
    for (let [path, contents] of Object.entries(mockFileMap)) {
      if (targetFile && path != targetFile) continue
      upsertFile(files, {path, contents})
    }
  }
  if (targetFile) {
    let contents: string
    if (process.env.NODE_ENV == 'test' && mockFileMap[targetFile]) {
      contents = mockFileMap[targetFile]
    } else {
      contents = readFileSync(path.resolve(config.root, targetFile), 'utf-8')
    }
    upsertFile(files, {path: targetFile, contents})
  }

  let result = analyzeWorkspace({config, files})
  if (result.diagnostics.length > 0) {
    printDiagnostics(result.diagnostics, log)
    return false
  }

  log('No errors found 💎')
  return true
}

function upsertFile(files: WorkspaceFileInput[], next: WorkspaceFileInput) {
  let idx = files.findIndex(file => file.path == next.path)
  if (idx >= 0) files[idx] = next
  else files.push(next)
}
