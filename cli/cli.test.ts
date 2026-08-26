/// <reference types="vitest/globals" />
import * as fsp from 'node:fs/promises'
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'
import {fileURLToPath} from 'node:url'

import {loadConfig, normalizeConfig, type Config, type ConfigInput} from '../lang/config.ts'
import {isServerRunning, stopGrapheneIfRunning} from './background.ts'
import {normalizePageUrl} from './run.ts'
import {expect, expectCliOutput, test} from './testFixtures.ts'

const dir = path.dirname(fileURLToPath(import.meta.url))
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
  test('derives local project settings without making config normalization filesystem-dependent', async () => {
    let flightsConfig = await loadConfig(flightDir, () => {})
    expect(flightsConfig.projectName).toBe('example-flights')
    expect(flightsConfig.pagesPrefix).toBe('pages/')
    expect(normalizeConfig({root: flightDir}).pagesPrefix).toBe('')
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

describe('cli token', () => {
  test('creates tokens with configurable lifetimes', async ({runCli}) => {
    let ttlMinutes: number[] = []
    let server = createServer(async (req, res) => {
      ttlMinutes.push(JSON.parse(await readRequestBody(req)).ttlMinutes)
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({token: 'agent-token'}))
    })

    try {
      let endpoint = await listen(server)
      let cloudConfig = configFor(flightDir, {cloud: endpoint})
      expectCliOutput(await runCli(['token', '--ttl', '12h'], cloudConfig, {env: {GRAPHENE_TOKEN: 'login-token'}}), 'agent-token')
      expectCliOutput(await runCli(['make-token'], cloudConfig, {env: {GRAPHENE_TOKEN: 'login-token'}}), 'agent-token')
      expect(ttlMinutes).toEqual([12 * 60, 30 * 24 * 60])

      let invalid = await runCli(['token', '--ttl', '4m'], cloudConfig, {env: {GRAPHENE_TOKEN: 'login-token'}})
      expectCliOutput(invalid, {code: 1, stderr: 'TTL must be between 5m and 366d'})
    } finally {
      await new Promise(resolve => server.close(resolve))
    }
  })
})

describe('cli compile', () => {
  test('compiles a basic query (happy path)', async ({runCli}) => {
    let res = await runCli(['compile', 'from flights select carrier'], flightConfig)
    expectCliOutput(res, 'SELECT flights.carrier as carrier FROM flights as flights')
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
    expectCliOutput(res, {code: 1, stdout: `
      ERROR: input line 1: Unknown function: not_a_function
      from flights select not_a_function()
                          ^^^^^^^^^^^^^^^^
    `})
  })
})

describe('cli serve', () => {
  test('starts and stops the server in the background', async ({runCli}) => {
    await stopGrapheneIfRunning(TEST_PORT)

    try {
      let start = await runCli(['serve', '--bg'], flightConfig)
      expectCliOutput(start, `Server running at http://localhost:${TEST_PORT}`)
      expect(await isServerRunning(TEST_PORT)).toBe(true)

      let stop = await runCli(['stop'], flightConfig)
      expectCliOutput({...stop, stdout: stop.stdout.replace(/\d+/, '<pid>')}, 'Stopping server (<pid>)')
      expect(await isServerRunning(TEST_PORT)).toBe(false)
    } finally {
      await stopGrapheneIfRunning(TEST_PORT)
    }
  })

  test('checks cloud auth before starting the server', async ({runCli}) => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-cli-no-cloud-creds-'))
    try {
      let res = await runCli(['serve', '--bg'], configFor(tmpDir, {cloud: 'https://example.graphenedata.com/flights'}), {env: {GRAPHENE_TOKEN: ''}})

      expectCliOutput(res, {code: 1, stderr: 'Not logged in to Graphene Cloud. Run `graphene login` and try again.'})
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })
})

describe('cli run', () => {
  test('matches open browser tabs without considering URL parameters', () => {
    expect(normalizePageUrl('http://localhost:4163/flights?carrier=AA')).toBe(normalizePageUrl('http://localhost:4163/flights?carrier=DL'))
    expect(normalizePageUrl('http://localhost:4163/flights/')).toBe(normalizePageUrl('http://localhost:4163/flights'))
    expect(normalizePageUrl('http://localhost:4163/delays?carrier=AA')).not.toBe(normalizePageUrl('http://localhost:4163/flights?carrier=AA'))
  })

  test('prints help instead of reading stdin when no input is provided', async ({runCli}) => {
    let res = await runCli(['run'], flightConfig)
    expectCliOutput(res, `
      Usage: graphene run [options] [input]

      Run a query or screenshot a Graphene page

      Arguments:
        input                                  Path to file, a raw string, or "-" for stdin

      Options:
        -c, --chart <chartTitleOrComponentId>  Title or component ID of a specific chart or table to capture
        --param <key=value>                    Query parameters; repeat for multiple values (default: [])
        --format <format>                      Output format for query or chart data: table or csv (default: "table")
        --headless                             Run markdown pages in a headless browser instead of opening the system browser
        -h, --help                             display help for command
    `)
  })

  test('reads a query from stdin when input is "-"', async ({runCli}) => {
    let res = await runCli(['run', '-'], flightConfig, {stdin: 'from flights select count() as total'})
    expectCliOutput(res, `
      ┌────────┐
      │ total  │
      ├────────┤
      │ 344827 │
      └────────┘
    `)
  })

  test('runs a query against flights.duckdb (happy path)', async ({runCli}) => {
    let res = await runCli(['run', 'from flights select count() as total'], flightConfig)
    expectCliOutput(res, `
      ┌────────┐
      │ total  │
      ├────────┤
      │ 344827 │
      └────────┘
    `)
  })

  test('checks cloud auth before running a query', async ({runCli}) => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-cli-no-cloud-creds-'))
    try {
      let res = await runCli(['run', 'from flights select count() as total'], configFor(tmpDir, {cloud: 'https://example.graphenedata.com/flights'}), {env: {GRAPHENE_TOKEN: ''}})

      expectCliOutput(res, {code: 1, stderr: 'Not logged in to Graphene Cloud. Run `graphene login` and try again.'})
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('prints flattened Cloud transport failures', async ({runCli}) => {
    let server = createServer((req, res) => {
      res.setHeader('content-type', 'application/json')
      if (req.url == '/_api/nav') return res.end('{}')
      res.statusCode = 500
      res.end(JSON.stringify({message: 'fetch failed (UND_ERR_SOCKET)'}))
    })

    try {
      let endpoint = await listen(server)
      let res = await runCli(['run', 'from flights select count() as total'], configFor(flightDir, {cloud: `${endpoint}/flights`}), {env: {GRAPHENE_TOKEN: 'test-token'}})

      expectCliOutput(res, {code: 1, stderr: 'fetch failed (UND_ERR_SOCKET)'})
    } finally {
      await new Promise(resolve => server.close(resolve))
    }
  })

  test('prints query diagnostics without a stack trace', async ({runCli}) => {
    let res = await runCli(['run', 'from flights select carrier order by nope'], flightConfig)
    expectCliOutput(res, {code: 1, stdout: `
      ERROR: input line 1: Unknown field in ORDER BY: nope
      from flights select carrier order by nope
                                           ^^^^
    `})
  })

  test('normalizes DuckDB timestamp with time zone values', async ({runCli}) => {
    let res = await runCli(['run', 'select now() as ts'], flightConfig)
    expectCliOutput({...res, stdout: res.stdout.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, '<timestamp>')}, `
      ┌──────────────────────────┐
      │ ts                       │
      ├──────────────────────────┤
      │ <timestamp> │
      └──────────────────────────┘
    `)
  })

  test('prints csv for an inline query with --format csv', async ({runCli}) => {
    let res = await runCli(['run', "select 'a,b' as name, 2 as total", '--format', 'csv'], flightConfig)
    expectCliOutput(res, `
      name,total
      "a,b",2
    `)
  })

  test('runs an inline parameterized query with --param', async ({runCli}) => {
    let res = await runCli(['run', 'from flights where carrier = $carrier select carrier, count() as total group by 1', '--param', 'carrier=AA'], flightConfig)
    expectCliOutput(res, `
      ┌─────────┬───────┐
      │ carrier │ total │
      ├─────────┼───────┤
      │ AA      │ 34577 │
      └─────────┴───────┘
    `)
  })

  test('uses the configured project root when running a query', async ({runCli}) => {
    let res = await runCli(['run', 'from flights select count() as total'], flightConfig)
    expectCliOutput(res, `
      ┌────────┐
      │ total  │
      ├────────┤
      │ 344827 │
      └────────┘
    `)
  })

  test('treats repeated --param values as an array', async ({runCli}) => {
    let res = await runCli(['run', 'from flights where carrier in ($carrier) select carrier group by 1 order by 1', '--param', 'carrier=AA', '--param', 'carrier=DL'], flightConfig)
    expectCliOutput(res, `
      ┌─────────┐
      │ carrier │
      ├─────────┤
      │ AA      │
      ├─────────┤
      │ DL      │
      └─────────┘
    `)
  })

  test('rejects --param without key=value syntax', async ({runCli}) => {
    let res = await runCli(['run', 'from flights select count()', '--param', 'carrier'], flightConfig)
    expectCliOutput(res, {code: 1, stderr: 'Invalid --param "carrier". Expected key=value.'})
  })

  test('rejects --param with an empty key', async ({runCli}) => {
    let res = await runCli(['run', 'from flights select count()', '--param', '=AA'], flightConfig)
    expectCliOutput(res, {code: 1, stderr: 'Invalid --param "=AA". Expected key=value.'})
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
      expectCliOutput(res, `
      ┌────────┐
      │ total  │
      ├────────┤
      │ 344827 │
      └────────┘
    `)
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('rejects passing a gsql file path', async ({runCli}) => {
    let res = await runCli(['run', 'tables/flights.gsql'], flightConfig)
    expectCliOutput(res, {code: 1, stderr: 'Running .gsql files is no longer supported'})
  })
})

test('cli check a single gsql file', async ({runCli}) => {
  let res = await runCli(['check', 'tables/flights.gsql'], flightConfig)
  expectCliOutput(res, 'No errors found 💎')
})

describe('cli telemetry', () => {
  test('sends Cloud identity context to the configured endpoint', async ({runCli}) => {
    let tmpDir = await createTelemetryProject('graphene-cli-telemetry-')
    let batches: any[] = []
    let authorizations: (string | undefined)[] = []
    let server = createServer(async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
      let body = await readRequestBody(req)
      batches.push(JSON.parse(body))
      authorizations.push(req.headers.authorization)
      res.statusCode = 204
      res.end()
    })

    try {
      let endpoint = await listen(server)
      let res = await runCli(['compile', 'from flights select carrier'], configFor(tmpDir, {telemetry: true, cloud: `${endpoint}/flights`}), {
        env: {
          GRAPHENE_TELEMETRY_DISABLED: '0',
          GRAPHENE_TOKEN: 'telemetry-token',
          CLAUDECODE: '1',
        },
      })

      expectCliSuccess(res, 'telemetry compile')
      await waitFor(() => batches.length >= 1)

      let events = batches.flatMap(batch => batch.events)
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({event: 'compile', flags: [], success: true, exit_code: 0})
      expect(events.every(event => event.repo_slug == 'flights')).toBe(true)
      expect(authorizations.every(authorization => authorization == 'Bearer telemetry-token')).toBe(true)

      for (let batch of batches) {
        expect(batch).toMatchObject({events: expect.any(Array)})
        expect(batch.events).toHaveLength(1)
      }

      for (let event of events) {
        expect(event.install_id).toBeTruthy()
        expect(event.cli_version).toBeTruthy()
        expect(typeof event.ci).toBe('boolean')
        expect(event.agent).toBe('claude-code')
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
    req.on('data', chunk => body += chunk)
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
