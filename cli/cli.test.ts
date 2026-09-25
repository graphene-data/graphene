/// <reference types="vitest/globals" />
import * as fsp from 'node:fs/promises'
import {parseEval} from './evals.ts'
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'
import {fileURLToPath} from 'node:url'

import {config, loadConfig, normalizeConfig, setGlobalConfig, type Config, type ConfigInput} from '../lang/config.ts'
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

  test.each([
    [' https://example.graphenedata.com/my-project/// ', 'https://example.graphenedata.com', 'my-project'],
    ['http://localhost:4321/my-project/', 'http://localhost:4321', 'my-project'],
    ['http://127.0.0.1:4321', 'http://127.0.0.1:4321', ''],
  ])('normalizes Cloud URL %s without changing input', (cloud, origin, repoSlug) => {
    let input = {root: flightDir, cloud}
    let normalized = normalizeConfig(input)
    expect(normalized.cloud).toEqual({origin, repoSlug})
    expect(input).toEqual({root: flightDir, cloud})
    expect(normalizeConfig(normalized)).toEqual(normalized)
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(normalized)
    let previous = structuredClone(config)
    try {
      setGlobalConfig(normalized)
      setGlobalConfig(config)
      expect(config).toEqual(normalized)
    } finally {
      setGlobalConfig(previous)
    }
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

describe('cli export', () => {
  test('exports synced Cloud paths with repeated parameters, without reading local contents', async ({runCli}) => {
    let root = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-export-'))
    let requests: unknown[] = []
    let html = '<!doctype html><html><body>Cloud report</body></html>'
    let server = createServer(async (req, res) => {
      expect(`${req.method} ${req.url}`).toBe('POST /_api/export')
      expect(req.headers.authorization).toBe('Bearer test-token')
      requests.push(JSON.parse(await readRequestBody(req)))
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.end(html)
    })
    let defaultOutput = path.join(process.cwd(), 'cli-export-test.html')
    try {
      let cfg = configFor(root, {cloud: `${await listen(server)}/flights`})
      let env = {GRAPHENE_TOKEN: 'test-token'}
      let output = path.join(root, 'report.html')
      await fsp.writeFile(path.join(root, 'local.md'), '{broken local markdown')
      expectCliOutput(await runCli(['export', 'local.md', '--param', 'carrier=AA', '--param', 'carrier=A&B=+ #é', '--param', 'empty=', '--param', '__proto__=safe', '--output', output], cfg, {env}), `Report saved to ${output}`)
      expect(await fsp.readFile(output, 'utf8')).toBe(html)
      expectCliOutput(await runCli(['export', path.join(root, 'cli-export-test.md')], cfg, {env}), 'Report saved to cli-export-test.html')
      expect(await fsp.readFile(defaultOutput, 'utf8')).toBe(html)
      expect(requests).toEqual([
        {repoSlug: 'flights', path: 'local.md', params: JSON.parse('{"carrier":["AA","A&B=+ #é"],"empty":"","__proto__":"safe"}')},
        {repoSlug: 'flights', path: 'cli-export-test.md', params: {}},
      ])
      expectCliOutput(await runCli(['export', path.join(root, 'missing.md'), '--param', 'bad'], cfg, {env}), {code: 1, stderr: 'Invalid --param "bad". Expected key=value.'})
      for (let file of ['model.gsql', '../outside.md']) {
        expectCliOutput(await runCli(['export', file], cfg, {env}), {code: 1, stderr: 'Export requires a Markdown file path inside the project'})
      }
      expectCliOutput(await runCli(['export', 'report.md'], configFor(root)), {code: 1, stderr: 'Export requires a Graphene Cloud project with a repository slug'})
      expectCliOutput(await runCli(['export', path.join(root, 'missing.md')], cfg, {env: {GRAPHENE_TOKEN: ''}}), {code: 1, stderr: 'Not logged in to Graphene Cloud. Run `graphene login` and try again.'})
      expect(requests).toHaveLength(2)
    } finally {
      await new Promise(resolve => server.close(resolve))
      await fsp.rm(defaultOutput, {force: true})
      await fsp.rm(root, {recursive: true, force: true})
    }
  })

  test('does not create or overwrite output on HTTP or invalid response failures', async ({runCli}) => {
    let root = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-export-errors-'))
    let status = 500
    let server = createServer((_req, res) => {
      res.statusCode = status
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({message: 'Export failed'}))
    })
    try {
      let cfg = configFor(root, {cloud: `${await listen(server)}/flights`})
      let output = path.join(root, 'report.html')
      let args = ['export', path.join(root, 'report.md'), '--output', output]
      let options = {env: {GRAPHENE_TOKEN: 'test-token'}}
      expectCliOutput(await runCli(args, cfg, options), {code: 1, stderr: 'Export failed'})
      expect(await fsp.stat(output).catch(() => null)).toBeNull()
      await fsp.writeFile(output, 'previous report')
      for (let code of [401, 403, 404, 500, 200]) {
        status = code
        expectCliOutput(await runCli(args, cfg, options), {code: 1, stderr: code === 200 ? 'Expected a standalone HTML response from Graphene Cloud' : 'Export failed'})
        expect(await fsp.readFile(output, 'utf8')).toBe('previous report')
      }
    } finally {
      await new Promise(resolve => server.close(resolve))
      await fsp.rm(root, {recursive: true, force: true})
    }
  })
})

describe('cli results', () => {
  test('reads repo-scoped lists and evidence as JSON without Git, launches or polling', async ({runCli}) => {
    let root = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-results-'))
    let requests: string[] = []
    let evaluation = {id: 'eval-1', repoSlug: 'my-project', day: '2026-01-05', file: 'evals/first.yaml', sha: 'a'.repeat(40), sessionId: 'eval-session', grade: false, reason: 'Wrong aggregation', status: 'SUCCESS', error: null}
    let review = {id: 'review-1', sessionId: 'session-1', findings: []}
    let results = [[evaluation], {...evaluation, session: {id: 'eval-session', messages: [{role: 'user', content: 'Eval evidence'}]}},
      [review], {...review, session: {id: 'session-1', messages: [{role: 'user', content: 'Review evidence'}]}}]
    let server = createServer((req, res) => {
      res.setHeader('content-type', 'application/json')
      requests.push(`${req.method} ${req.url}`)
      expect(req.headers.authorization).toBe('Bearer test-token')
      res.end(JSON.stringify(results[(requests.length - 1) % results.length]))
    })
    try {
      let endpoint = await listen(server)
      await fsp.writeFile(path.join(root, 'package.json'), JSON.stringify({graphene: {cloud: ` ${endpoint}/my-project/// `, telemetry: false, updateNotifier: false}}))
      let cfg = await loadConfig(root, () => {})
      let env = {GRAPHENE_TOKEN: 'test-token'}
      for (let [index, args] of [['evals'], ['evals', 'eval/1'], ['reviews'], ['reviews', 'session/1']].entries()) {
        expectCliOutput(await runCli(args, cfg, {env}), JSON.stringify(results[index], null, 2))
      }
      for (let [index, args] of [['evals'], ['evals', 'eval/1'], ['reviews'], ['reviews', 'session/1']].entries()) {
        expectCliOutput(await runCli([...args, '--days', '30'], cfg, {env}), JSON.stringify(results[index], null, 2))
      }
      for (let command of ['evals', 'reviews']) for (let value of ['0', '-1', '1.5', 'abc', '1e2', '2days', '', '9007199254740992']) {
        expectCliOutput(await runCli([command, '--days', value], cfg, {env}), {code: 1, stderr: 'days must be a positive integer'})
      }
      expect(requests).toEqual([
        'GET /_api/evals?repoSlug=my-project&days=7', 'GET /_api/evals/eval%2F1?repoSlug=my-project',
        'GET /_api/sessionReviews?repoSlug=my-project&completed=true&days=7', 'GET /_api/sessionReviews/session%2F1?repoSlug=my-project&completed=true',
        'GET /_api/evals?repoSlug=my-project&days=30', 'GET /_api/evals/eval%2F1?repoSlug=my-project',
        'GET /_api/sessionReviews?repoSlug=my-project&completed=true&days=30', 'GET /_api/sessionReviews/session%2F1?repoSlug=my-project&completed=true',
      ])
      expectCliOutput(await runCli(['evals'], configFor(root)), {code: 1, stderr: 'Results require a Graphene Cloud project'})
    } finally {
      await new Promise(resolve => server.close(resolve))
      await fsp.rm(root, {recursive: true, force: true})
    }
  })

  test('parses one YAML eval and rejects missing, empty or executable fields', () => {
    expect(parseEval({path: 'evals/revenue/monthly.yaml', contents: 'question: |\n  Show monthly revenue\nrubric: Use refunded sales'})).toEqual(
      {name: 'revenue/monthly', question: 'Show monthly revenue\n', rubric: 'Use refunded sales'},
    )
    expect(parseEval({path: 'evals/foo.yml', contents: 'question: hi\nrubric: okay'})).toEqual({name: 'foo', question: 'hi', rubric: 'okay'})
    for (let contents of ['', '[]', 'question: hi', 'question: " "\nrubric: okay', 'question: hi\nrubric: 7']) {
      expect(() => parseEval({path: 'evals/foo.yaml', contents})).toThrow('evals/foo.yaml: expected question and rubric strings')
    }
    expect(() => parseEval({path: 'evals/foo.yaml', contents: 'question: hi\nrubric: okay\ncommand: rm'})).toThrow('only question and rubric')
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
      ERROR: input line 1: Unknown field "nope" on flights
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

  test('executes keyword CTEs and aliases against flights DuckDB', async ({runCli}) => {
    let query = `
      table full as (from flights where carrier = 'AA' select carrier as date, count() as rows)
      table rows as (from full select *)
      from full full join rows on full.date = rows.date
      select full.date as date, rows.rows as rows order by rows desc
    `
    expectCliOutput(await runCli(['run', query, '--format', 'csv'], flightConfig), `
      date,rows
      AA,34577
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

test('cli check surfaces invalid Markdown frontmatter with its filename', async ({runCli}) => {
  let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-check-frontmatter-'))
  try {
    await fsp.writeFile(path.join(tmpDir, 'report.md'), '---\nscheduled: "0 4 * *"\n---\n# Report')
    let res = await runCli(['check'], configFor(tmpDir))
    expectCliOutput(res, {code: 1, stdout: 'ERROR: report.md: Invalid scheduled report: expected a five-field cron'})
  } finally {
    await fsp.rm(tmpDir, {recursive: true, force: true})
  }
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
