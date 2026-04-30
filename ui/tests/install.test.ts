import type {Page} from '@playwright/test'

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

interface PackageManagerTest {
  name: 'npm' | 'pnpm' | 'yarn'
  create: (tarball: string) => [string, string[]]
  install: (tarball: string) => [string, string[]]
  graphene: (args: string[]) => [string, string[]]
}

function expectSuccess(step: string, result: RunResult) {
  if (result.code === 0) return
  throw new Error(`[install.test] ${step} failed (code ${result.code})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
}

function parseTarballPath(result: RunResult, cwd: string) {
  let matches = Array.from((result.stdout + result.stderr).matchAll(/([^\s]+\.tgz)/g), m => m[1])
  let tarball = matches.at(-1)
  if (!tarball) throw new Error('Could not find packed .tgz path in pack output')
  return path.isAbsolute(tarball) ? tarball : path.resolve(cwd, tarball)
}

// pnpm dlx caches local tarballs by their source path/version, so reusing the packed file in the package
// directory can run stale code after local changes. Copy it into this test's temp dir to force a fresh package source.
async function copyTarballToTemp(tarball: string, tempRoot: string) {
  let tempTarball = path.join(tempRoot, path.basename(tarball))
  await fsp.copyFile(tarball, tempTarball)
  return tempTarball
}

async function expectNoSvelteDependency(projectDir: string) {
  let pkg = JSON.parse(await fsp.readFile(path.join(projectDir, 'package.json'), 'utf8'))
  expect(pkg.dependencies?.svelte).toBeUndefined()
}

async function installGrapheneAndUseIt(packageManager: PackageManagerTest, page: Page) {
  let testsDir = path.dirname(fileURLToPath(import.meta.url))
  let coreDir = path.resolve(testsDir, '../..')
  let createDir = path.join(coreDir, 'create')
  let cliDir = path.join(coreDir, 'cli')

  let tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-install-'))
  let projectDir = path.join(tempRoot, 'demo-app')
  let port = await getAvailablePort()
  let childEnv = {...process.env, GRAPHENE_PORT: String(port)} as any
  delete childEnv.NODE_ENV

  try {
    await page.setViewportSize({width: 1800, height: 1200})

    let packCreate = await run('pnpm', ['pack'], createDir)
    expectSuccess('pnpm pack create', packCreate)
    let createTarball = await copyTarballToTemp(parseTarballPath(packCreate, createDir), tempRoot)

    let buildCli = await run('pnpm', ['build'], cliDir)
    expectSuccess('pnpm build cli', buildCli)

    let cliNpmDir = path.join(cliDir, 'dist/npm')
    let packCli = await run('pnpm', ['pack'], cliNpmDir)
    expectSuccess('pnpm pack cli/dist/npm', packCli)
    let cliTarball = await copyTarballToTemp(parseTarballPath(packCli, cliNpmDir), tempRoot)

    let [createCommand, createArgs] = packageManager.create(createTarball)
    let scaffold = await run(createCommand, createArgs, tempRoot, childEnv)
    expectSuccess(`${packageManager.name} create-graphenedata`, scaffold)
    await expectNoSvelteDependency(projectDir)

    let [installCommand, installArgs] = packageManager.install(cliTarball)
    let installResult = await run(installCommand, installArgs, projectDir, childEnv)
    expectSuccess(`${packageManager.name} install tarball`, installResult)
    await expectNoSvelteDependency(projectDir)

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
    let [serveCommand, serveArgs] = packageManager.graphene(['serve'])
    void run(serveCommand, serveArgs, projectDir, childEnv)

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
    await expect(page).screenshot('packaged-cli-check-index-' + packageManager.name)

    let [checkCommand, checkArgs] = packageManager.graphene(['check'])
    let checkResult = await run(checkCommand, checkArgs, projectDir, childEnv)
    expectSuccess('graphene check', checkResult)
    expect(getOutput(checkResult)).toContain('No errors found 💎')
    console.log('checked')

    let [runCommand, runArgs] = packageManager.graphene(['run', 'chart.md'])
    let runResult = await run(runCommand, runArgs, projectDir, childEnv)
    expectSuccess('graphene run chart.md', runResult)
    let runOutput = getOutput(runResult).replace(/graphene-screenshot-.*\.png/, 'graphene-screenshot.png')
    expect(runOutput).toContain('No errors found 💎')
    expect(runOutput).toContain('Screenshot saved to /tmp/graphene-screenshot.png')
  } finally {
    expectConsoleError(/WebSocket connection to 'ws:\/\/(localhost|127\.0\.0\.1):\d+\/_api\/ws' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED/)
    let [stopCommand, stopArgs] = packageManager.graphene(['stop'])
    await run(stopCommand, stopArgs, projectDir, childEnv) // extra stop, in case the test failed before the regular `stop` above
    await fsp.rm(tempRoot, {recursive: true, force: true})
  }
}

test.skipIf(!process.env.SLOW_TEST)('install graphene and use it with npm', {timeout: 300_000}, async ({page}) => {
  await installGrapheneAndUseIt(
    {
      name: 'npm',
      create: tarball => ['npm', ['exec', '--yes', '--package', tarball, '--', 'create-graphenedata', 'demo-app', '--yes', '--no-install']],
      install: tarball => ['npm', ['install', tarball]],
      graphene: args => ['npm', ['run', 'graphene', '--', ...args]],
    },
    page,
  )
})

test.skipIf(!process.env.SLOW_TEST)('install graphene and use it with pnpm', {timeout: 300_000}, async ({page}) => {
  await installGrapheneAndUseIt(
    {
      name: 'pnpm',
      create: tarball => ['pnpm', ['dlx', '--package', tarball, 'create-graphenedata', 'demo-app', '--yes', '--no-install']],
      install: tarball => ['pnpm', ['add', tarball]],
      graphene: args => ['pnpm', ['run', 'graphene', '--', ...args]],
    },
    page,
  )
})

test.skipIf(!process.env.SLOW_TEST)('install graphene and use it with yarn', {timeout: 300_000}, async ({page}) => {
  await installGrapheneAndUseIt(
    {
      name: 'yarn',
      create: tarball => ['corepack', ['yarn@4.12.0', 'dlx', '--package', tarball, 'create-graphenedata', 'demo-app', '--yes', '--no-install']],
      install: tarball => ['corepack', ['yarn@4.12.0', 'add', tarball]],
      graphene: args => ['corepack', ['yarn@4.12.0', 'run', 'graphene', ...args]],
    },
    page,
  )
})
