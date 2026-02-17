import {test, expect, expectConsoleError} from './fixtures.ts'
import {describe} from 'vitest'
import {and, eq} from 'drizzle-orm'
import {getDb} from '../server/db.ts'
import {files} from '../schema.ts'
import {repoId} from '../server/dev.ts'

describe('duckdb', () => {
  test('renders the flights overview page', async ({page, cloud}) => {
    await page.goto(cloud.url)
    await expect(page.locator('h1', {hasText: 'Flight Analytics Dashboard'})).toBeVisible()
    await expect(page).screenshot('flights-overview')
  })

  test('shows navigation sidebar with links to pages', async ({page, cloud}) => {
    await page.goto(cloud.url)
    let nav = page.locator('nav')
    await expect(nav).toBeVisible()
    await expect(nav.locator('a', {hasText: 'Delays'})).toBeVisible()
    // AGENTS.md is in defaultIgnoredFiles so should not appear
    await expect(nav.locator('a', {hasText: 'Agents'})).not.toBeVisible()
  })

  test('navigates to another page via sidebar', async ({page, cloud}) => {
    // Expect warnings from navigating away from page with charts
    expectConsoleError(page, /was created with unknown prop/, true)
    expectConsoleError(page, /ECharts.*has been disposed/, true)
    await page.goto(cloud.url)
    await page.locator('nav').locator('a', {hasText: 'Delays'}).click()
    await expect(page).toHaveURL(/\/delays$/)
    await expect(page.locator('h1', {hasText: 'Carrier Delay Deep-Dive'})).toBeVisible()
  })

  test('shows a styled compile error for broken markdown pages', async ({page, cloud}) => {
    expectConsoleError(page, /Failed to load resource/, true)

    await getDb().update(files).set({
      content: '# Broken\n\n{#if true}\nThis block never closes.',
    }).where(and(
      eq(files.repoId, repoId),
      eq(files.path, 'index'),
      eq(files.extension, 'md'),
    ))

    await page.goto(cloud.url)
    await expect(page.locator('.compile-error')).toBeVisible()
    await expect(page.locator('.compile-error__title')).toHaveText('We could not build this page')
    await expect(page.locator('.compile-error__body')).toHaveText('flights.md failed to compile.')
    await expect(page.locator('.compile-error__file')).toHaveText('flights.md')
    await expect(page).screenshot('flights-compile-error')
  })
})

describe('bigquery', () => {
  test.scoped({project: 'ecomm'})

  test('renders the index markdown page', async ({page, cloud}) => {
    await page.goto(cloud.url)
    await expect(page.locator('h1', {hasText: 'KPI Summary'})).toBeVisible()
  })
})
