/// <reference types="vitest/globals" />
import * as fsp from 'node:fs/promises'
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'

import {loadConfig, normalizeConfig, type Config, type ConfigInput} from '../lang/config.ts'
import {isServerRunning, stopGrapheneIfRunning} from './background.ts'
import {expect, test} from './testFixtures.ts'

const dir = path.resolve(import.meta.url.replace('file://', ''), '../')
const flightDir = path.resolve(dir, '../examples/flights')
const TEST_PORT = 4163
const flightConfig = configFor(flightDir, {port: TEST_PORT})
process.env.GRAPHENE_PORT = String(TEST_PORT)
process.env.NODE_ENV = 'test'
process.env.GRAPHENE_TELEMETRY_DISABLED = '1'

function logCliFailure(step: string, res: {code: number; stdout: string; stderr: string}) {
  console.error(`[cli.test] ${step} failed (code ${res.code})\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`)
}

function expectCliSuccess(res: {code: number; stdout: string; stderr: string}, step: string) {
  if (res.code !== 0) logCliFailure(step, res)
  expect(res.code).toBe(0)
}

function configFor(root: string, overrides: ConfigInput = {}): Config {
  return normalizeConfig({root, duckdb: {}, telemetry: false, updateNotifier: false, ...overrides})
}

async function createTelemetryProject(prefix: string) {
  let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), prefix))
  await fsp.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({name: prefix, graphene: {duckdb: {}}}, null, 2) + '\n')
  await fsp.cp(path.join(flightDir, 'tables'), path.join(tmpDir, 'tables'), {recursive: true})
  await fsp.mkdir(path.join(tmpDir, 'node_modules'))
  return tmpDir
}

describe('cli package', () => {
  test('derives the project name from package.json with a directory fallback', async () => {
    expect((await loadConfig(flightDir, () => {})).projectName).toBe('example-flights')
    expect(normalizeConfig({root: '/tmp/project-without-package'}).projectName).toBe('project-without-package')
  })

  test('directly includes every lang and ui runtime dependency with the exact same spec', async () => {
    let cli = JSON.parse(await fsp.readFile(path.resolve(dir, '../cli/package.json'), 'utf8'))
    let lang = JSON.parse(await fsp.readFile(path.resolve(dir, '../lang/package.json'), 'utf8'))
    let ui = JSON.parse(await fsp.readFile(path.resolve(dir, '../ui/package.json'), 'utf8'))

    for (let pkg of [lang, ui]) {
      for (let [name, spec] of Object.entries(pkg.dependencies || {})) {
        expect(cli.dependencies[name], `${name} from ${pkg.name}`).toBe(spec)
      }
    }
  })
})

