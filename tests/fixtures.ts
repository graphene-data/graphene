import {test as base, expect} from '@playwright/test'
import {startCloudServer} from '../server/runtime.ts'
import {setAuthOverride} from '../server/auth.ts'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({path: path.resolve(import.meta.dirname, '../.env'), quiet: true})
console.log('path', path.resolve(import.meta.dirname, '../.env'))
console.log(process.env.STYTCH_PROJECT_ID)

process.env.NODE_ENV = 'test'

export const test = base.extend<{cloud: {url: string}, realAuth: boolean}>({
  realAuth: [false, {option: true}],

  page: async ({page}, use) => {
    page.on('pageerror', e => console.error('[browser-error]', e))
    // page.on('requestfailed', e => console.log('requestfailed', e))
    page.on('console', msg => {
      let output = `[browser ${msg.type()}] ${msg.text()} ${msg.location()?.url || ''}`
      if (msg.type() === 'error') console.error(output)
      else if (msg.type() === 'warning') console.warn(output)
      else console.log(output)
    })

    await use(page)
  },

  cloud: async ({realAuth}, use) => {
    let handle = await startCloudServer({
      host: '127.0.0.1',
      viteEnv: {
        NODE_ENV: 'test',
        VITE_STYTCH_PUBLIC_TOKEN: process.env.VITE_STYTCH_PUBLIC_TOKEN ?? '',
        VITE_STYTCH_USE_MOCK: realAuth ? 'false' : 'true',
      },
    })
    // setAuthOverride(realAuth ? null : {})

    try {
      await use({url: handle.url})
    } finally {
      await handle.close()
    }
  },
})

test.afterEach(async ({page}) => {
  if (process.env.DEBUG) await page.pause()
})

export {expect}
