import {test as base} from 'vitest'
import {chromium, type Browser, type Page} from 'playwright'
import {playwrightExpect as expect} from '../../core/ui/tests/matchers.ts'
import {startDevServer} from '../server/dev.ts'
import {setupPglite} from '../server/db.ts'
import net from 'net'
import dotenv from 'dotenv'
import path from 'path'
import {trackBrowserConsole, expectConsoleError, onServerLog} from '../../core/ui/tests/logWatcher.ts'

dotenv.config({path: path.resolve(import.meta.dirname, '../../.env'), quiet: true})

// Load pglite classes once before all tests, with a random port for parallel execution
await setupPglite(await getAvailablePort())

interface CloudOptions {
  realAuth: boolean
  project: string
}

export const test = base.extend<{browser: Browser, page: Page, cloud: {url: string}} & CloudOptions>({
  realAuth: false,
  project: 'flights',

  // eslint-disable-next-line no-empty-pattern
  browser: async ({}, use) => {
    let b = await chromium.launch({
      headless: !process.env.GRAPHENE_DEBUG,
      args: [
        '--font-render-hinting=none', // Consistent font rendering across platforms
        '--disable-font-subpixel-positioning', // Avoid tiny per-glyph edge drift across OS builds
        '--disable-lcd-text', // Use grayscale AA instead of subpixel AA for more stable screenshots
        '--force-color-profile=srgb',
        '--lang=en-US',
        ...(process.env.GRAPHENE_DEBUG ? ['--auto-open-devtools-for-tabs'] : []),
      ],
    })
    await use(b)
    await b.close()
  },

  // cloud starts BEFORE page so it tears down AFTER page - this ensures the server is still running during assertions
  cloud: async ({realAuth, project}, use) => {
    let port = realAuth ? 3121 : await getAvailablePort()
    // custom logger allows us to fail if the server logs an error we don't expect
    let logger = {level: 'warn', stream: {write: (line: string) => onServerLog(line.trimEnd())}}
    let handle = await startDevServer({realAuth, port, project, logger})
    try {
      await use({url: handle.url})
    } finally {
      await handle.close()
    }
  },

  // page depends on cloud so it sets up after and tears down before (server still running during teardown)
  page: async ({browser, cloud: _cloud}, use) => {
    let context = await browser.newContext({
      viewport: {width: 1280, height: 720},
      deviceScaleFactor: 2,
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'reduce',
    })
    let page = await context.newPage()
    trackBrowserConsole(page)
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
