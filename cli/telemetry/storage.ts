// Persists the random, project-local install ID used to correlate telemetry across CLI invocations.
// Storage is best-effort and only uses node_modules when that directory already exists.
import {randomUUID} from 'node:crypto'
import * as fs from 'node:fs/promises'
import path from 'node:path'

import type {TelemetryState} from './types.ts'

interface TelemetryStorageOptions {
  projectRoot?: string
}

export class TelemetryStorage {
  private state: TelemetryState = {installId: randomUUID()}
  private nodeModulesPath?: string
  private options: TelemetryStorageOptions

  constructor(options: TelemetryStorageOptions = {}) {
    this.options = options
  }

  async init() {
    this.nodeModulesPath = await getNodeModulesPath(this.options)
    let filePath = this.telemetryFilePath()
    if (!filePath) return

    try {
      let stored = JSON.parse(await fs.readFile(filePath, 'utf-8'))
      if (typeof stored.installId == 'string' && stored.installId) this.state.installId = stored.installId
      if (Object.keys(stored).some(key => key != 'installId')) await this.write()
      return
    } catch {
      // Missing, corrupt, or unreadable state is replaced when the project cache is writable.
    }

    await this.write()
  }

  get installId() {
    return this.state.installId
  }

  private async write() {
    let filePath = this.telemetryFilePath()
    if (!filePath) return

    let tmpPath = `${filePath}.tmp-${randomUUID()}`
    try {
      // Do not create node_modules solely for telemetry; only use the project cache if it still exists.
      if (this.nodeModulesPath && !(await fs.stat(this.nodeModulesPath)).isDirectory()) return
      await fs.mkdir(path.dirname(filePath), {recursive: true})
      await fs.writeFile(tmpPath, JSON.stringify(this.state, null, 2) + '\n')
      await fs.rename(tmpPath, filePath)
    } catch {
      try {
        await fs.unlink(tmpPath)
      } catch {
        // Nothing to clean up if the temp file was never created.
      }
    }
  }

  private telemetryFilePath() {
    if (this.nodeModulesPath) return path.join(this.nodeModulesPath, '.graphene', 'telemetry.json')
  }
}

async function getNodeModulesPath(options: TelemetryStorageOptions) {
  if (!options.projectRoot) return

  let nodeModules = path.join(options.projectRoot, 'node_modules')
  try {
    if (!(await fs.stat(nodeModules)).isDirectory()) return
  } catch {
    return
  }

  return nodeModules
}
