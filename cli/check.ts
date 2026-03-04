import fs from 'fs-extra'
import path from 'path'
import {analyze, config, getDiagnostics, loadWorkspace, updateFile} from '../lang/core.ts'
import {printDiagnostics} from './printer.ts'
import {readFileSync} from 'node:fs'
import {mockFileMap} from './mockFiles.ts'

interface CheckOptions {
  fileArg?: string
  mdArg?: string
  log?: (...args: any[]) => void
}

export async function check (options: CheckOptions): Promise<boolean> {
  let log = options.log || console.log
  let fileArg = options.fileArg || options.mdArg
  let targetFile = fileArg && normalizeGrapheneFile(fileArg)

  if (fileArg && !targetFile) {
    log(`Couldn't find ${fileArg}`)
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

function normalizeGrapheneFile (file: string): string | null {
  let clean = file.trim()
  if (!clean) return null

  let hasExt = /\.[^.\\/]+$/.test(clean)
  let candidates = hasExt ? [clean] : [clean + '.md', clean + '.gsql']
  for (let candidate of candidates) {
    if (!candidate.endsWith('.md') && !candidate.endsWith('.gsql')) continue
    if (process.env.NODE_ENV == 'test' && mockFileMap[candidate]) return candidate
    let absolute = [
      path.resolve(process.cwd(), candidate),
      path.resolve(config.root, candidate),
    ].find(p => fs.existsSync(p))
    if (absolute) return path.relative(config.root, absolute)
  }
  return null
}
