// Collects a deliberately small, privacy-safe description of CLI usage and sends it best-effort.
// Environment detection emits only known agent names and binary CI state, never raw environment values.
import {createHash} from 'node:crypto'
import {access, constants, readFile} from 'node:fs/promises'
import path from 'node:path'

import type {Config} from '../../lang/config.ts'
import type {WorkspaceFileInput} from '../../lang/core.ts'
import {getTelemetryAuthorization} from '../auth.ts'
import type {TelemetryBatch, TelemetryCommand, TelemetryEvent, TelemetryEventName, TelemetryPayloads} from './types.ts'

import {TelemetryStorage} from './storage.ts'
export type {TelemetryCommand, TelemetryEventName, TelemetryPayloads} from './types.ts'

const DEFAULT_TELEMETRY_ENDPOINT = 'https://app.graphenedata.com/cli-telemetry'
const AGENT_ENV_RULES: [agent: string, markers: [name: string, value?: string][]][] = [
  ['cursor', [['CURSOR_AGENT', '1'], ['CURSOR_CONVERSATION_ID'], ['CURSOR_TRACE_ID'], ['CURSOR_EXTENSION_HOST_ROLE', 'agent-exec']]],
  ['claude-code', [['CLAUDECODE', '1'], ['CLAUDE_CODE'], ['CLAUDE_CODE_SESSION_ID']]],
  ['codex', [['CODEX_CI', '1'], ['CODEX_SHELL', '1'], ['CODEX_SANDBOX'], ['CODEX_THREAD_ID']]],
  ['gemini', [['GEMINI_CLI', '1']]],
  ['opencode', [['OPENCODE', '1'], ['OPENCODE_CLIENT'], ['OPENCODE_PID']]],
  ['github-copilot', [['COPILOT_CLI', '1'], ['COPILOT_AGENT_SESSION_ID'], ['COPILOT_RUN_APP', '1'], ['COPILOT_MODEL'], ['COPILOT_ALLOW_ALL'], ['COPILOT_GITHUB_TOKEN']]],
  ['antigravity', [['ANTIGRAVITY_AGENT', '1'], ['ANTIGRAVITY_TRAJECTORY_ID']]],
  ['augment-cli', [['AUGMENT_AGENT', '1']]],
  ['pi', [['PI_CODING_AGENT', 'true']]],
  ['replit', [['REPLIT_SESSION'], ['REPL_ID']]],
  ['kiro', [['KIRO_SESSION_ID']]],
  ['kilocode', [['KILO', '1'], ['KILOCODE_VERSION'], ['KILO_RUN_ID']]],
  ['cline', [['CLINE_WRAPPER_PATH']]],
  ['bolt', [['BOLT_ENV'], ['BOLT_ORIGIN'], ['BOLT_SERVER_URL']]],
  ['muse', [['MUSE_RELEASE_INFO']]],
  ['rork', [['RORK_API_URL']]],
]
const AGENT_NAMES: Record<string, string> = Object.fromEntries(AGENT_ENV_RULES.map(([agent]) => [agent, agent]))
Object.assign(AGENT_NAMES, {
  claude: 'claude-code', cowork: 'claude-cowork', 'cursor-cli': 'cursor', devin: 'devin',
  'github-copilot-cli': 'github-copilot', copilot: 'github-copilot', v0: 'v0',
})

