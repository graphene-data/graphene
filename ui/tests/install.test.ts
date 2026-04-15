import {spawn} from 'node:child_process'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import {fileURLToPath} from 'node:url'

import {test, expect, waitForGrapheneLoad, getAvailablePort} from './fixtures.ts'
import {expectConsoleError} from './logWatcher.ts'

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<RunResult> {
  return new Promise(resolve => {
    let child = spawn(command, args, {cwd, env})
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', data => {
      stdout += data.toString()
    })
    child.stderr.on('data', data => {
      stderr += data.toString()
    })
    child.on('close', code => resolve({code: code ?? 0, stdout, stderr}))
  })
}

function getOutput(res: RunResult) {
  let lines = (res.stdout + res.stderr).split('\n')
  lines = lines.filter(l => !l.startsWith('npm warn Unknown env config') && !l.startsWith('npm warn Unknown global config'))
  return lines.join('\n').trim()
}

function expectSuccess(step: string, result: RunResult) {
  if (result.code === 0) return
  throw new Error(`[install.test] ${step} failed (code ${result.code})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
}

function parseTarballPath(result: RunResult, cwd: string) {
  let matches = Array.from((result.stdout + result.stderr).matchAll(/([^\s]+\.tgz)/g), m => m[1])
  let tarball = matches.at(-1)
  if (!tarball) throw new Error('Could not find packed .tgz path in pnpm pack output')
  return path.isAbsolute(tarball) ? tarball : path.resolve(cwd, tarball)
}

test.skipIf(!process.env.SLOW_TEST)('install graphene and use it', {timeout: 300_000}, async ({page}) => {
  let testsDir = path.dirname(fileURLToPath(import.meta.url))
  let coreDir = path.resolve(testsDir, '../..')
  let createDir = path.join(coreDir, 'create')
  let cliDir = path.join(coreDir, 'cli')

  let tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-install-'))
  let projectDir = path.join(tempRoot, 'demo-app')
  let port = await getAvailablePort()
  let childEnv = {...process.env, GRAPHENE_PORT: String(port)} as any
  delete childEnv.NODE_ENV
  let createTarball: string | undefined
  let cliTarball: string | undefined

  try {
    await page.setViewportSize({width: 1800, height: 1200})

    let packCreate = await run('pnpm', ['pack'], createDir)
    expectSuccess('pnpm pack create', packCreate)
    createTarball = parseTarballPath(packCreate, createDir)

    let packCli = await run('pnpm', ['pack'], cliDir)
    expectSuccess('pnpm pack cli', packCli)
    cliTarball = parseTarballPath(packCli, cliDir)

    let scaffold = await run('npm', ['exec', '--yes', '--package', createTarball, '--', 'create-graphenedata', 'demo-app', '--yes', '--no-install'], tempRoot, childEnv)
    expectSuccess('npm exec create-graphenedata', scaffold)

    let installResult = await run('npm', ['install', cliTarball], projectDir, childEnv)
    expectSuccess('npm install tarball', installResult)

    // add actual data and a page with a real chart, so our smoke test will
    // also ensure the queries and viz actually work
    let flightsDbPath = path.join(coreDir, 'examples/flights/flights.duckdb')
    await fsp.symlink(flightsDbPath, path.join(projectDir, 'data.duckdb'))
    await fsp.writeFile(
      path.join(projectDir, 'models.gsql'),
      `table flights (
  carrier VARCHAR
  dep_delay BIGINT
)
`,
    )
    await fsp.writeFile(
      path.join(projectDir, 'chart.md'),
      `# Flight delays by carrier

\`\`\`sql carrier_delays
select carrier, avg(dep_delay) as avg_dep_delay
from flights
group by 1
order by 2 desc
limit 10
\`\`\`

<BarChart data=carrier_delays x=carrier y=avg_dep_delay />
`,
    )

    // `serve` wont return until we kill the server.
    // We could run this in the background with `--bg`, but then have to worry about zombie servers if the test fails
    void run('npm', ['run', 'graphene', '--', 'serve'], projectDir, childEnv)

    // we need to wait until the server has started up, but it's hard to know exactly when that is, unless we were to watch the output
    await page.waitForTimeout(3000)

    // Snapshot the live page with Playwright while the packaged server is running.
    // The ideal here would actually be to test the screenshot we got back from `run`, but that's currently differs between local and
    // ci because html2canvas does not preserve chart svg fonts, meaning we fall back to system ui fonts.
    await page.goto(`http://localhost:${port}/chart`)
    await waitForGrapheneLoad(page)
    await page.evaluate(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    await page.waitForTimeout(500)
    await expect(page).screenshot('packaged-cli-check-index')

    let checkResult = await run('npm', ['run', 'graphene', '--', 'check'], projectDir, childEnv)
    expectSuccess('graphene check', checkResult)
    expect(getOutput(checkResult)).toEqual(
      `
> demo-app@0.0.1 graphene
> graphene check

No errors found 💎`.trim(),
    )
    console.log('checked')

    let runResult = await run('npm', ['run', 'graphene', '--', 'run', 'chart.md'], projectDir, childEnv)
    expectSuccess('graphene run index.md', runResult)
    expect(getOutput(runResult).replace(/graphene-screenshot-.*\.png/, 'graphene-screenshot.png')).toEqual(
      `
> demo-app@0.0.1 graphene
> graphene run chart.md

No errors found 💎
Screenshot saved to /tmp/graphene-screenshot.png
      `.trim(),
    )
  } finally {
    expectConsoleError(/WebSocket connection to 'ws:\/\/(localhost|127\.0\.0\.1):\d+\/_api\/ws' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED/)
    await run('npm', ['run', 'graphene', '--', 'stop'], projectDir, childEnv) // extra stop, in case the test failed before the regular `stop` above
    await fsp.rm(tempRoot, {recursive: true, force: true})
  }
})
