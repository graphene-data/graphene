import {test as base, expect} from '@playwright/test'
import {loadDbSetup, startDevServer, type SeedType} from '../server/dev.ts'
import net from 'net'
import dotenv from 'dotenv'
import path from 'path'
import {withBrowserConsole, expectConsoleError} from '../../core/ui/tests/browserConsole.ts'

dotenv.config({path: path.resolve(import.meta.dirname, '../.env'), quiet: true})
console.log('path', path.resolve(import.meta.dirname, '../.env'))
console.log(process.env.STYTCH_PROJECT_ID)

process.env.NODE_ENV = 'test'

export const test = base.extend<{cloud: {url: string}, realAuth: boolean, seedType: SeedType}>({
  page: async ({page}, use) => {
    await withBrowserConsole(page, use)
  },
  realAuth: [false, {option: true}],
  seedType: ['duckdb', {option: true}],

  cloud: async ({realAuth, page, seedType}, use) => {
    let port = realAuth ? 3121 : await getAvailablePort()
    let handle = await startDevServer({realAuth, port, seedType})

    try {
      await use({url: handle.url})
    } finally {
      if (!page.isClosed()) await page.close()
      await handle.close()
    }
  },
})

test.beforeAll(async () => {
  await loadDbSetup()
})

test.afterEach(async ({page}) => {
  if (process.env.DEBUG) await page.pause()
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
