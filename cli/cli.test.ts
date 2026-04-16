/// <reference types="vitest/globals" />
import {spawn} from 'node:child_process'
import * as fsp from 'node:fs/promises'
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'
import {expect} from 'vitest'

import {isServerRunning, stopGrapheneIfRunning} from './background.ts'
import {preloadWarehouseConnections} from './connections/index.ts'

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

const dir = path.resolve(import.meta.url.replace('file://', ''), '../')
const flightDir = path.resolve(dir, '../examples/flights')
const TEST_PORT = 4163
process.env.GRAPHENE_PORT = '4163'
process.env.NODE_ENV = 'test'
process.env.GRAPHENE_TELEMETRY_DISABLED = '1'

function runCli(args: string[], options: {cwd?: string; env?: NodeJS.ProcessEnv} = {}): Promise<RunResult> {
  return new Promise(resolve => {
    let cliEntry = path.resolve(dir, 'cli.ts')
    let child = spawn('node', [cliEntry, ...args], {cwd: options.cwd, env: {...process.env, ...options.env}})
    let stdout = '',
      stderr = ''
    child.stdout.on('data', d => {
      stdout += d.toString()
    })
    child.stderr.on('data', d => {
      stderr += d.toString()
    })
    child.on('close', code => resolve({code: code ?? 0, stdout, stderr}))
  })
}

function logCliFailure(step: string, res: RunResult) {
  console.error(`[cli.test] ${step} failed (code ${res.code})\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`)
}

function expectCliSuccess(res: RunResult, step: string) {
  if (res.code !== 0) logCliFailure(step, res)
  expect(res.code).toBe(0)
}

describe('cli compile', () => {
  it('preloads warehouse connection modules for cloud startup', async () => {
    await expect(preloadWarehouseConnections()).resolves.toBeUndefined()
    await expect(preloadWarehouseConnections()).resolves.toBeUndefined()
  })

  it('compiles a basic query (happy path)', async () => {
    let res = await runCli(['compile', 'from flights select carrier'], {cwd: flightDir})
    expectCliSuccess(res, 'compile basic query')
    expect(res.stdout.toLowerCase()).toContain('from flights')
    expect(res.stdout.toLowerCase()).toContain('select')
  })

  it('errors on invalid function (error path)', async () => {
    let res = await runCli(['compile', 'from flights select not_a_function()'], {cwd: flightDir})
    expect(res.code).not.toBe(0)
    expect((res.stdout + res.stderr).toLowerCase()).toContain('unknown function')
  })
})

describe('cli serve (background)', () => {
  beforeEach(async () => {
    await stopGrapheneIfRunning()
  })
  afterEach(async () => {
    await stopGrapheneIfRunning()
  })

  it('starts the server in the background and restarts cleanly', async () => {
    let first = await runCli(['serve', '--bg'], {cwd: flightDir})
    expectCliSuccess(first, 'serve start')
    expect(first.stdout).toContain('Server running at')
    expect(await isServerRunning(TEST_PORT)).toBe(true)

    // running `serve` again should restart it
    let second = await runCli(['serve', '--bg'], {cwd: flightDir})
    expectCliSuccess(second, 'serve restart')
    expect(second.stdout).toContain('Stopping server')
    expect(await isServerRunning(TEST_PORT)).toBe(true)

    let stop = await runCli(['stop'], {cwd: flightDir})
    expectCliSuccess(stop, 'serve stop')
    expect(stop.stdout).toContain('Stopping server')
    expect(await isServerRunning(TEST_PORT)).toBe(false)
  })
})

