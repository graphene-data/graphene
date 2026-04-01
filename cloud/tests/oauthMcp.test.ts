import {execSync, spawn, type ChildProcess} from 'node:child_process'

import type {Page} from 'playwright'

import {test, expect} from './fixtures.ts'

const TEST_EMAIL = 'grant@graphenedata.com'
const TEST_PASSWORD = 'graphenedata'

const RENDER_MD_INPUT = {
  markdown:
    "## Trends over time \n```sql flight_count\n from flights select date_trunc('week', dep_time) as week, count(*) as flight_count\n```\n\n<LineChart title=\"Flights by week\" data=\"flight_count\" x=\"week\" y=\"flight_count\" />",
}

test.scoped({realAuth: true})

test('mcp oauth flow works in inspector and render-md shows chart data', {timeout: 120_000}, async ({page, cloud}) => {
  let inspector = await startInspector(cloud.url)

  try {
    await page.goto(inspector.url, {waitUntil: 'commit'})
    await page.locator('button:has-text("Connect")').first().click()

    await completeOauthIfPrompted(page)

    await expect(page.getByText('Connected')).toBeVisible({timeout: 20_000})
    await page.locator('button:has-text("Tools")').first().click()
    await page.locator('button:has-text("List Tools")').first().click()

    await expect(page.getByText('render-md')).toBeVisible({timeout: 20_000})
    await page.getByText('render-md').first().click()
    await page.locator('textarea').first().fill(JSON.stringify(RENDER_MD_INPUT))
    await page.locator('button:has-text("Run Tool")').first().click()

    await expect(page.getByText('tools/call')).toBeVisible({timeout: 20_000})

    await page.locator('button:has-text("Apps")').first().click()
    await expect(page.getByText('MCP Apps')).toBeVisible({timeout: 20_000})
    await page.getByText('render-md').first().click()

    let frame = page.frameLocator('iframe').first()
    await expect(frame.getByText('Flights by week')).toBeVisible({timeout: 20_000})
    await expect(frame.locator('canvas')).toBeVisible({timeout: 20_000})
    await expect(page).screenshot('mcp-inspector-render-md-chart')
  } finally {
    await inspector.close()
  }
})

async function completeOauthIfPrompted(page: Page) {
  let popupPromise = page.context().waitForEvent('page', {timeout: 7000}).catch(() => null)
  let popup = await popupPromise

  let authPage = popup
  if (!authPage && page.url().includes('/authenticate')) authPage = page
  if (!authPage) return

  await authPage.waitForLoadState('domcontentloaded')

  let email = authPage.locator('#stytch-login input[name="email"], #stytch-login input[type="email"]').first()
  if (await email.isVisible({timeout: 5000}).catch(() => false)) {
    await email.fill(TEST_EMAIL)
    await authPage.locator('#stytch-login input[name="password"], #stytch-login input[type="password"]').first().fill(TEST_PASSWORD)
    await authPage.locator('#stytch-login').getByRole('button', {name: /continue/i}).click()
  }

  await expect(authPage.getByText(/is requesting to/i)).toBeVisible({timeout: 20_000})
  await authPage.getByText('Allow').click()

  if (popup) await popup.close().catch(() => {})
}

async function startInspector(cloudUrl: string): Promise<{url: string; close: () => Promise<void>}> {
  cleanupInspectorPorts()

  let child = spawn('npx', ['-y', '@modelcontextprotocol/inspector', '--transport', 'http', '--server-url', `${cloudUrl}/_api/mcp`], {
    cwd: process.cwd(),
    env: {...process.env, BROWSER: 'none', DANGEROUSLY_OMIT_AUTH: 'true'},
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  await waitForInspectorStartup(child)
  return {
    url: 'http://localhost:6274',
    close: async () => {
      try {
        process.kill(-child.pid!, 'SIGKILL')
      } catch {}
      cleanupInspectorPorts()
    },
  }
}

function cleanupInspectorPorts() {
  try {
    let out = execSync('lsof -ti :6274 -ti :6277', {encoding: 'utf8'}).trim()
    if (!out) return
    for (let line of out.split('\n')) {
      let pid = Number(line.trim())
      if (Number.isFinite(pid) && pid > 0) {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {}
      }
    }
  } catch {}
}

async function waitForInspectorStartup(child: ChildProcess) {
  let deadline = Date.now() + 30_000
  let logs = ''

  child.stdout?.on('data', data => {
    logs += data.toString()
  })
  child.stderr?.on('data', data => {
    logs += data.toString()
  })

  while (Date.now() < deadline) {
    try {
      let res = await fetch('http://localhost:6274')
      if (res.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  throw new Error(`Inspector did not start. Logs:\n${logs}`)
}
