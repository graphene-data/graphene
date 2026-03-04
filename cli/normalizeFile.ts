import fs from 'fs-extra'
import path from 'path'
import {config} from '../lang/core.ts'
import {mockFileMap} from './mockFiles.ts'

export function normalizeFile(file: string): string | null {
  let clean = file.trim()
  if (!clean) return null

  if (process.env.NODE_ENV == 'test' && mockFileMap[clean]) return clean

  let absolute = [
    path.resolve(process.cwd(), clean),
    path.resolve(config.root, clean),
  ].find(p => fs.existsSync(p)) || null

  if (!absolute) return null
  return path.relative(config.root, absolute)
}
