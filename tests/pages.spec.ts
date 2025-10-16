import {test, expect} from './fixtures'

test.describe('pages', () => {
  test.use({stytchMock: true})

  test.beforeEach(async ({cloud}) => {
    cloud.setAuth({userId: cloud.seed.userId, orgId: cloud.seed.orgId})
  })

  test.afterEach(async ({cloud}) => {
    cloud.setAuth(null)
  })

  test('renders the index markdown page', async ({page, cloud}) => {
    await cloud.waitForPage(page, '/')

    await expect(page.locator('h1', {hasText: 'KPI Summary'})).toBeVisible()
  })
})
