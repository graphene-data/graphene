import {test as base, onTestFinished} from 'vitest'
import {chromium, type Browser, type Page} from 'playwright'
import {playwrightExpect as expect} from '../../core/ui/tests/matchers.ts'
import {startDevServer, type SeedType} from '../server/dev.ts'
import {setupPglite} from '../server/db.ts'
import net from 'net'
import dotenv from 'dotenv'
import path from 'path'
import {assertConsoleErrors, trackerBrowserConsole, expectConsoleError, stopTrackingConsole} from '../../core/ui/tests/browserConsole.ts'

dotenv.config({path: path.resolve(import.meta.dirname, '../../.env'), quiet: true})

// Load pglite classes once before all tests, with a random port for parallel execution
await setupPglite(await getAvailablePort())

interface CloudOptions {
  realAuth: boolean
  seedType: SeedType
}

export const test = base.extend<{browser: Browser, page: Page, cloud: {url: string}} & CloudOptions>({
  realAuth: false,
  seedType: 'duckdb',

  // eslint-disable-next-line no-empty-pattern
  browser: async ({}, use) => {
    let b = await chromium.launch({
      headless: !process.env.GRAPHENE_DEBUG,
      devtools: !!process.env.GRAPHENE_DEBUG,
      args: [
        '--font-render-hinting=none', // Consistent font rendering across platforms
      ],
    })
    await use(b)
    await b.close()
  },

  // cloud starts BEFORE page so it tears down AFTER page - this ensures the server is still running during assertions
  cloud: async ({realAuth, seedType}, use) => {
    let port = realAuth ? 3121 : await getAvailablePort()
    let handle = await startDevServer({realAuth, port, seedType})
    try {
      await use({url: handle.url})
    } finally {
      await handle.close()
    }
  },

  // page depends on cloud so it sets up after and tears down before (server still running during teardown)
  page: async ({browser, cloud: _cloud}, use) => {
    let context = await browser.newContext({deviceScaleFactor: 2})
    let page = await context.newPage()
    trackerBrowserConsole(page)
    onTestFinished(() => {
      assertConsoleErrors(page)
      stopTrackingConsole(page)
    })
    await use(page)
    if (process.env.GRAPHENE_DEBUG) await new Promise(() => { })
    await context.close()
  },
})

export {expect, expectConsoleError}

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
