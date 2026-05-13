import ci from 'ci-info'
import {createHash} from 'node:crypto'
import {access, constants, readFile} from 'node:fs/promises'
import path from 'node:path'

import type {Config} from '../../lang/config.ts'
import type {WorkspaceFileInput} from '../../lang/core.ts'
import type {TelemetryBatch, TelemetryCommand, TelemetryEvent, TelemetryEventName, TelemetryPayloads} from './types.ts'

import {TelemetryStorage} from './storage.ts'
export type {TelemetryCommand, TelemetryEventName, TelemetryPayloads} from './types.ts'

const DEFAULT_TELEMETRY_ENDPOINT = 'https://app.graphenedata.com/cli-telemetry'
const SAFE_FLAG_NAMES: Partial<Record<TelemetryCommand, Record<string, string[]>>> = {
  run: {chart: ['--chart', '-c'], headless: ['--headless'], input: ['--input'], query: ['--query', '-q']},
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

  event<K extends TelemetryEventName>(event: K, ...args: TelemetryPayloads[K] extends undefined ? [] : [payload: TelemetryPayloads[K]]) {
    if (!this.enabled) return
    if (event == 'workspace_scanned') {
      if (this.workspaceScanSent) return
      this.workspaceScanSent = true
    }

    let payload = args[0] || {}
    this.send({...this.commonFields(), event, ...payload} as TelemetryEvent)
  }

  async markSuccessfulInvocation() {
    if (!this.enabled) return {shouldSendInstallSeen: false, fromVersion: undefined}
    return await this.storage.markSuccessfulInvocation(this.cliVersion)
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

export function getWorkspaceScanCounts(files: Pick<WorkspaceFileInput, 'path'>[]) {
  return {
    gsql_file_count: files.filter(file => file.path.endsWith('.gsql')).length,
    md_file_count: files.filter(file => file.path.endsWith('.md')).length,
  }
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