describe('cli compile', () => {
  test('compiles a basic query (happy path)', async ({runCli}) => {
    let res = await runCli(['compile', 'from flights select carrier'], flightConfig)
    expectCliSuccess(res, 'compile basic query')
    expect(res.stdout.toLowerCase()).toContain('from flights')
    expect(res.stdout.toLowerCase()).toContain('select')
  })

  test('errors if the nearest package.json does not have graphene config', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-cli-no-config-'))

    try {
      await fsp.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({name: 'tmp-graphene'}, null, 2) + '\n')
      await expect(loadConfig(tmpDir, () => {})).rejects.toThrow(/no graphene config found/i)
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('errors on invalid function (error path)', async ({runCli}) => {
    let res = await runCli(['compile', 'from flights select not_a_function()'], flightConfig)
    expect(res.code).not.toBe(0)
    expect((res.stdout + res.stderr).toLowerCase()).toContain('unknown function')
  })
})

describe('cli serve', () => {
  test('starts and stops the server in the background', async ({runCli}) => {
    await stopGrapheneIfRunning()

    try {
      let start = await runCli(['serve', '--bg'], flightConfig)
      expectCliSuccess(start, 'serve start')
      expect(start.stdout).toContain(`Server running at http://localhost:${TEST_PORT}`)
      expect(await isServerRunning(TEST_PORT)).toBe(true)

      let stop = await runCli(['stop'], flightConfig)
      expectCliSuccess(stop, 'serve stop')
      expect(await isServerRunning(TEST_PORT)).toBe(false)
    } finally {
      await stopGrapheneIfRunning()
    }
  })
})

describe('cli run', () => {
  test('prints help instead of reading stdin when no input is provided', async ({runCli}) => {
    let res = await runCli(['run'], flightConfig)
    expectCliSuccess(res, 'run help with no input')
    expect(res.stdout).toContain('Usage: graphene run [options] [input]')
    expect(res.stdout).toContain('Path to file, a raw string, or "-" for stdin')
  })

  test('reads a query from stdin when input is "-"', async ({runCli}) => {
    let res = await runCli(['run', '-'], flightConfig, {stdin: 'from flights select count() as total'})
    expectCliSuccess(res, 'run query from stdin')
    expect(res.stdout.toLowerCase()).toContain('total')
  })

  test('runs a query against flights.duckdb (happy path)', async ({runCli}) => {
    let res = await runCli(['run', 'from flights select count() as total'], flightConfig)
    expectCliSuccess(res, 'run query')
    expect(res.stdout.toLowerCase()).toContain('total')
  })

  test('prints query diagnostics without a stack trace', async ({runCli}) => {
    let res = await runCli(['run', 'from flights select carrier order by nope'], flightConfig)
    let output = res.stdout + res.stderr

    expect(res.code).toBe(1)
    expect(output).toContain('Unknown field in ORDER BY: nope')
    expect(output).not.toContain('TypeError')
    expect(output).not.toContain('validateInputQuery')
    expect(output).not.toContain('at file://')
  })

  test('normalizes DuckDB timestamp with time zone values', async ({runCli}) => {
    let res = await runCli(['run', 'select now() as ts'], flightConfig)
    expectCliSuccess(res, 'run timestamptz query')
    expect(res.stdout).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  test('prints csv for an inline query with --format csv', async ({runCli}) => {
    let res = await runCli(['run', "select 'a,b' as name, 2 as total", '--format', 'csv'], flightConfig)
    expectCliSuccess(res, 'run query as csv')
    expect(res.stdout).toBe('name,total\n"a,b",2\n')
  })

  test('runs an inline parameterized query with --param', async ({runCli}) => {
    let res = await runCli(['run', 'from flights where carrier = $carrier select carrier, count() as total group by 1', '--param', 'carrier=AA'], flightConfig)
    expectCliSuccess(res, 'run parameterized query')
    expect(res.stdout).toContain('AA')
    expect(res.stdout.toLowerCase()).toContain('total')
  })

  test('uses the configured project root when running a query', async ({runCli}) => {
    let res = await runCli(['run', 'from flights select count() as total'], flightConfig)
    expectCliSuccess(res, 'run query from nested directory')
    expect(res.stdout.toLowerCase()).toContain('total')
  })

  test('treats repeated --param values as an array', async ({runCli}) => {
    let res = await runCli(['run', 'from flights where carrier in ($carrier) select carrier group by 1 order by 1', '--param', 'carrier=AA', '--param', 'carrier=DL'], flightConfig)
    expectCliSuccess(res, 'run repeated input query')
    expect(res.stdout).toContain('AA')
    expect(res.stdout).toContain('DL')
  })

  test('rejects --param without key=value syntax', async ({runCli}) => {
    let res = await runCli(['run', 'from flights select count()', '--param', 'carrier'], flightConfig)
    expect(res.code).toBe(1)
    expect(res.stderr).toContain('Invalid --param "carrier". Expected key=value.')
  })

  test('rejects --param with an empty key', async ({runCli}) => {
    let res = await runCli(['run', 'from flights select count()', '--param', '=AA'], flightConfig)
    expect(res.code).toBe(1)
    expect(res.stderr).toContain('Invalid --param "=AA". Expected key=value.')
  })

  test('uses a configured duckdb path when present', async ({runCli}) => {
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
      let res = await runCli(['run', 'from flights select count() as total'], configFor(tmpDir, {duckdb: {path: path.join(flightDir, 'flights.duckdb')}}))
      expectCliSuccess(res, 'run query with configured duckdb path')
      expect(res.stdout.toLowerCase()).toContain('total')
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('rejects passing a gsql file path', async ({runCli}) => {
    let res = await runCli(['run', 'tables/flights.gsql'], flightConfig)
    expect(res.code).toBe(1)
    expect((res.stdout + res.stderr).toLowerCase()).toContain('running .gsql files is no longer supported')
  })
})

test('cli check a single gsql file', async ({runCli}) => {
  let res = await runCli(['check', 'tables/flights.gsql'], flightConfig)
  expectCliSuccess(res, 'check gsql file')
  expect(res.stdout).toContain('No errors found')
})

describe('cli telemetry', () => {
  test('sends telemetry to the configured endpoint', async ({runCli}) => {
    let tmpDir = await createTelemetryProject('graphene-cli-telemetry-')
    let batches: any[] = []
    let server = createServer(async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
      let body = await readRequestBody(req)
      batches.push(JSON.parse(body))
      res.statusCode = 204
      res.end()
    })

    try {
      let endpoint = await listen(server)
      let res = await runCli(['compile', 'from flights select carrier'], configFor(tmpDir, {telemetry: true}), {
        env: {
          GRAPHENE_TELEMETRY_DISABLED: '0',
          GRAPHENE_TELEMETRY_ENDPOINT: endpoint,
        },
      })

      expectCliSuccess(res, 'telemetry compile')
      await waitFor(() => batches.length >= 3)

      let events = batches.flatMap(batch => batch.events)

      let names = events.map(event => event.event).sort()
      expect(names).toEqual(['cli_command_completed', 'cli_command_started', 'cli_install_seen'])

      let started = events.find(event => event.event == 'cli_command_started')
      let completed = events.find(event => event.event == 'cli_command_completed')

      expect(started.command).toBe('compile')
      expect(started.flags).toEqual([])
      expect(completed.command).toBe('compile')
      expect(completed.success).toBe(true)
      expect(completed.exit_code).toBe(0)

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

  test('only sends cli_install_seen on the first run for an install', async ({runCli}) => {
    let tmpDir = await createTelemetryProject('graphene-cli-telemetry-install-seen-')
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
      }

      let first = await runCli(['compile', 'from flights select carrier'], configFor(tmpDir, {telemetry: true}), {env})
      expectCliSuccess(first, 'telemetry first compile')
      await waitFor(() => batches.length >= 3)
      let events = batches.flatMap(batch => batch.events)
      expect(events.filter(event => event.event == 'cli_install_seen')).toHaveLength(1)

      batches.length = 0

      let second = await runCli(['compile', 'from flights select carrier'], configFor(tmpDir, {telemetry: true}), {env})
      expectCliSuccess(second, 'telemetry second compile')
      await waitFor(() => batches.length >= 2)

      events = batches.flatMap(batch => batch.events)

      let names = events.map(event => event.event).sort()
      expect(names).toEqual(['cli_command_completed', 'cli_command_started'])
      expect(events.filter(event => event.event == 'cli_install_seen')).toHaveLength(0)
    } finally {
      await new Promise(resolve => server.close(resolve))
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('does not fail the command when telemetry state cannot be persisted', async ({runCli}) => {
    let tmpDir = await createTelemetryProject('graphene-cli-telemetry-blocked-')

    try {
      await fsp.writeFile(path.join(tmpDir, 'node_modules/.graphene'), '')
      let res = await runCli(['check', 'tables/flights.gsql'], configFor(tmpDir, {telemetry: true}), {
        env: {
          GRAPHENE_TELEMETRY_DISABLED: '0',
          GRAPHENE_TELEMETRY_ENDPOINT: 'http://127.0.0.1:9',
        },
      })

      expectCliSuccess(res, 'telemetry blocked check')
    } finally {
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
