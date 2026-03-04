import path from 'path'
import {analyze, config, getDiagnostics, loadWorkspace, updateFile} from '../lang/core.ts'
import {printDiagnostics} from './printer.ts'
import {readFileSync} from 'node:fs'
import {mockFileMap} from './mockFiles.ts'
import {normalizeFile} from './normalizeFile.ts'

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

  await loadWorkspace(config.root, !targetFile)
  if (targetFile) {
    if (process.env.NODE_ENV == 'test' && mockFileMap[targetFile]) {
      updateFile(mockFileMap[targetFile], targetFile)
    } else {
      let content = readFileSync(path.resolve(config.root, targetFile), 'utf-8')
      updateFile(content, targetFile)
    }
  }

  analyze()
  if (getDiagnostics().length > 0) {
    printDiagnostics(getDiagnostics(), log)
    return false
  }

  log('No errors found 💎')
  return true
}
