import {beforeAll, afterAll} from 'vitest'
import {chromium, Browser, Page} from 'playwright'
import {serve2, clearVirtualFiles, setVirtualFile} from '/workspace/cli/serve2.ts'

let browser: Browser
let page: Page
let baseUrl = 'http://localhost:4100'

declare global {
  // eslint-disable-next-line no-var
  var __E2E__: {
    browser: Browser,
    page: Page,
    baseUrl: string,
    setVirtualFile: (p: string, c: string) => Promise<void>,
  }
}

beforeAll(async () => {
  await serve2({port: 4100, root: '/workspace/examples/flights'})
  browser = await chromium.launch()
  page = await browser.newPage()
  global.__E2E__ = {
    browser,
    page,
    baseUrl,
    setVirtualFile: async (p, c) => setVirtualFile(p, c),
  }
})

afterAll(async () => {
  await clearVirtualFiles()
  if (page) await page.close()
  if (browser) await browser.close()
})

