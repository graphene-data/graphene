import {test, expect} from './fixtures'
import {describe} from 'vitest'

describe('duckdb', () => {
  test('renders the flights overview page', async ({page, cloud}) => {
    await page.goto(cloud.url)
    await expect(page.locator('h1', {hasText: 'Flight Analytics Dashboard'})).toBeVisible()
  })
})

describe('bigquery', () => {
  test.scoped({seedType: 'bigquery'})

  test.skip('renders the index markdown page', async ({page, cloud}) => {
    await page.goto(cloud.url)
    await expect(page.locator('h1', {hasText: 'KPI Summary'})).toBeVisible()
  })
})
