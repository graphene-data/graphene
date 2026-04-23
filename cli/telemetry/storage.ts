import {randomUUID} from 'node:crypto'
import * as fs from 'node:fs/promises'
import path from 'node:path'

import type {TelemetryState} from './types.ts'

interface TelemetryStorageOptions {
  projectRoot?: string
}

export class TelemetryStorage {
  private state = defaultState()
  private options: TelemetryStorageOptions
  private nodeModulesPath?: string

  constructor(options: TelemetryStorageOptions = {}) {
    this.options = options
  }

  async init() {
    this.nodeModulesPath = await getNodeModulesPath(this.options)
    let filePath = this.telemetryFilePath()

    try {
      if (filePath) this.state = normalizeState(JSON.parse(await fs.readFile(filePath, 'utf-8')), this.state)
    } catch {
      // Telemetry storage is best-effort; corrupt or unreadable state should not affect commands.
    }
  }

  read(): TelemetryState {
    return this.state
  }

  get installId() {
    return this.state.installId
  }

  async markSuccessfulInvocation(cliVersion: string) {
    let state = this.read()
    let hasSeenVersion = state.installSeenVersions.includes(cliVersion)
    let shouldSendInstallSeen = !state.lastSeenVersion && state.installSeenVersions.length == 0
    let fromVersion = !hasSeenVersion && state.lastSeenVersion && state.lastSeenVersion != cliVersion ? state.lastSeenVersion : undefined

    let nextState = {
      ...state,
      lastSeenVersion: cliVersion,
      installSeenVersions: [...new Set([...state.installSeenVersions, cliVersion])],
    }
    if (!(await this.write(nextState))) return {shouldSendInstallSeen: false, fromVersion: undefined}

    return {shouldSendInstallSeen, fromVersion}
  }

  private async write(state: TelemetryState) {
    let filePath = this.telemetryFilePath()
    if (!filePath) return false

    let tmpPath = `${filePath}.tmp-${randomUUID()}`
    try {
      // Do not create node_modules solely for telemetry; only use the project cache if it already exists.
      if (this.nodeModulesPath && !(await fs.stat(this.nodeModulesPath)).isDirectory()) return false
      await fs.mkdir(path.dirname(filePath), {recursive: true})
      await fs.writeFile(tmpPath, JSON.stringify(state, null, 2) + '\n')
      await fs.rename(tmpPath, filePath)
      this.state = state
      return true
    } catch {
      try {
        await fs.unlink(tmpPath)
      } catch {
        // Nothing to clean up if the temp file was never created.
      }
      return false
    }
  }

  private telemetryFilePath() {
    if (this.nodeModulesPath) return path.join(this.nodeModulesPath, '.graphene', 'telemetry.json')
  }
}

function defaultState(): TelemetryState {
  return {installId: randomUUID(), installSeenVersions: []}
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

function normalizeState(state: Partial<TelemetryState>, fallback: TelemetryState): TelemetryState {
  return {
    installId: typeof state.installId == 'string' && state.installId ? state.installId : fallback.installId,
    installSeenVersions: Array.isArray(state.installSeenVersions) ? state.installSeenVersions.filter(version => typeof version == 'string') : fallback.installSeenVersions,
    ...(typeof state.lastSeenVersion == 'string' ? {lastSeenVersion: state.lastSeenVersion} : {}),
  }
}
