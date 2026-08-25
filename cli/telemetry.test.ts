/// <reference types="vitest/globals" />
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import {Command} from 'commander'

import type {Config} from '../lang/config.ts'

import {getAgent, getCI, getInstallId, getPresentFlags, getProjectHash, isTelemetryEnabled} from './telemetry.ts'

describe('cli telemetry', () => {
  it('detects agent harnesses without returning environment values', () => {
    expect(getAgent({CLAUDECODE: '1'})).toBe('claude-code')
    expect(getAgent({CLAUDECODE: '1', CLAUDE_CODE_IS_COWORK: '1'})).toBe('claude-cowork')
    expect(getAgent({CODEX_THREAD_ID: 'private-session-id'})).toBe('codex')
    expect(getAgent({AI_AGENT: 'github-copilot-cli@1.0'})).toBe('github-copilot')
    expect(getAgent({AI_AGENT: 'internal-agent-with-sensitive-name'})).toBe('other')
    expect(getAgent({})).toBeUndefined()
  })

  it('detects CI without returning provider or environment values', () => {
    expect(getCI({GITHUB_ACTIONS: 'true'})).toBe(true)
    expect(getCI({JENKINS_URL: 'https://private.example.com', BUILD_ID: 'secret-build-id'})).toBe(true)
    expect(getCI({CI: 'false', GITHUB_ACTIONS: 'true'})).toBe(false)
    expect(getCI({})).toBe(false)
  })

  it('derives explicitly passed flag names from Commander', () => {
    let command = new Command()
      .option('-c, --chart <chart>', 'Chart to capture')
      .option('--format <format>', 'Output format', 'table')
      .option('--headless', 'Run headlessly')
      .option('--future-option <value>', 'Any newly declared option is tracked automatically')
    command.parse(['--headless', '--chart', 'Revenue by Region', '--future-option', 'private-value'], {from: 'user'})

    expect(getPresentFlags(command)).toEqual(['chart', 'futureOption', 'headless'])
  })

  it('hashes project and sanitized database identity', async () => {
    let cfg: Config = {
      dialect: 'postgres', envFile: ['.env'], ignoredFiles: [], root: '/tmp', pagesPrefix: '', projectName: 'My-App', port: 4000,
      postgres: {connectionString: 'postgres://private-user:private-password@db.example.com:5432/analytics?sslmode=require'},
    }
    let hash = await getProjectHash(cfg)
    let sameDestination = await getProjectHash({...cfg, postgres: {connectionString: 'postgres://other-user:other-password@db.example.com:5432/analytics?application_name=graphene'}})
    let otherDatabase = await getProjectHash({...cfg, postgres: {connectionString: 'postgres://private-user:private-password@db.example.com:5432/warehouse'}})

    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).toBe(sameDestination)
    expect(hash).not.toBe(otherDatabase)
    expect(hash).not.toContain('private')
  })

  it('respects environment and config opt-out', () => {
    let env = process.env.GRAPHENE_TELEMETRY_DISABLED
    try {
      delete process.env.GRAPHENE_TELEMETRY_DISABLED
      expect(isTelemetryEnabled({dialect: 'duckdb', envFile: ['.env'], ignoredFiles: [], root: '/tmp', pagesPrefix: '', projectName: 'tmp', port: 4000}, 'https://example.com')).toBe(true)
      expect(isTelemetryEnabled({dialect: 'duckdb', envFile: ['.env'], ignoredFiles: [], root: '/tmp', pagesPrefix: '', projectName: 'tmp', port: 4000, telemetry: false}, 'https://example.com')).toBe(false)
      process.env.GRAPHENE_TELEMETRY_DISABLED = '1'
      expect(isTelemetryEnabled({dialect: 'duckdb', envFile: ['.env'], ignoredFiles: [], root: '/tmp', pagesPrefix: '', projectName: 'tmp', port: 4000}, 'https://example.com')).toBe(false)
    } finally {
      if (env === undefined) delete process.env.GRAPHENE_TELEMETRY_DISABLED
      else process.env.GRAPHENE_TELEMETRY_DISABLED = env
    }
  })

  it('persists a project-local install ID', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-telemetry-state-'))

    try {
      await fsp.mkdir(path.join(tmpDir, 'node_modules'))
      let firstInstallId = await getInstallId(tmpDir)
      let telemetryFile = path.join(tmpDir, 'node_modules/.graphene/telemetry.json')
      await fsp.writeFile(telemetryFile, JSON.stringify({installId: firstInstallId, installSeenVersions: ['0.0.27'], lastSeenVersion: '0.0.27'}))

      let nextInstallId = await getInstallId(tmpDir)
      expect(firstInstallId).toBeTruthy()
      expect(nextInstallId).toBe(firstInstallId)
      expect(JSON.parse(await fsp.readFile(telemetryFile, 'utf-8'))).toEqual({installId: firstInstallId})
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  it('does not throw when telemetry state cannot be persisted', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-telemetry-unwritable-'))

    try {
      await fsp.mkdir(path.join(tmpDir, 'node_modules'))
      await fsp.writeFile(path.join(tmpDir, 'node_modules/.graphene'), '')

      expect(await getInstallId(tmpDir)).toBeTruthy()
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  it('uses ephemeral state when the project has no node_modules', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-telemetry-no-node-modules-'))

    try {
      expect(await getInstallId(tmpDir)).toBeTruthy()
      await expect(fsp.access(path.join(tmpDir, 'node_modules'))).rejects.toBeTruthy()
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })
})
