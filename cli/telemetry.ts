// Collects a deliberately small, privacy-safe description of CLI usage and sends it best-effort.
// Environment detection emits only known agent names and binary CI state, never raw environment values.
import {createHash, randomUUID} from 'node:crypto'
import * as fs from 'node:fs/promises'
import path from 'node:path'

import type {Command} from 'commander'

import type {Config} from '../lang/config.ts'
import {getTelemetryAuthorization} from './auth.ts'

export type TelemetryCommand = 'check' | 'compile' | 'list' | 'login' | 'run' | 'schema' | 'serve' | 'stop'

export interface CliTelemetryEvent {
  event: TelemetryCommand
  install_id: string
  project_hash?: string
  repo_slug?: string
  cli_version: string
  timestamp: string
  agent?: string
  ci: boolean
  node_platform: NodeJS.Platform
  node_version: string
  flags: string[]
  success: boolean
  exit_code: number
  duration_ms: number
}

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

// Adds privacy-safe identity to a completed command and sends it without delaying CLI shutdown on the network request.
export async function sendTelemetry(
  cfg: Config, cliVersion: string, command: TelemetryCommand,
  payload: Pick<CliTelemetryEvent, 'flags' | 'success' | 'exit_code' | 'duration_ms'>,
  endpoint = process.env.GRAPHENE_TELEMETRY_ENDPOINT || telemetryEndpoint(cfg),
) {
  if (!isTelemetryEnabled(cfg, endpoint)) return

  let event: CliTelemetryEvent = {
    event: command,
    install_id: await getInstallId(cfg.root),
    project_hash: await getProjectHash(cfg),
    repo_slug: cfg.cloud ? new URL(cfg.cloud).pathname.replace(/^\/+|\/+$/g, '') || undefined : undefined,
    cli_version: cliVersion,
    timestamp: new Date().toISOString(),
    agent: getAgent(process.env),
    ci: getCI(process.env),
    node_platform: process.platform,
    node_version: process.version,
    ...payload,
  }

  void (async () => {
    let controller = new AbortController()
    let timeout = setTimeout(() => controller.abort(), 500)
    timeout.unref?.()

    let headers = new Headers({'Content-Type': 'application/json'})
    let authorization = cfg.cloud ? await getTelemetryAuthorization() : undefined
    if (authorization) headers.set('Authorization', authorization)

    await fetch(endpoint, {method: 'POST', headers, body: JSON.stringify({events: [event]}), signal: controller.signal})
      .catch(() => {})
      .finally(() => clearTimeout(timeout))
  })().catch(() => {})
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

// Commander tracks whether each declared option came from the CLI, so defaults are excluded without a parallel flag allowlist.
export function getPresentFlags(command: Command) {
  return command.options
    .filter(option => command.getOptionValueSource(option.attributeName()) == 'cli')
    .map(option => option.attributeName())
    .sort()
}

// Hashes the project name with its effective database destination so copies using different data remain distinct.
// Connection credentials, usernames, and URL query parameters are deliberately excluded from the input.
export async function getProjectHash(cfg: Config) {
  let project = cfg.projectName.trim().toLowerCase()
  let database = await getDatabaseIdentity(cfg)
  return createHash('sha256').update(JSON.stringify(['graphene', project, database])).digest('hex')
}

async function getDatabaseIdentity(cfg: Config) {
  if (cfg.cloud) return `cloud:${urlLocation(cfg.cloud)}`
  if (cfg.motherduck) return `motherduck:${cfg.motherduck.database || ''}`
  if (cfg.dialect == 'bigquery') return `bigquery:${cfg.bigquery?.projectId || ''}:${cfg.defaultNamespace || ''}`
  if (cfg.dialect == 'snowflake') return `snowflake:${cfg.snowflake?.account || ''}:${cfg.snowflake?.database || ''}`
  if (cfg.dialect == 'clickhouse') return `clickhouse:${cfg.clickhouse?.url ? urlLocation(cfg.clickhouse.url) : ''}:${cfg.clickhouse?.database || cfg.defaultNamespace || 'default'}`
  if (cfg.dialect == 'postgres') {
    if (cfg.postgres?.inMemory) return 'postgres:in-memory'
    if (cfg.postgres?.connectionString) return `postgres:${urlLocation(cfg.postgres.connectionString)}`
    return `postgres:${(cfg.postgres?.host || '').toLowerCase()}:${cfg.postgres?.port || 5432}/${cfg.postgres?.database || ''}`
  }
  if (cfg.dialect == 'athena') return `athena:${cfg.athena?.region || ''}:${cfg.athena?.catalog || ''}:${cfg.athena?.database || cfg.defaultNamespace || ''}`

  let dbPath = cfg.duckdb?.path
  if (!dbPath) dbPath = (await fs.readdir(cfg.root)).sort().find(file => file.endsWith('.duckdb'))
  if (!dbPath) return 'duckdb:'
  let absolutePath = path.resolve(cfg.root, dbPath)
  let relativePath = path.relative(cfg.root, absolutePath)
  return `duckdb:${relativePath.startsWith(`..${path.sep}`) ? path.basename(absolutePath) : relativePath}`
}

function urlLocation(raw: string) {
  let url = new URL(raw)
  return `${url.hostname.toLowerCase()}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/$/, '')}`
}

// Persists a random project-local install ID when node_modules already exists; failures fall back to an ephemeral ID.
export async function getInstallId(projectRoot: string) {
  let installId = randomUUID()
  let nodeModules = path.join(projectRoot, 'node_modules')
  try {
    if (!(await fs.stat(nodeModules)).isDirectory()) return installId
  } catch {
    return installId
  }

  let filePath = path.join(nodeModules, '.graphene', 'telemetry.json')
  try {
    let stored = JSON.parse(await fs.readFile(filePath, 'utf-8'))
    if (typeof stored.installId == 'string' && stored.installId) {
      installId = stored.installId
      if (Object.keys(stored).length == 1) return installId
    }
  } catch {
    // Missing, corrupt, or unreadable state is replaced when the project cache is writable.
  }

  let tmpPath = `${filePath}.tmp-${randomUUID()}`
  try {
    await fs.mkdir(path.dirname(filePath), {recursive: true})
    await fs.writeFile(tmpPath, JSON.stringify({installId}, null, 2) + '\n')
    await fs.rename(tmpPath, filePath)
  } catch {
    await fs.unlink(tmpPath).catch(() => {})
  }
  return installId
}
