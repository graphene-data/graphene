/// <reference types="vitest/globals" />
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import {getPresentFlags, getProjectHash, getWorkspaceScanCounts, isTelemetryEnabled} from './telemetry/index.ts'
import {TelemetryStorage} from './telemetry/storage.ts'

describe('cli telemetry', () => {
  it('summarizes workspace scans as file type counts', () => {
    let files = [
      {path: 'tables/flights.gsql', contents: 'from flights'},
      {path: 'tables/carriers.gsql', contents: 'from carriers'},
      {path: 'reports/index.md', contents: '# Report'},
      {path: 'README.txt', contents: 'ignore me'},
    ]

    expect(getWorkspaceScanCounts(files)).toEqual({gsql_file_count: 2, md_file_count: 1})
  })

  it('tracks only safe flag names, not values', () => {
    expect(getPresentFlags('run', ['run', 'report.md', '--query', 'weekly_trends', '--chart', 'Revenue by Region', '--input', 'carrier=AA'])).toEqual(['chart', 'input', 'query'])
    expect(getPresentFlags('serve', ['serve', '--bg'])).toEqual(['bg'])
    expect(getPresentFlags('schema', ['schema', 'analytics.orders'])).toEqual([])
  })

  it('hashes the nearest package name and never returns it raw', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-telemetry-hash-'))
    let nestedDir = path.join(tmpDir, 'a/b/c')
    await fsp.mkdir(nestedDir, {recursive: true})
    await fsp.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({name: 'My-App'}))

    try {
      let hash = await getProjectHash(nestedDir)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
      expect(hash).not.toContain('My-App')
      expect(hash).not.toContain('my-app')
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  it('respects environment and config opt-out', () => {
    let env = process.env.GRAPHENE_TELEMETRY_DISABLED
    try {
      delete process.env.GRAPHENE_TELEMETRY_DISABLED
      expect(isTelemetryEnabled({dialect: 'duckdb', envFile: ['.env'], ignoredFiles: [], root: '/tmp'}, 'https://example.com')).toBe(true)
      expect(isTelemetryEnabled({dialect: 'duckdb', envFile: ['.env'], ignoredFiles: [], root: '/tmp', telemetry: false}, 'https://example.com')).toBe(false)
      process.env.GRAPHENE_TELEMETRY_DISABLED = '1'
      expect(isTelemetryEnabled({dialect: 'duckdb', envFile: ['.env'], ignoredFiles: [], root: '/tmp'}, 'https://example.com')).toBe(false)
    } finally {
      if (env === undefined) delete process.env.GRAPHENE_TELEMETRY_DISABLED
      else process.env.GRAPHENE_TELEMETRY_DISABLED = env
    }
  })

  it('persists install and upgrade state', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-telemetry-state-'))

    try {
      await fsp.mkdir(path.join(tmpDir, 'node_modules'))
      let storage = new TelemetryStorage({projectRoot: tmpDir})
      await storage.init()
      let firstInstallId = storage.installId
      expect(firstInstallId).toBeTruthy()

      let initialSuccess = await storage.markSuccessfulInvocation('0.0.15')
      expect(initialSuccess).toEqual({shouldSendInstallSeen: true, fromVersion: undefined})
      expect(storage.installId).toBe(firstInstallId)

      let repeatSuccess = await storage.markSuccessfulInvocation('0.0.15')
      expect(repeatSuccess).toEqual({shouldSendInstallSeen: false, fromVersion: undefined})
      expect(storage.installId).toBe(firstInstallId)

      let upgradeSuccess = await storage.markSuccessfulInvocation('0.0.16')
      expect(upgradeSuccess).toEqual({shouldSendInstallSeen: false, fromVersion: '0.0.15'})
      expect(storage.installId).toBe(firstInstallId)

      let repeatUpgradeVersion = await storage.markSuccessfulInvocation('0.0.16')
      expect(repeatUpgradeVersion).toEqual({shouldSendInstallSeen: false, fromVersion: undefined})
      expect(storage.installId).toBe(firstInstallId)

      let nextStorage = new TelemetryStorage({projectRoot: tmpDir})
      await nextStorage.init()
      expect(nextStorage.installId).toBe(firstInstallId)
      expect(await nextStorage.markSuccessfulInvocation('0.0.17')).toEqual({shouldSendInstallSeen: false, fromVersion: '0.0.16'})

      let switchBackVersion = await storage.markSuccessfulInvocation('0.0.15')
      expect(switchBackVersion).toEqual({shouldSendInstallSeen: false, fromVersion: undefined})
      expect(storage.installId).toBe(firstInstallId)
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  it('does not throw when telemetry state cannot be persisted', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-telemetry-unwritable-'))

    try {
      await fsp.mkdir(path.join(tmpDir, 'node_modules'))
      await fsp.writeFile(path.join(tmpDir, 'node_modules/.graphene'), '')

      let storage = new TelemetryStorage({projectRoot: tmpDir})
      await storage.init()
      expect(storage.installId).toBeTruthy()
      expect(await storage.markSuccessfulInvocation('0.0.15')).toEqual({shouldSendInstallSeen: false, fromVersion: undefined})
      expect(await storage.markSuccessfulInvocation('0.0.16')).toEqual({shouldSendInstallSeen: false, fromVersion: undefined})
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  it('uses ephemeral state when the project has no node_modules', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-telemetry-no-node-modules-'))

    try {
      let storage = new TelemetryStorage({projectRoot: tmpDir})
      await storage.init()
      expect(storage.installId).toBeTruthy()
      expect(await storage.markSuccessfulInvocation('0.0.15')).toEqual({shouldSendInstallSeen: false, fromVersion: undefined})
      await expect(fsp.access(path.join(tmpDir, 'node_modules'))).rejects.toBeTruthy()
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })
})