describe('cli run', () => {
  it('runs a query against flights.duckdb (happy path)', async () => {
    let res = await runCli(['run', 'from flights select count() as total'], {cwd: flightDir})
    expectCliSuccess(res, 'run query')
    expect(res.stdout.toLowerCase()).toContain('total')
  })

  it('shows an error when no .duckdb is present (error path)', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-cli-'))
    let input = ['table t (a int)', 'from t select a'].join('\n')
    let res = await runCli(['run', input], {cwd: tmpDir})
    expect(res.code).toBe(1)
    expect(res.stderr.toLowerCase()).toContain('no .duckdb file found')
  })

  it('runs a named query from a markdown file', async () => {
    let res = await runCli(['run', 'index.md', '--query', 'weekly_trends'], {cwd: flightDir})
    expectCliSuccess(res, 'run markdown query')
    expect(res.stdout.toLowerCase()).toContain('week')
  })

  it('uses a configured duckdb path when present', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-cli-configured-duckdb-'))
    let pkg = {
      name: 'tmp-graphene',
      version: '0.0.1',
      scripts: {graphene: 'graphene'},
      dependencies: {'@graphenedata/cli': 'workspace:*'},
      graphene: {
        dialect: 'duckdb',
        duckdb: {path: path.join(flightDir, 'flights.duckdb')},
      },
    }

    try {
      await fsp.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
      await fsp.cp(path.join(flightDir, 'tables'), path.join(tmpDir, 'tables'), {recursive: true})
      let res = await runCli(['run', 'from flights select count() as total'], {cwd: tmpDir})
      expectCliSuccess(res, 'run query with configured duckdb path')
      expect(res.stdout.toLowerCase()).toContain('total')
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  it('rejects passing a gsql file path', async () => {
    let res = await runCli(['run', 'tables/flights.gsql'], {cwd: flightDir})
    expect(res.code).toBe(1)
    expect((res.stdout + res.stderr).toLowerCase()).toContain('running .gsql files is no longer supported')
  })
})

describe('cli check', () => {
  it('checks a single gsql file', async () => {
    let res = await runCli(['check', 'tables/flights.gsql'], {cwd: flightDir})
    expectCliSuccess(res, 'check gsql file')
    expect(res.stdout).toContain('No errors found')
  })
})

describe('cli telemetry', () => {
  it('sends telemetry to the configured endpoint', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-cli-telemetry-'))
    let batches: any[] = []
    let server = createServer(async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
      let body = await readRequestBody(req)
      batches.push(JSON.parse(body))
      res.statusCode = 204
      res.end()
    })

    try {
      let endpoint = await listen(server)
      let res = await runCli(['compile', 'from flights select carrier'], {
        cwd: flightDir,
        env: {
          GRAPHENE_TELEMETRY_DISABLED: '0',
          GRAPHENE_TELEMETRY_ENDPOINT: endpoint,
          XDG_CONFIG_HOME: tmpDir,
        },
      })

      expectCliSuccess(res, 'telemetry compile')
      await waitFor(() => batches.length >= 4)

      let events = batches.flatMap(batch => batch.events)

      let names = events.map(event => event.event).sort()
      expect(names).toEqual(['cli_command_completed', 'cli_command_started', 'cli_install_seen', 'workspace_scanned'])

      let started = events.find(event => event.event == 'cli_command_started')
      let completed = events.find(event => event.event == 'cli_command_completed')
      let scanned = events.find(event => event.event == 'workspace_scanned')

      expect(started.command).toBe('compile')
      expect(started.flags).toEqual([])
      expect(completed.command).toBe('compile')
      expect(completed.success).toBe(true)
      expect(completed.exit_code).toBe(0)
      expect(scanned.command).toBe('compile')
      expect(scanned.gsql_file_count).toBeGreaterThan(0)
      expect(scanned.md_file_count).toBe(0)

      for (let batch of batches) {
        expect(batch).toMatchObject({events: expect.any(Array)})
        expect(batch.events).toHaveLength(1)
      }

      for (let event of events) {
        expect(event.install_id).toBeTruthy()
        expect(event.cli_version).toBeTruthy()
        expect(typeof event.ci).toBe('boolean')
        expect(event.node_platform).toBeTruthy()
        expect(event.node_version).toBeTruthy()
        expect(typeof event.timestamp).toBe('string')
        expect(JSON.stringify(event)).not.toContain('from flights select carrier')
      }
    } finally {
      await new Promise(resolve => server.close(resolve))
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  it('only sends cli_install_seen on the first run for an install', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-cli-telemetry-install-seen-'))
    let batches: any[] = []
    let server = createServer(async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
      let body = await readRequestBody(req)
      batches.push(JSON.parse(body))
      res.statusCode = 204
      res.end()
    })

    try {
      let endpoint = await listen(server)
      let env = {
        GRAPHENE_TELEMETRY_DISABLED: '0',
        GRAPHENE_TELEMETRY_ENDPOINT: endpoint,
        XDG_CONFIG_HOME: tmpDir,
      }

      let first = await runCli(['compile', 'from flights select carrier'], {cwd: flightDir, env})
      expectCliSuccess(first, 'telemetry first compile')
      await waitFor(() => batches.length >= 4)
      let events = batches.flatMap(batch => batch.events)
      expect(events.filter(event => event.event == 'cli_install_seen')).toHaveLength(1)

      batches.length = 0

      let second = await runCli(['compile', 'from flights select carrier'], {cwd: flightDir, env})
      expectCliSuccess(second, 'telemetry second compile')
      await waitFor(() => batches.length >= 3)

      events = batches.flatMap(batch => batch.events)

      let names = events.map(event => event.event).sort()
      expect(names).toEqual(['cli_command_completed', 'cli_command_started', 'workspace_scanned'])
      expect(events.filter(event => event.event == 'cli_install_seen')).toHaveLength(0)
    } finally {
      await new Promise(resolve => server.close(resolve))
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })
})

function listen(server: ReturnType<typeof createServer>): Promise<string> {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      let address = server.address()
      if (!address || typeof address == 'string') return reject(new Error('Failed to bind telemetry test server'))
      resolve(`http://127.0.0.1:${address.port}`)
    })
    server.once('error', reject)
  })
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf-8')
    req.on('data', chunk => (body += chunk))
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function waitFor(check: () => boolean, timeoutMs = 5000): Promise<void> {
  let deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    let poll = () => {
      if (check()) return resolve()
      if (Date.now() >= deadline) return reject(new Error('Timed out waiting for telemetry'))
      setTimeout(poll, 50)
    }
    poll()
  })
}
