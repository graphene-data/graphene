import {test, expect, expectConsoleError} from './fixtures.ts'
import {describe} from 'vitest'

describe('duckdb', () => {
  test('renders the flights overview page', async ({page, cloud}) => {
    await page.goto(cloud.url)
    await expect(page.locator('h1', {hasText: 'Flight Analytics Dashboard'})).toBeVisible()
  })

  test('shows navigation sidebar with links to pages', async ({page, cloud}) => {
    await page.goto(cloud.url)
    let sidebar = page.locator('nav.sidebar')
    await expect(sidebar).toBeVisible()
    await expect(sidebar.locator('a', {hasText: 'Delays'})).toBeVisible()
    // AGENTS.md is in defaultIgnoredFiles so should not appear
    await expect(sidebar.locator('a', {hasText: 'Agents'})).not.toBeVisible()
  })

  test('navigates to another page via sidebar', async ({page, cloud}) => {
    // Expect warnings from navigating away from page with charts
    expectConsoleError(page, /was created with unknown prop/, true)
    expectConsoleError(page, /ECharts.*has been disposed/, true)
    await page.goto(cloud.url)
    await page.locator('nav.sidebar').locator('a', {hasText: 'Delays'}).click()
    await expect(page).toHaveURL(/\/delays$/)
    await expect(page.locator('h1', {hasText: 'Carrier Delay Deep-Dive'})).toBeVisible()
  })
})

describe('bigquery', () => {
  test.scoped({seedType: 'bigquery'})

  test('renders the index markdown page', async ({page, cloud}) => {
    await page.goto(cloud.url)
    await expect(page.locator('h1', {hasText: 'KPI Summary'})).toBeVisible()
  })
})
