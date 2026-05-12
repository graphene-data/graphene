import ci from 'ci-info'
import {randomUUID} from 'node:crypto'
import * as fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type {Config} from '../lang/config.ts'

// The update notifier periodically checks for the latest Graphene version and caches
// that state in `${XDG_CONFIG_HOME || ~/.config}/graphene/update-check.json`. We keep
// state so every command can avoid a network request and so users only see one notice
// per newer version each week. Cached notices are shown before command output, while
// refreshes happen after the command finishes and fail silently.

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const NOTICE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_UPDATE_CHECK_URL = 'https://registry.npmjs.org/%40graphenedata%2Fcli/latest'
const GITHUB_RELEASE_URL = 'https://github.com/graphene-data/graphene/releases/tag'
const PACKAGE_NAME = '@graphenedata/cli'

export interface UpdateNotifierOptions {
  config: Config
  currentVersion: string
  packageIsPrivate?: boolean
  env?: NodeJS.ProcessEnv
  now?: number
  statePath?: string
  stderr?: Pick<NodeJS.WriteStream, 'write' | 'isTTY'>
  fetchLatestVersion?: (url: string) => Promise<string | null>
}

interface UpdateState {
  lastCheckedAt?: number
  latestVersion?: string
  lastNoticeVersion?: string
  lastNoticeAt?: number
}

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export async function notifyAboutUpdate(options: UpdateNotifierOptions) {
  await showCachedUpdateNotice(options)
  await checkForUpdate(options)
}

// Shows only cached update information so command startup does not wait on the network.
export async function showCachedUpdateNotice(options: UpdateNotifierOptions) {
  let env = options.env || process.env
  let stderr = options.stderr || process.stderr
  if (!isUpdateNotifierEnabled(options.config, env, stderr, options.packageIsPrivate)) return

  let now = options.now || Date.now()
  let statePath = options.statePath || getUpdateStatePath(env)
  let state = await readUpdateState(statePath)
  if (state.latestVersion && isNewerVersion(state.latestVersion, options.currentVersion) && shouldShowNotice(state, now)) {
    let command = await getUpgradeCommand(options.config.root, env)
    stderr.write(`Graphene ${state.latestVersion} is available. You are using ${options.currentVersion}.\n`)
    stderr.write(`Update: ${command}\n`)
    stderr.write(`Release notes: ${GITHUB_RELEASE_URL}/v${state.latestVersion}\n`)
    state = {...state, lastNoticeVersion: state.latestVersion, lastNoticeAt: now}
    await writeUpdateState(statePath, state)
  }
}

// Refreshes the cached latest version at most once per day after a command finishes.
export async function checkForUpdate(options: UpdateNotifierOptions) {
  let env = options.env || process.env
  let stderr = options.stderr || process.stderr
  if (!isUpdateNotifierEnabled(options.config, env, stderr, options.packageIsPrivate)) return

  let now = options.now || Date.now()
  let statePath = options.statePath || getUpdateStatePath(env)
  let state = await readUpdateState(statePath)

  if (!shouldCheckForUpdate(state, now)) return
  await writeUpdateState(statePath, {...state, lastCheckedAt: now})

  let latestVersion = await (options.fetchLatestVersion || fetchLatestVersion)(env.GRAPHENE_UPDATE_CHECK_URL || DEFAULT_UPDATE_CHECK_URL)
  if (latestVersion && isStrictSemver(latestVersion)) await writeUpdateState(statePath, {...state, lastCheckedAt: now, latestVersion})
}

export function isUpdateNotifierEnabled(config: Config, env: NodeJS.ProcessEnv = process.env, stderr: Pick<NodeJS.WriteStream, 'isTTY'> = process.stderr, packageIsPrivate = false) {
  if (packageIsPrivate) return false
  if (config.updateNotifier === false) return false
  if (env.GRAPHENE_NO_UPDATE_NOTIFIER == '1') return false
  if (env.NODE_ENV == 'test') return false
  if (isCiEnv(env)) return false
  if (!stderr.isTTY) return false
  return true
}

export function isNewerVersion(candidate: string, current: string) {
  if (!isStrictSemver(candidate) || !isStrictSemver(current)) return false
  let candidateParts = candidate.split('.').map(Number)
  let currentParts = current.split('.').map(Number)

  for (let i = 0; i < candidateParts.length; i++) {
    if (candidateParts[i] > currentParts[i]) return true
    if (candidateParts[i] < currentParts[i]) return false
  }

  return false
}

export async function getUpgradeCommand(projectRoot: string, env: NodeJS.ProcessEnv = process.env) {
  let packageManager = await detectPackageManager(projectRoot, env)
  let dependencyFlag = (await getGrapheneDependencyType(projectRoot)) == 'devDependencies' ? devDependencyFlag(packageManager) : ''
  let command = `${packageManager} ${packageManager == 'npm' ? 'install' : 'add'} ${PACKAGE_NAME}@latest`
  return dependencyFlag ? `${command} ${dependencyFlag}` : command
}

