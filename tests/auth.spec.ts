import {test, expect} from './fixtures'

const TEST_EMAIL = 'grant@graphenedata.com'
const TEST_PASSWORD = 'graphenedata'

test.describe('auth', () => {
  test.use({realAuth: true})

  test('login flow', async ({page, cloud}) => {
    await page.goto(cloud.url)
    // should redirect to /login, since we're not authed
    await expect(page.locator('#stytch-login')).toContainText('Sign up or log in')
    await expect(page).toHaveScreenshot('auth-login-form.png')

    let loginShell = page.locator('#stytch-login')
    await loginShell.locator('input[name="email"], input[type="email"]').first().fill(TEST_EMAIL)
    await loginShell.locator('input[name="password"], input[type="password"]').first().fill(TEST_PASSWORD)
    await loginShell.getByRole('button', {name: /continue/i}).click()

    let btn = await page.getByText(/Graphene Dev/i)
    await btn.waitFor()
    await expect(page).toHaveScreenshot('auth-login-flow-org-picker.png')
    await btn.click()

    await expect(page).toHaveURL(`${cloud.url}/`)
    await expect(page.locator('h1', {hasText: 'KPI Summary'})).toBeVisible()
  })

  // test('prevents unauthorized requests', async ({page, cloud}) => {
  //   await cloud.waitForPage(page, '/login')
  //   let response = await page.request.get(`${cloud.url}/_api/pages/index`)
  //   expect(response.status()).toBe(401)
  //   await expect(page).toHaveScreenshot('auth-unauthorized.png')
  // })

  test('shows an error for invalid credentials', async ({page, cloud}) => {
    await page.goto(cloud.url + '/login')
    let loginShell = page.locator('#stytch-login')
    await expect(loginShell).toContainText('Sign up or log in')

    await loginShell.locator('input[name="email"], input[type="email"]').first().fill(TEST_EMAIL)
    await loginShell.locator('input[name="password"], input[type="password"]').first().fill('wrong-password')
    await loginShell.getByRole('button', {name: /continue/i}).click()

    let errorMessage = loginShell.locator('text=/unauthorized credentials|incorrect|invalid|wrong|mismatch|try again/i').first()
    await expect(errorMessage).toBeVisible({timeout: 15_000})
    await expect(page).toHaveURL(`${cloud.url}/login`)
    await expect(page).toHaveScreenshot('auth-invalid-credentials.png')
  })

  // test.skip('can create a new account', async () => {
  //   // Sign-up flow not implemented yet.
  // })
})
