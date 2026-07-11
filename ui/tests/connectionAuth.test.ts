import type {Page} from '@playwright/test'

import {generate} from 'otplib'

import {SnowflakeConnection} from '../../cli/connections/snowflake.ts'
import {setGlobalConfig} from '../../lang/config.ts'
import {test, expect} from './fixtures.ts'

async function loginToSnowflakeOAuth(page: Page, url: string, opts: {username: string; password: string; mfaSecret: string}) {
  await page.goto(url, {waitUntil: 'domcontentloaded'})
  await page.locator('input').first().waitFor({state: 'visible', timeout: 60_000})

  let inputs = page.locator('input:visible')
  if ((await inputs.count()) >= 2) {
    await inputs.nth(0).fill(opts.username)
    await inputs.nth(1).fill(opts.password)
  } else {
    await inputs.first().fill(opts.username)
    await page.getByRole('button', {name: /^(continue|next|log in|sign in)$/i}).click()
    await page.locator('input[type="password"], input[autocomplete="current-password"]').first().fill(opts.password)
  }
  await page.getByRole('button', {name: /^(continue|next|log in|sign in)$/i}).click()

  let mfaInput = page.locator('input[autocomplete="one-time-code"], input[name*="passcode" i], input[name*="code" i]').first()
  await mfaInput.waitFor({state: 'visible', timeout: 60_000})
  if (30 - (Math.floor(Date.now() / 1000) % 30) < 5) await page.waitForTimeout(5_000)
  await mfaInput.fill(await generate({secret: opts.mfaSecret}))
  await page.getByRole('button', {name: /continue|verify|submit|next/i}).click()

  let deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (page.url().startsWith('http://localhost') || page.url().startsWith('http://127.0.0.1')) return
    let consentButton = page.getByRole('button', {name: /allow|authorize|approve/i}).first()
    if (await consentButton.isVisible().catch(() => false)) await consentButton.click()
    await page.waitForTimeout(500)
  }
  throw new Error('Timed out waiting for Snowflake OAuth localhost redirect')
}

test.skipIf(!process.env.SLOW_TEST)(
  'snowflake oauth cli login works',
  async ({page}) => {
    let account = 'ADARJVR-VE40413'
    let username = 'demouser'
    let password = process.env.SNOWFLAKE_AUTH_PASSWORD
    let mfaSecret = process.env.SNOWFLAKE_MFA_SECRET
    if (!account || !username || !password || !mfaSecret)
      throw new Error('Snowflake OAuth browser test requires SNOWFLAKE_ACCOUNT, SNOWFLAKE_AUTH_USERNAME, SNOWFLAKE_AUTH_PASSWORD, and SNOWFLAKE_MFA_SECRET')

    setGlobalConfig({root: 'test', dialect: 'snowflake', snowflake: {account, username}})

    // Match the Snowflake branch of `graphene login`: no key-pair auth and no password/MFA in the
    // SDK options. Snowflake's SDK needs the username for its credential-cache key; the password and
    // MFA code are only entered in the browser.
    let loginConn = new SnowflakeConnection({
      account,
      username,
      authenticator: 'OAUTH_AUTHORIZATION_CODE',
      openExternalBrowserCallback: url => void loginToSnowflakeOAuth(page, url, {username, password, mfaSecret}),
      role: 'DEMOREAD',
      warehouse: 'COMPUTE_WH',
    } as any)
    await loginConn.close()
    await expect(page).screenshot('snowflake-oauth-login-complete')

    let conn = new SnowflakeConnection({
      account,
      username,
      authenticator: 'OAUTH_AUTHORIZATION_CODE',
      openExternalBrowserCallback: () => {
        throw new Error('Cached OAuth credential was not used')
      },
      role: 'DEMOREAD',
      warehouse: 'COMPUTE_WH',
    } as any)
    try {
      let res = await conn.runQuery('select count(*) as "menu_count" from FOOD__BEVERAGE_ESTABLISHMENT__MENU_DATA.V02.MENUS')
      expect(Number(res.rows[0].menu_count)).toBeGreaterThan(0)
    } finally {
      await conn.close()
    }
  },
  180_000,
)
