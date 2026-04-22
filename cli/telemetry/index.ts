import ci from 'ci-info'
import {createHash} from 'node:crypto'
import {access, constants, readFile} from 'node:fs/promises'
import path from 'node:path'

import type {Config} from '../../lang/config.ts'
import type {WorkspaceFileInput} from '../../lang/core.ts'
import type {CliCommandCompletedEvent, TelemetryBatch, TelemetryCommand, TelemetryEvent, WorkspaceScannedEvent} from './types.ts'

import {TelemetryStorage} from './storage.ts'
export type {TelemetryCommand} from './types.ts'

const DEFAULT_TELEMETRY_ENDPOINT = 'https://app.graphenedata.com/cli-telemetry'
const SAFE_FLAG_NAMES: Partial<Record<TelemetryCommand, Record<string, string[]>>> = {
  run: {chart: ['--chart', '-c'], query: ['--query', '-q']},
  serve: {bg: ['--bg']},
}

export class CliTelemetry {
  private storage: TelemetryStorage
  private installId = ''
  private projectHash?: string
  private enabled = true
  private workspaceScanSent = false
  private cfg: Config
  private cliVersion: string
  private endpoint: string

  constructor(cfg: Config, cliVersion: string, endpoint = process.env.GRAPHENE_TELEMETRY_ENDPOINT || DEFAULT_TELEMETRY_ENDPOINT) {
    this.cfg = cfg
    this.cliVersion = cliVersion
    this.endpoint = endpoint
    this.storage = new TelemetryStorage({projectRoot: cfg.root})
  }

  async init(cwd = process.cwd()) {
    this.enabled = isTelemetryEnabled(this.cfg, this.endpoint)
    if (!this.enabled) return

    await this.storage.init()
    this.installId = this.storage.installId
    this.projectHash = await getProjectHash(cwd)
  }

  commandStarted(command: TelemetryCommand, argv = process.argv.slice(2)) {
    if (!this.enabled) return
    this.send({
      ...this.commonFields(),
      event: 'cli_command_started',
      command,
      flags: getPresentFlags(command, argv),
    })
  }

  async commandCompleted(command: TelemetryCommand, event: Omit<CliCommandCompletedEvent, keyof ReturnType<CliTelemetry['commonFields']> | 'event' | 'command'>) {
    if (!this.enabled) return

    if (event.success) {
      let {shouldSendInstallSeen, fromVersion} = await this.storage.markSuccessfulInvocation(this.cliVersion)
      if (shouldSendInstallSeen) this.send({...this.commonFields(), event: 'cli_install_seen'})
      if (fromVersion) {
        this.send({
          ...this.commonFields(),
          event: 'cli_upgraded',
          from_version: fromVersion,
          to_version: this.cliVersion,
        })
      }
    }

    this.send({...this.commonFields(), event: 'cli_command_completed', command, ...event})
  }

  workspaceScanned(command: Extract<TelemetryCommand, 'check' | 'compile' | 'run' | 'serve'>, files: WorkspaceFileInput[]) {
    if (!this.enabled || this.workspaceScanSent) return
    this.workspaceScanSent = true

    let event: WorkspaceScannedEvent = {
      ...this.commonFields(),
      event: 'workspace_scanned',
      command,
      gsql_file_count: files.filter(file => file.path.endsWith('.gsql')).length,
      md_file_count: files.filter(file => file.path.endsWith('.md')).length,
    }
    this.send(event)
  }

  private commonFields() {
    return {
      install_id: this.installId,
      project_hash: this.projectHash,
      cli_version: this.cliVersion,
      timestamp: new Date().toISOString(),
      ci: ci.isCI,
      node_platform: process.platform,
      node_version: process.version,
    }
  }

  private send(event: TelemetryEvent) {
    let batch: TelemetryBatch = {events: [event]}
    let controller = new AbortController()
    let timeout = setTimeout(() => controller.abort(), 500)
    timeout.unref?.()

    void fetch(this.endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(batch),
      signal: controller.signal,
    })
      .catch(() => {})
      .finally(() => clearTimeout(timeout))
  }
}

export function isTelemetryEnabled(config: Config, endpoint: string) {
  if (!endpoint) return false
  if (process.env.GRAPHENE_TELEMETRY_DISABLED == '1') return false
  if (config.telemetry === false) return false
  return true
}

export function getPresentFlags(command: TelemetryCommand, argv: string[]) {
  let knownFlags = SAFE_FLAG_NAMES[command]
  if (!knownFlags) return []

  let present = Object.entries(knownFlags)
    .filter(([, aliases]) => aliases.some(alias => argv.includes(alias)))
    .map(([name]) => name)

  return present.sort()
}

export async function getProjectHash(startDir: string) {
  let packageJsonPath = await findNearestPackageJson(startDir)
  if (!packageJsonPath) return undefined

  try {
    let raw = await readFile(packageJsonPath, 'utf-8')
    let pkg = JSON.parse(raw)
    if (typeof pkg.name != 'string') return undefined
    let normalized = pkg.name.trim().toLowerCase()
    if (!normalized) return undefined
    return createHash('sha256').update(`graphene:${normalized}`).digest('hex')
  } catch {
    return undefined
  }
}

async function findNearestPackageJson(startDir: string) {
  let current = path.resolve(startDir)
  while (true) {
    let candidate = path.join(current, 'package.json')
    if (await pathExists(candidate)) return candidate

    let parent = path.dirname(current)
    if (parent == current) return null
    current = parent
  }
}

async function pathExists(filePath: string) {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}
