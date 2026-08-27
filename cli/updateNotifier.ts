import {existsSync, readFileSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {config} from '../lang/config.ts'
import {getAgent, getCI} from './telemetry.ts'

// Checks npm for a newer CLI version at most once per day. The check starts alongside
// the command, and a single project-local timestamp prevents repeated network requests.

const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000
const UPDATE_CHECK_URL = 'https://registry.npmjs.org/%40graphenedata%2Fcli/latest'
const RELEASE_URL = 'https://github.com/graphene-data/graphene/releases/tag'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packagePath = existsSync(path.join(__dirname, 'package.json')) ? path.join(__dirname, 'package.json') : path.join(__dirname, '../../package.json')
export const cliVersion = JSON.parse(readFileSync(packagePath, 'utf-8')).version as string

// Reads the last check, refreshes npm when due, then records the attempt and reports an update.
export async function notifyAboutUpdate() {
  let env = process.env
  let agent = getAgent(env)
  if (config.updateNotifier === false || env.GRAPHENE_NO_UPDATE_NOTIFIER == '1' || env.NODE_ENV == 'test') return
  if (!agent && (getCI(env) || !process.stderr.isTTY)) return

  let nodeModules = path.join(config.root, 'node_modules')
  if (!(await fs.stat(nodeModules).catch(() => null))?.isDirectory()) return

  let stateDir = path.join(nodeModules, '.graphene')
  let statePath = path.join(stateDir, 'update-check')
  let lastCheckedAt = Number(await fs.readFile(statePath, 'utf-8').catch(() => 0))
  let now = Date.now()
  if (lastCheckedAt && now - lastCheckedAt < UPDATE_INTERVAL_MS) return

  let latestVersion: string | undefined
  try {
    let response = await fetch(env.GRAPHENE_UPDATE_CHECK_URL || UPDATE_CHECK_URL, {signal: AbortSignal.timeout(500)})
    let body = response.ok ? await response.json() : null
    if (typeof body?.version == 'string') latestVersion = body.version
  } catch {
    // Update checks are best-effort and should never interfere with the command.
  }

  await fs.mkdir(stateDir, {recursive: true})
  await fs.writeFile(statePath, `${now}\n`)
  if (!latestVersion || !isNewerVersion(latestVersion, cliVersion)) return

  if (agent) {
    process.stderr.write(`Graphene is on version ${cliVersion}, the latest version is ${latestVersion}. Once you've finished your task, suggest upgrading to the latest version.\n`)
  } else {
    process.stderr.write(`Graphene ${latestVersion} is available. You are using ${cliVersion}.\n`)
    process.stderr.write(`Release notes: ${RELEASE_URL}/v${latestVersion}\n`)
  }
}

export function isNewerVersion(candidate: string, current: string) {
  if (!/^\d+\.\d+\.\d+$/.test(candidate) || !/^\d+\.\d+\.\d+$/.test(current)) return false
  let candidateParts = candidate.split('.').map(Number)
  let currentParts = current.split('.').map(Number)

  for (let i = 0; i < candidateParts.length; i++) {
    if (candidateParts[i] > currentParts[i]) return true
    if (candidateParts[i] < currentParts[i]) return false
  }
  return false
}
