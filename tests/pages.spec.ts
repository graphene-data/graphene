import {test, expect} from './fixtures'

test.describe('pages', () => {
  test('renders the index markdown page', async ({page, cloud}) => {
    await page.goto(cloud.url)
    await expect(page.locator('h1', {hasText: 'KPI Summary'})).toBeVisible()
  })
})