export async function detectPackageManager(projectRoot: string, env: NodeJS.ProcessEnv = process.env): Promise<PackageManager> {
  let packageManager = await findPackageManagerField(projectRoot)
  if (packageManager) return packageManager

  let lockfilePackageManager = await findLockfilePackageManager(projectRoot)
  if (lockfilePackageManager) return lockfilePackageManager

  return parsePackageManager(env.npm_config_user_agent) || 'npm'
}

function shouldShowNotice(state: UpdateState, now: number) {
  if (state.lastNoticeVersion != state.latestVersion) return true
  return !state.lastNoticeAt || now - state.lastNoticeAt >= NOTICE_INTERVAL_MS
}

function shouldCheckForUpdate(state: UpdateState, now: number) {
  return !state.lastCheckedAt || now - state.lastCheckedAt >= CHECK_INTERVAL_MS
}

async function fetchLatestVersion(url: string) {
  let controller = new AbortController()
  let timeout = setTimeout(() => controller.abort(), 500)
  timeout.unref?.()

  try {
    let response = await fetch(url, {signal: controller.signal})
    if (!response.ok) return null
    let body = await response.json()
    return typeof body.version == 'string' ? body.version : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function getUpdateStatePath(env: NodeJS.ProcessEnv = process.env) {
  let configDir = env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
  return path.join(configDir, 'graphene', 'update-check.json')
}

async function readUpdateState(filePath: string): Promise<UpdateState> {
  try {
    return normalizeUpdateState(JSON.parse(await fs.readFile(filePath, 'utf-8')))
  } catch {
    return {}
  }
}

async function writeUpdateState(filePath: string, state: UpdateState) {
  let tmpPath = `${filePath}.tmp-${randomUUID()}`
  try {
    await fs.mkdir(path.dirname(filePath), {recursive: true})
    await fs.writeFile(tmpPath, JSON.stringify(state, null, 2) + '\n')
    await fs.rename(tmpPath, filePath)
  } catch {
    try {
      await fs.unlink(tmpPath)
    } catch {
      // Nothing to clean up if the temp file was never created.
    }
  }
}

function normalizeUpdateState(state: Partial<UpdateState>): UpdateState {
  return {
    ...(typeof state.lastCheckedAt == 'number' ? {lastCheckedAt: state.lastCheckedAt} : {}),
    ...(typeof state.latestVersion == 'string' ? {latestVersion: state.latestVersion} : {}),
    ...(typeof state.lastNoticeVersion == 'string' ? {lastNoticeVersion: state.lastNoticeVersion} : {}),
    ...(typeof state.lastNoticeAt == 'number' ? {lastNoticeAt: state.lastNoticeAt} : {}),
  }
}

async function findPackageManagerField(projectRoot: string): Promise<PackageManager | null> {
  for (let dir of ancestorDirs(projectRoot)) {
    let packageJson = await readPackageJson(path.join(dir, 'package.json'))
    let packageManager = parsePackageManager(packageJson?.packageManager)
    if (packageManager) return packageManager
  }
  return null
}

async function findLockfilePackageManager(projectRoot: string): Promise<PackageManager | null> {
  let lockfiles: Array<[string, PackageManager]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
    ['npm-shrinkwrap.json', 'npm'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
  ]

  for (let dir of ancestorDirs(projectRoot)) {
    for (let [file, packageManager] of lockfiles) {
      try {
        await fs.access(path.join(dir, file))
        return packageManager
      } catch {
        // Keep walking upward until a package manager signal is found.
      }
    }
  }

  return null
}

async function getGrapheneDependencyType(projectRoot: string) {
  let packageJson = await readPackageJson(path.join(projectRoot, 'package.json'))
  if (packageJson?.devDependencies?.[PACKAGE_NAME]) return 'devDependencies'
  if (packageJson?.dependencies?.[PACKAGE_NAME]) return 'dependencies'
  return null
}

async function readPackageJson(filePath: string): Promise<any | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function parsePackageManager(value: unknown): PackageManager | null {
  if (typeof value != 'string') return null
  let normalized = value.toLowerCase()
  if (normalized.includes('pnpm')) return 'pnpm'
  if (normalized.includes('yarn')) return 'yarn'
  if (normalized.includes('bun')) return 'bun'
  if (normalized.includes('npm')) return 'npm'
  return null
}

function devDependencyFlag(packageManager: PackageManager) {
  if (packageManager == 'bun') return '-d'
  return '-D'
}

function isStrictSemver(version: string) {
  return /^\d+\.\d+\.\d+$/.test(version)
}

function isCiEnv(env: NodeJS.ProcessEnv) {
  if (env === process.env) return ci.isCI
  return env.CI == 'true' || env.CI == '1' || !!env.GITHUB_ACTIONS || !!env.BUILDKITE || !!env.CIRCLECI
}

function ancestorDirs(startDir: string) {
  let dirs: string[] = []
  let current = path.resolve(startDir)
  while (true) {
    dirs.push(current)
    let parent = path.dirname(current)
    if (parent == current) return dirs
    current = parent
  }
}
