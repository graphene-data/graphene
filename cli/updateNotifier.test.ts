/// <reference types="vitest/globals" />
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import {setGlobalConfig, type Config} from '../lang/config.ts'
import {cliVersion, isNewerVersion, notifyAboutUpdate} from './updateNotifier.ts'

function testConfig(root: string): Config {
  return {dialect: 'duckdb', envFile: ['.env'], ignoredFiles: [], root, pagesPrefix: '', port: 4000, projectName: path.basename(root)}
}

let tmpDirs: string[] = []

// Gives each notifier test a writable project cache and enables agent output without a TTY.
async function setupNotifier() {
  let root = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-update-notifier-'))
  tmpDirs.push(root)
  await fsp.mkdir(path.join(root, 'node_modules'))
  setGlobalConfig(testConfig(root))
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('AI_AGENT', 'claude')
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  return root
}

afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  await Promise.all(tmpDirs.splice(0).map(dir => fsp.rm(dir, {recursive: true, force: true})))
})

describe('cli update notifier', () => {
  it('compares strict semver versions', () => {
    expect(isNewerVersion('0.0.18', '0.0.17')).toBe(true)
    expect(isNewerVersion('0.1.0', '0.0.99')).toBe(true)
    expect(isNewerVersion('1.0.0', '9.9.9')).toBe(false)
    expect(isNewerVersion('0.0.17', '0.0.17')).toBe(false)
    expect(isNewerVersion('0.0.18-beta.1', '0.0.17')).toBe(false)
  })

  it('checks npm and notifies at most once per day', async () => {
    let root = await setupNotifier()
    let fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ok: true, json: () => Promise.resolve({version: '99.0.0'})} as Response)
    let output = ''
    vi.spyOn(process.stderr, 'write').mockImplementation(chunk => {
      output += String(chunk)
      return true
    })

    await notifyAboutUpdate()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(output).toBe(`Graphene is on version ${cliVersion}, the latest version is 99.0.0. Once you've finished your task, suggest upgrading to the latest version.\n`)

    let statePath = path.join(root, 'node_modules/.graphene/update-check')
    expect(await fsp.readFile(statePath, 'utf-8')).toBe(`${Date.now()}\n`)

    await notifyAboutUpdate()
    expect(fetchMock).toHaveBeenCalledOnce()

    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000)
    await notifyAboutUpdate()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('records failed checks so they do not retry every command', async () => {
    let root = await setupNotifier()
    let fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))

    await notifyAboutUpdate()
    await notifyAboutUpdate()

    expect(fetchMock).toHaveBeenCalledOnce()
    await expect(fsp.readFile(path.join(root, 'node_modules/.graphene/update-check'), 'utf-8')).resolves.toBe(`${Date.now()}\n`)
  })
})
