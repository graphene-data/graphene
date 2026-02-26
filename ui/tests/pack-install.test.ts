import {test, expect, waitForGrapheneLoad} from './fixtures.ts'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import * as fsp from 'node:fs/promises'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as net from 'node:net'
import stripAnsi from 'strip-ansi'

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

const shouldRunPackInstallTest = !!process.env.CI || process.env.GRAPHENE_PACK_TEST === '1'

function run (command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<RunResult> {
  return new Promise((resolve) => {
    let child = spawn(command, args, {cwd, env})
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', data => { stdout += data.toString() })
    child.stderr.on('data', data => { stderr += data.toString() })
    child.on('close', code => resolve({code: code ?? 0, stdout, stderr}))
  })
}

function expectSuccess (step: string, result: RunResult) {
  if (result.code === 0) return
  throw new Error(`[pack-install.test] ${step} failed (code ${result.code})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
}

async function getAvailablePort (): Promise<number> {
  return await new Promise((resolve, reject) => {
    let srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      let {port} = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
  })
}

function parseTarballPath (result: RunResult, cwd: string) {
  let matches = Array.from((result.stdout + result.stderr).matchAll(/([^\s]+\.tgz)/g), m => m[1])
  let tarball = matches.at(-1)
  if (!tarball) throw new Error('Could not find packed .tgz path in pnpm pack output')
  return path.isAbsolute(tarball) ? tarball : path.resolve(cwd, tarball)
}

function parseScreenshotPath (output: string, cwd: string) {
  let match = output.match(/Screenshot saved to\s+(.+\.png)/)
  if (!match) throw new Error(`Could not find screenshot path in output:\n${output}`)
  let screenshotPath = match[1].trim()
  return path.isAbsolute(screenshotPath) ? screenshotPath : path.resolve(cwd, screenshotPath)
}

test.skipIf(!shouldRunPackInstallTest)('packs cli and installs it into a user project', {timeout: 300_000}, async ({page}) => {
  let testsDir = path.dirname(fileURLToPath(import.meta.url))
  let coreDir = path.resolve(testsDir, '../..')
  let cliDir = path.join(coreDir, 'cli')
  let flightsDir = path.join(coreDir, 'examples/flights')
  let dbPath = path.join(flightsDir, 'flights.duckdb')
  if (!fs.existsSync(dbPath)) throw new Error('flights.duckdb not found. Run `pnpm run setup` in examples/flights')

  let tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-pack-install-'))
  let projectDir = path.join(tempRoot, 'flights')
  let port = await getAvailablePort()
  let childEnv = {...process.env, NODE_ENV: 'development', GRAPHENE_PORT: String(port)}

  try {
    await page.setViewportSize({width: 1800, height: 1200})

    let packResult = await run('pnpm', ['pack'], cliDir)
    expectSuccess('pnpm pack', packResult)
    let tarballPath = parseTarballPath(packResult, cliDir)

    await fsp.cp(flightsDir, projectDir, {recursive: true, filter: source => path.basename(source) !== 'node_modules'})

    let packageJsonPath = path.join(projectDir, 'package.json')
    let packageJson = JSON.parse(await fsp.readFile(packageJsonPath, 'utf8'))
    packageJson.scripts = {...packageJson.scripts, graphene: 'graphene'}
    await fsp.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')

    let installResult = await run('npm', ['install', tarballPath], projectDir, childEnv)
    expectSuccess('npm install tarball', installResult)

    let serveResult = await run('npm', ['run', 'graphene', '--', 'serve', '--bg'], projectDir, childEnv)
    expectSuccess('npm run graphene serve --bg', serveResult)

    await page.goto(`http://localhost:${port}/`)
    await waitForGrapheneLoad(page)
    await page.waitForTimeout(500)

    let topDelta = await page.evaluate(() => {
      let bigValues = Array.from(document.querySelectorAll('.big-value')) as HTMLElement[]
      if (bigValues.length < 2) return null
      let firstTop = bigValues[0].getBoundingClientRect().top
      let secondTop = bigValues[1].getBoundingClientRect().top
      return Math.abs(firstTop - secondTop)
    })
    expect(topDelta).not.toBeNull()
    expect(topDelta!).toBeLessThan(5)

    let checkResult = await run('npm', ['run', 'graphene', '--', 'check', 'index.md'], projectDir, childEnv)
    expectSuccess('npm run graphene check index.md', checkResult)

    let output = stripAnsi(checkResult.stdout + checkResult.stderr)
    expect(output).toContain('No errors found')

    let screenshotPath = parseScreenshotPath(output, projectDir)
    let screenshot = await fsp.readFile(screenshotPath)
    expect(screenshot.length).toBeGreaterThan(20_000)

    await page.setContent(`<style>body{margin:0;background:white}</style><img id="shot" src="data:image/png;base64,${screenshot.toString('base64')}" />`)
    await expect(page.locator('#shot')).screenshot('packaged-cli-check-index')
  } finally {
    await run('npm', ['run', 'graphene', '--', 'stop'], projectDir, childEnv)
    await fsp.rm(tempRoot, {recursive: true, force: true})
  }
})
