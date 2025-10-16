import {test as base, expect, type Page, type ConsoleMessage} from '@playwright/test'

import {startCloudServer} from '../server/runtime.ts'
import {setAuthOverride} from '../server/auth.ts'

process.env.NODE_ENV = 'test'

interface AuthOverride {
  userId: string | null
  orgId: string | null
}

export interface CloudContext {
  url: string
  seed: {orgId: string, userId: string}
  setAuth: (auth: AuthOverride | null) => void
  waitForPage: (page: Page, path?: string) => Promise<void>
}

const CONSOLE_LEVELS = new Set(['log', 'warning', 'error'])

declare global {
  interface Window {
    __AUTH_CLIENT__?: {
      setSession?: (session: any) => void
    }
  }
}

export const test = base.extend<{cloud: CloudContext, stytchMock: boolean}>({
  stytchMock: [false, {option: true}],

  page: async ({page}, use) => {
    let handler = (msg: ConsoleMessage) => {
      let type = msg.type()
      if (!CONSOLE_LEVELS.has(type)) return

      let location = msg.location()
      let output = `[browser ${type}] ${msg.text()}`
      if (location?.url) output += ` (${location.url.replace(/^.*frontend\//, 'frontend/')}:${location.lineNumber ?? 0})`

      if (type === 'error') console.error(output)
      else if (type === 'warning') console.warn(output)
      else console.log(output)
    }

    page.on('console', handler)
    try {
      await use(page)
    } finally {
      page.off('console', handler)
    }
  },

  cloud: async ({stytchMock}, use) => {
    let handle = await startCloudServer({
      host: '127.0.0.1',
      viteEnv: {
        VITE_STYTCH_USE_MOCK: stytchMock ? 'true' : 'false',
        VITE_NODE_ENV: 'test',
      },
      authOverride: null,
    })

    let currentAuth: AuthOverride | null = null

    let context: CloudContext = {
      url: handle.url,
      seed: handle.seed ?? {orgId: '', userId: ''},
      setAuth: (auth) => {
        currentAuth = auth
        setAuthOverride(auth)
      },
      waitForPage: async (page, pathname = '/') => {
        await page.goto(handle.url + pathname)
        if (currentAuth?.userId && currentAuth?.orgId) {
          let session = {
            member_session: {
              member_id: currentAuth.userId,
              organization_id: currentAuth.orgId,
            },
          }
          await page.evaluate((sess) => window.__AUTH_CLIENT__?.setSession?.(sess), session)
        } else {
          await page.evaluate(() => window.__AUTH_CLIENT__?.setSession?.(null))
        }
        await page.waitForLoadState('networkidle')
      },
    }

    try {
      setAuthOverride(null)
      await use(context)
    } finally {
      setAuthOverride(null)
      await handle.close()
    }
  },
})

export {expect}
