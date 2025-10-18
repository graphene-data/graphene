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
    let emailInput = loginShell.locator('input[name="email"], input[type="email"]').first()
    await emailInput.waitFor({state: 'visible', timeout: 15_000})
    await emailInput.fill(TEST_EMAIL)

    let passwordInput = loginShell.locator('input[name="password"], input[type="password"]').first()
    await passwordInput.fill(TEST_PASSWORD)

    await loginShell.getByRole('button', {name: /continue/i}).click()

    // todo: this should redirect to the org picker, we need to pick "Graphene Dev"

    let orgOption = page.getByText(/Graphene Dev/i)
    await orgOption.waitFor({timeout: 15_000})
    await orgOption.click()

    await expect(page).toHaveURL(`${cloud.url}/`)
    await expect(page.locator('h1', {hasText: 'KPI Summary'})).toBeVisible()
  })

  // test('prevents unauthorized requests', async ({page, cloud}) => {
  //   await cloud.waitForPage(page, '/login')
  //   let response = await page.request.get(`${cloud.url}/_api/pages/index`)
  //   expect(response.status()).toBe(401)
  //   await expect(page).toHaveScreenshot('auth-unauthorized.png')
  // })

  // test('shows an error for invalid credentials', async ({page, cloud}) => {
  //   await cloud.waitForPage(page, '/login')
  //   let frame = stytchFrame(page)
  //   let emailInput = frame.locator('input[type="email"]')
  //   await emailInput.waitFor({state: 'visible', timeout: 15_000})
  //   await emailInput.fill(TEST_EMAIL)

  //   let passwordInput = frame.locator('input[type="password"]')
  //   await passwordInput.fill('wrong-password')

  //   await frame.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Continue")').first().click()
  //   await expect(frame.locator('text=/incorrect|invalid/i')).toBeVisible({timeout: 15_000})
  //   await expect(page).toHaveScreenshot('auth-invalid-credentials.png')
  // })

  // test.skip('can create a new account', async () => {
  //   // Sign-up flow not implemented yet.
  // })
})
