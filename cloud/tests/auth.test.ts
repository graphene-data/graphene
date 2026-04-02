import {describe} from 'vitest'

import {loginPkce} from '../../core/cli/auth.ts'
import {runQuery} from '../../core/cli/connections/index.ts'
import {setConfig} from '../../core/lang/config.ts'
import {orgs} from '../schema.ts'
import {getDb} from '../server/db.ts'
import {test, expect, expectConsoleError} from './fixtures.ts'

const TEST_EMAIL = 'grant@graphenedata.com'
const TEST_PASSWORD = 'graphenedata'

describe('auth', () => {
  test.scoped({realAuth: true})

  test('login flow', async ({page, cloud}) => {
    // should redirect to /login, since we're not authed
    await page.goto(cloud.url)
    expectConsoleError(/the server responded with a status of 401/)
    expectConsoleError(/Authentication required/)

    await expect(page.locator('#stytch-login')).toContainText('Sign up or log in')
    // disable this, as stytches styling seems to be unstable as to whether or not the corners are rounded
    // await expect(page).screenshot('auth-login-form')

    let loginShell = page.locator('#stytch-login')
    await loginShell.locator('input[name="email"], input[type="email"]').first().fill(TEST_EMAIL)
    await loginShell.locator('input[name="password"], input[type="password"]').first().fill(TEST_PASSWORD)
    await loginShell.getByRole('button', {name: /continue/i}).click()

    await expect(page).toHaveURL(`${cloud.url}/flights`) // timeouts here imply the stytch auth took too long
    await expect(page.locator('h1', {hasText: 'Flight Analytics Dashboard'})).toBeVisible()
  })

  test('prevents unauthorized requests', async ({page, cloud}) => {
    await page.goto(cloud.url + '/login')
    let pageRes = await page.request.get(`${cloud.url}/_api/pages/index`)
    expect(pageRes.status()).toBe(401)

    let queryRes = await page.request.post(`${cloud.url}/_api/query`, {
      data: {repoId: 'testrepo', sql: 'select 1'},
    })
    expect(queryRes.status()).toBe(401)
  })

  test('shows an error for invalid credentials', async ({page, cloud}) => {
    expectConsoleError('Failed to load resource')
    await page.goto(cloud.url + '/login')
    let loginShell = page.locator('#stytch-login')
    await expect(loginShell).toContainText('Sign up or log in')

    await loginShell.locator('input[name="email"], input[type="email"]').first().fill(TEST_EMAIL)
    await loginShell.locator('input[name="password"], input[type="password"]').first().fill('wrong-password')
    await loginShell.getByRole('button', {name: /continue/i}).click()

    let errorMessage = loginShell.locator('text=/unauthorized credentials|incorrect|invalid|wrong|mismatch|try again/i').first()
    await expect(errorMessage).toBeVisible({timeout: 15_000})
    await expect(page).toHaveURL(`${cloud.url}/login`)
    await expect(page).screenshot('auth-invalid-credentials')
  })

  // Skip: Stytch IDP/connected apps feature needs to be configured in test project
  test('cli pkce login works', async ({page, cloud}) => {
    setConfig({root: 'test', host: cloud.url})
    expectConsoleError(/Failed to load resource.*127.0.0.1.*favicon.ico/)

    await loginPkce(async url => {
      await page.goto(url)
      let loginShell = page.locator('#stytch-login')
      await loginShell.locator('input[name="email"], input[type="email"]').first().fill(TEST_EMAIL)
      await loginShell.locator('input[name="password"], input[type="password"]').first().fill(TEST_PASSWORD)
      await loginShell.getByRole('button', {name: /continue/i}).click()

      await expect(page.getByText('Graphene CLI is requesting to')).toBeVisible()
      // await page.getByText('Graphene CLI is requesting to').isVisible()
      // await new Promise(() => { })
      await expect(page).screenshot('auth-allow-cli')
      await page.getByText('Allow').click()
      await expect(page.getByText('Login complete')).toBeVisible()
    })

    let res = await runQuery('select count(*) from flights')
    expect(res.rows[0]['count_star()']).toBe(344827)
  })

  // test.skip('can create a new account', async () => {
  //   // Sign-up flow not implemented yet.
  // })
})

test('validates subdomains', async ({page, cloud}) => {
  await getDb().update(orgs).set({slug: 'dev'})

  let r1 = await page.request.get(`${cloud.url}/_api/pages/flights/index`, {
    headers: {host: 'wrong.localhost'},
  })
  expect(r1.status()).toBe(403)
  let body = await r1.json()
  expect(body.error).toBe('Incorrect subdomain')
  expect(body.correctDomain).toBe('dev.localhost')

  let r2 = await page.request.get(`${cloud.url}/_api/pages/flights/index`, {
    headers: {host: 'dev.localhost'},
  })
  expect(r2.status()).toBe(200)
})
