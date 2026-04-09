/// <reference types="vitest/globals" />
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import {getPresentFlags, getProjectHash, isTelemetryEnabled} from './telemetry/index.ts'
import {TelemetryStorage} from './telemetry/storage.ts'

describe('cli telemetry', () => {
  it('tracks only safe flag names, not values', () => {
    expect(getPresentFlags('run', ['run', 'report.md', '--query', 'weekly_trends', '--chart', 'Revenue by Region'])).toEqual(['chart', 'query'])
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
    let originalConfigHome = process.env.XDG_CONFIG_HOME
    process.env.XDG_CONFIG_HOME = tmpDir

    try {
      let storage = new TelemetryStorage()
      let firstInstallId = storage.installId
      expect(firstInstallId).toBeTruthy()

      let initialSuccess = storage.markSuccessfulInvocation('0.0.15')
      expect(initialSuccess).toEqual({shouldSendInstallSeen: true, fromVersion: undefined})
      expect(storage.installId).toBe(firstInstallId)

      let repeatSuccess = storage.markSuccessfulInvocation('0.0.15')
      expect(repeatSuccess).toEqual({shouldSendInstallSeen: false, fromVersion: undefined})
      expect(storage.installId).toBe(firstInstallId)

      let upgradeSuccess = storage.markSuccessfulInvocation('0.0.16')
      expect(upgradeSuccess).toEqual({shouldSendInstallSeen: true, fromVersion: '0.0.15'})
      expect(storage.installId).toBe(firstInstallId)
    } finally {
      if (originalConfigHome === undefined) delete process.env.XDG_CONFIG_HOME
      else process.env.XDG_CONFIG_HOME = originalConfigHome
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })
})
