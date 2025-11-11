import {test, expect} from './fixtures'

test.describe('duckdb', () => {
  test('renders the flights overview page', async ({page, cloud}) => {
    await page.goto(cloud.url)
    await expect(page.locator('h1', {hasText: 'Flight Analytics Dashboard'})).toBeVisible()
  })
})

test.describe('bigquery', () => {
  test.use({seedType: 'bigquery'})

  test('renders the index markdown page', async ({page, cloud}) => {
    await page.goto(cloud.url)
    await expect(page.locator('h1', {hasText: 'KPI Summary'})).toBeVisible()
  })
})
