/// <reference types="vitest/globals" />
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import type {Config} from '../lang/config.ts'

import {checkForUpdate, detectPackageManager, getUpgradeCommand, isNewerVersion, isUpdateNotifierEnabled, showCachedUpdateNotice} from './updateNotifier.ts'

function testConfig(root: string, overrides: Partial<Config> = {}): Config {
  return {dialect: 'duckdb', envFile: ['.env'], ignoredFiles: [], root, ...overrides}
}

function testStderr() {
  return {
    isTTY: true,
    output: '',
    write(chunk: string) {
      this.output += chunk
      return true
    },
  }
}

async function writePackageJson(dir: string, pkg: any) {
  await fsp.writeFile(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
}

describe('cli update notifier', () => {
  it('compares strict semver versions', () => {
    expect(isNewerVersion('0.0.18', '0.0.17')).toBe(true)
    expect(isNewerVersion('0.1.0', '0.0.99')).toBe(true)
    expect(isNewerVersion('1.0.0', '9.9.9')).toBe(false)
    expect(isNewerVersion('0.0.17', '0.0.17')).toBe(false)
    expect(isNewerVersion('0.0.18-beta.1', '0.0.17')).toBe(false)
  })

  it('respects opt-out and non-interactive conditions', () => {
    let cfg = testConfig('/tmp')
    let env = {}
    expect(isUpdateNotifierEnabled(cfg, env, {isTTY: true}, false)).toBe(true)
    expect(isUpdateNotifierEnabled({...cfg, updateNotifier: false}, env, {isTTY: true}, false)).toBe(false)
    expect(isUpdateNotifierEnabled(cfg, {GRAPHENE_NO_UPDATE_NOTIFIER: '1'}, {isTTY: true}, false)).toBe(false)
    expect(isUpdateNotifierEnabled(cfg, {NODE_ENV: 'test'}, {isTTY: true}, false)).toBe(false)
    expect(isUpdateNotifierEnabled(cfg, {CI: 'true'}, {isTTY: true}, false)).toBe(false)
    expect(isUpdateNotifierEnabled(cfg, env, {isTTY: false}, false)).toBe(false)
    expect(isUpdateNotifierEnabled(cfg, env, {isTTY: true}, true)).toBe(false)
  })

  it('checks daily and shows cached notices weekly per version', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-update-notifier-'))
    let statePath = path.join(tmpDir, 'update-check.json')
    let stderr = testStderr()
    let env = {}
    let fetchCalls = 0

    try {
      await writePackageJson(tmpDir, {name: 'tmp-graphene', dependencies: {'@graphenedata/cli': '0.0.17'}, graphene: {duckdb: {}}})
      let cfg = testConfig(tmpDir)

      await checkForUpdate({
        config: cfg,
        currentVersion: '0.0.17',
        env,
        statePath,
        stderr,
        now: 1_000,
        fetchLatestVersion: () => {
          fetchCalls++
          return Promise.resolve('0.0.18')
        },
      })
      expect(fetchCalls).toBe(1)

      await showCachedUpdateNotice({config: cfg, currentVersion: '0.0.17', env, statePath, stderr, now: 2_000})
      expect(stderr.output).toContain('Graphene 0.0.18 is available. You are using 0.0.17.')
      expect(stderr.output).toContain('Update: npm install @graphenedata/cli@latest')
      expect(stderr.output).toContain('Release notes: https://github.com/graphene-data/graphene/releases/tag/v0.0.18')

      stderr.output = ''
      await showCachedUpdateNotice({config: cfg, currentVersion: '0.0.17', env, statePath, stderr, now: 3_000})
      expect(stderr.output).toBe('')

      await checkForUpdate({
        config: cfg,
        currentVersion: '0.0.17',
        env,
        statePath,
        stderr,
        now: 2_000 + 24 * 60 * 60 * 1000,
        fetchLatestVersion: () => {
          fetchCalls++
          return Promise.resolve('0.0.19')
        },
      })
      await showCachedUpdateNotice({config: cfg, currentVersion: '0.0.17', env, statePath, stderr, now: 4_000})
      expect(stderr.output).toContain('Graphene 0.0.19 is available. You are using 0.0.17.')
      expect(fetchCalls).toBe(2)
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  it('records failed checks so they do not retry every command', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-update-failed-'))
    let statePath = path.join(tmpDir, 'update-check.json')
    let stderr = testStderr()
    let fetchCalls = 0

    try {
      await writePackageJson(tmpDir, {name: 'tmp-graphene', graphene: {duckdb: {}}})
      let cfg = testConfig(tmpDir)
      let options = {
        config: cfg,
        currentVersion: '0.0.17',
        env: {},
        statePath,
        stderr,
        now: 1_000,
        fetchLatestVersion: () => {
          fetchCalls++
          return Promise.resolve(null)
        },
      }

      await checkForUpdate(options)
      await checkForUpdate({...options, now: 2_000})
      expect(fetchCalls).toBe(1)
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  it('recovers from corrupt state', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-update-corrupt-'))
    let statePath = path.join(tmpDir, 'update-check.json')

    try {
      await writePackageJson(tmpDir, {name: 'tmp-graphene', graphene: {duckdb: {}}})
      await fsp.writeFile(statePath, 'not json')
      await checkForUpdate({
        config: testConfig(tmpDir),
        currentVersion: '0.0.17',
        env: {},
        statePath,
        stderr: testStderr(),
        now: 1_000,
        fetchLatestVersion: () => Promise.resolve('0.0.18'),
      })

      let state = JSON.parse(await fsp.readFile(statePath, 'utf-8'))
      expect(state.latestVersion).toBe('0.0.18')
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  it('stores default update state in the project node_modules cache', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-update-cache-'))
    let stderr = testStderr()

    try {
      await writePackageJson(tmpDir, {name: 'tmp-graphene', graphene: {duckdb: {}}})
      await fsp.mkdir(path.join(tmpDir, 'node_modules'))
      await checkForUpdate({
        config: testConfig(tmpDir),
        currentVersion: '0.0.17',
        env: {},
        stderr,
        now: 1_000,
        fetchLatestVersion: () => Promise.resolve('0.0.18'),
      })

      let state = JSON.parse(await fsp.readFile(path.join(tmpDir, 'node_modules/.graphene/update-check.json'), 'utf-8'))
      expect(state.latestVersion).toBe('0.0.18')
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  it('does not create node_modules just to persist update state', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-update-no-node-modules-'))
    let fetchCalls = 0

    try {
      await writePackageJson(tmpDir, {name: 'tmp-graphene', graphene: {duckdb: {}}})
      await checkForUpdate({
        config: testConfig(tmpDir),
        currentVersion: '0.0.17',
        env: {},
        stderr: testStderr(),
        now: 1_000,
        fetchLatestVersion: () => {
          fetchCalls++
          return Promise.resolve('0.0.18')
        },
      })

      expect(fetchCalls).toBe(0)
      await expect(fsp.access(path.join(tmpDir, 'node_modules'))).rejects.toBeTruthy()
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  it('detects package managers and preserves dev dependency installs', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-package-manager-'))
    let projectDir = path.join(tmpDir, 'packages/app')

    try {
      await fsp.mkdir(projectDir, {recursive: true})
      await writePackageJson(tmpDir, {packageManager: 'yarn@4.0.0'})
      await writePackageJson(projectDir, {name: 'app', devDependencies: {'@graphenedata/cli': '0.0.17'}, graphene: {duckdb: {}}})
      expect(await detectPackageManager(projectDir, {})).toBe('yarn')
      expect(await getUpgradeCommand(projectDir, {})).toBe('yarn add @graphenedata/cli@latest -D')

      await writePackageJson(tmpDir, {})
      await fsp.writeFile(path.join(tmpDir, 'pnpm-lock.yaml'), '')
      expect(await detectPackageManager(projectDir, {})).toBe('pnpm')

      await fsp.rm(path.join(tmpDir, 'pnpm-lock.yaml'))
      expect(await detectPackageManager(projectDir, {npm_config_user_agent: 'bun/1.2.0 npm/? node/?'})).toBe('bun')
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })
})
