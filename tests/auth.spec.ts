import {test, expect} from './fixtures'

declare global {
  interface Window {
    __AUTH_CLIENT__?: {
      completeLogin?: (session?: {member_id: string, organization_id: string}) => void
      getMountConfig?: () => any
      setSession?: (session: any) => void
    }
  }
}

test.describe('auth', () => {
  test.use({stytchMock: true})

  test('mounts the auth client on the login page', async ({page, cloud}) => {
    await cloud.waitForPage(page, '/login')
    let mount = await page.evaluate(() => window.__AUTH_CLIENT__?.getMountConfig() ?? null)
    expect(mount).not.toBeNull()
    expect(mount.elementId).toBe('#stytch-login')
  })

  test('redirects to home after authentication', async ({page, cloud}) => {
    await cloud.waitForPage(page, '/login')
    await page.evaluate(() => window.__AUTH_CLIENT__?.completeLogin({member_id: 'test-member', organization_id: 'test-org'}))
    await expect(page).toHaveURL(cloud.url + '/')
  })

  test('configures password-based login flow', async ({page, cloud}) => {
    await cloud.waitForPage(page, '/login')
    let config = await page.evaluate(() => window.__AUTH_CLIENT__?.getMountConfig()?.config ?? null)
    expect(config).not.toBeNull()
    expect(config.authFlowType).toBe('Discovery')
    expect(config.products).toContain('passwords')
    expect(config.sessionOptions.sessionDurationMinutes).toBe(60 * 24 * 30)
  })
})