// These are presence checks only. They cover ci-info's generic signals plus CI systems that do not consistently set CI.
const CI_ENV_MARKERS = [
  'CI', 'BUILD_ID', 'BUILD_NUMBER', 'CI_APP_ID', 'CI_BUILD_ID', 'CI_BUILD_NUMBER', 'CI_NAME', 'CONTINUOUS_INTEGRATION', 'RUN_ID',
  'AGOLA_GIT_REF', 'ALPIC_HOST', 'AC_APPCIRCLE', 'APPVEYOR', 'CODEBUILD_BUILD_ARN', 'TF_BUILD', 'bamboo_planKey', 'BITBUCKET_COMMIT', 'BITRISE_IO',
  'BUDDY_WORKSPACE_ID', 'BUILDKITE', 'CIRCLECI', 'CIRRUS_CI', 'CF_PAGES', 'WORKERS_CI', 'CF_BUILD_ID', 'CM_BUILD_ID', 'DRONE', 'DSARI',
  'EARTHLY_CI', 'EAS_BUILD', 'GERRIT_PROJECT', 'GITEA_ACTIONS', 'GITHUB_ACTIONS', 'GITLAB_CI', 'GO_PIPELINE_LABEL', 'BUILDER_OUTPUT',
  'HARNESS_BUILD_ID', 'HUDSON_URL', 'JENKINS_URL', 'LAYERCI', 'MAGNUM', 'NETLIFY', 'NEVERCODE', 'PROW_JOB_ID', 'RELEASE_BUILD_ID', 'RENDER',
  'SAILCI', 'SCREWDRIVER', 'SEMAPHORE', 'STRIDER', 'TASK_ID', 'TEAMCITY_VERSION', 'TRAVIS', 'VELA', 'NOW_BUILDER', 'VERCEL',
  'APPCENTER_BUILD_ID', 'WOODPECKER', 'CI_XCODE_PROJECT', 'XCS',
]

const SAFE_FLAG_NAMES: Partial<Record<TelemetryCommand, Record<string, string[]>>> = {
  run: {chart: ['--chart', '-c'], format: ['--format'], headless: ['--headless'], input: ['--input'], port: ['--port'], query: ['--query', '-q']},
  serve: {bg: ['--bg'], port: ['--port']},
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

  constructor(cfg: Config, cliVersion: string, endpoint = process.env.GRAPHENE_TELEMETRY_ENDPOINT || telemetryEndpoint(cfg)) {
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
      repo_slug: this.cfg.cloud ? new URL(this.cfg.cloud).pathname.replace(/^\/+|\/+$/g, '') || undefined : undefined,
      cli_version: this.cliVersion,
      timestamp: new Date().toISOString(),
      agent: getAgent(process.env),
      ci: getCI(process.env),
      node_platform: process.platform,
      node_version: process.version,
    }
  }

  private send(event: TelemetryEvent) {
    void (async () => {
      let batch: TelemetryBatch = {events: [event]}
      let controller = new AbortController()
      let timeout = setTimeout(() => controller.abort(), 500)
      timeout.unref?.()

      let headers = new Headers({'Content-Type': 'application/json'})
      let authorization = this.cfg.cloud ? await getTelemetryAuthorization() : undefined
      if (authorization) headers.set('Authorization', authorization)

      await fetch(this.endpoint, {method: 'POST', headers, body: JSON.stringify(batch), signal: controller.signal})
        .catch(() => {})
        .finally(() => clearTimeout(timeout))
    })().catch(() => {})
  }
}

// Cloud projects report to their Cloud origin so the server can validate their existing credentials.
function telemetryEndpoint(cfg: Config) {
  if (!cfg.cloud) return DEFAULT_TELEMETRY_ENDPOINT
  return new URL('/cli-telemetry', cfg.cloud).toString()
}

export function isTelemetryEnabled(config: Config, endpoint: string) {
  if (!endpoint) return false
  if (process.env.GRAPHENE_TELEMETRY_DISABLED == '1') return false
  if (config.telemetry === false) return false
  return true
}

// Detects a directly invoking harness from inherited markers without returning any raw environment values.
export function getAgent(env: NodeJS.ProcessEnv) {
  let explicit = env.AI_AGENT?.trim().toLowerCase().split('@')[0]
  if (explicit) return AGENT_NAMES[explicit] || 'other'
  if ((env.CLAUDECODE == '1' || env.CLAUDE_CODE || env.CLAUDE_CODE_SESSION_ID) && env.CLAUDE_CODE_IS_COWORK) return 'claude-cowork'

  for (let [agent, markers] of AGENT_ENV_RULES) {
    if (markers.some(([name, value]) => env[name] !== undefined && (value === undefined || env[name] == value))) return agent
  }
  return undefined
}

// Reports only whether a known CI marker exists. CI=false explicitly overrides inherited markers, matching ci-info.
export function getCI(env: NodeJS.ProcessEnv) {
  if (env.CI == 'false') return false
  return CI_ENV_MARKERS.some(name => !!env[name])
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
