import {test, expect} from './fixtures.ts'
import {expectConsoleError} from './logWatcher.ts'

test('valid → invalid → valid via HMR', {timeout: 20000}, async ({server, page}) => {
  expectConsoleError('Failed to load resource')
  expectConsoleError('Internal Server Error')
  expectConsoleError('Failed to fetch dynamically imported module')
  expectConsoleError('vite:error')
  server.mockFile('/index.md', '# Working Page')

  await page.goto(server.url())
  await expect(page.getByRole('heading', {name: 'Working Page'})).toBeVisible()
  await expect(page).screenshot('hmr-working-page')

  // Break the file — should show error
  await server.updateMockFile('/index.md', '# Broken\n{#if true}<p>oops')
  await expect(page.getByRole('heading', {name: 'Error loading page'})).toBeVisible({timeout: 5000})
  await expect(page).screenshot('hmr-broken-page')

  // Fix the file — should recover via HMR
  await server.updateMockFile('/index.md', '# Fixed Page')
  await expect(page.getByRole('heading', {name: 'Fixed Page'})).toBeVisible({timeout: 5000})
  await expect(page).screenshot('hmr-fixed-page')
})

test('load broken page, fix via HMR', async ({server, page}) => {
  expectConsoleError('Failed to load resource')
  expectConsoleError('Internal Server Error')
  expectConsoleError('Failed to fetch dynamically imported module')
  expectConsoleError('vite:error')
  server.mockFile('/index.md', '# Broken\n{#if true}<p>oops')

  await page.goto(server.url())
  await expect(page.getByRole('heading', {name: 'Error loading page'})).toBeVisible({timeout: 5000})
  await expect(page.locator('.g-error')).toBeVisible()
  await expect(page.locator('.g-error__details')).toContainText('index.md')
  await expect(page).screenshot('initial-compile-error')

  // Fix the file — should recover via HMR
  await server.updateMockFile('/index.md', '# Now Working')
  await expect(page.getByRole('heading', {name: 'Now Working'})).toBeVisible({timeout: 5000})
  await expect(page).screenshot('hmr-recovered-page')
})

test('shows an error when a page uses an unknown component', async ({server, page}) => {
  expectConsoleError('DataTable is not defined')
  server.mockFile('/broken.md', '# Broken\n<DataTable />')

  await page.goto(server.url() + '/broken')
  await expect(page.getByRole('heading', {name: 'Error loading page'})).toBeVisible()
  await expect(page.getByText('DataTable is not defined')).toBeVisible()
  await expect(page.locator('.g-error__details')).toContainText('broken.md')
  await expect(page).screenshot('unknown-page-component')
})

test('editing unrelated md does not reload current page', async ({server, page}) => {
  server.mockFile('/index.md', '# Main Page')
  server.mockFile('/other.md', '# Other Page')

  await page.goto(server.url())
  await expect(page.getByRole('heading', {name: 'Main Page'})).toBeVisible()

  // Set a marker on the page that would be cleared by a reload
  await page.evaluate(() => {
    ;(window as any).__hmrMarker = true
  })

  // Edit an unrelated file
  await server.updateMockFile('/other.md', '# Other Changed')
  await new Promise(r => setTimeout(r, 1000)) // give HMR time to fire if it's going to

  // Marker should still be there — page was not reloaded
  let marker = await page.evaluate(() => (window as any).__hmrMarker)
  expect(marker).toBe(true)
  await expect(page.getByRole('heading', {name: 'Main Page'})).toBeVisible()
})

test('editing unrelated md does not reload broken page', async ({server, page}) => {
  expectConsoleError('Failed to load resource')
  expectConsoleError('Internal Server Error')
  expectConsoleError('Failed to fetch dynamically imported module')
  expectConsoleError('vite:error')
  server.mockFile('/index.md', '# Broken\n{#if true}<p>oops')
  server.mockFile('/other.md', '# Other Page')

  await page.goto(server.url())
  await expect(page.getByRole('heading', {name: 'Error loading page'})).toBeVisible({timeout: 5000})

  // Set a marker
  await page.evaluate(() => {
    ;(window as any).__hmrMarker = true
  })

  // Edit an unrelated file
  await server.updateMockFile('/other.md', '# Other Changed')
  await new Promise(r => setTimeout(r, 1000))

  // Marker should still be there — page was not reloaded
  let marker = await page.evaluate(() => (window as any).__hmrMarker)
  expect(marker).toBe(true)
  await expect(page.getByRole('heading', {name: 'Error loading page'})).toBeVisible()
})

test('compile errors in another tab do not affect current page', {timeout: 30000}, async ({server, browser, page}) => {
  expectConsoleError('vite:error')
  expectConsoleError('Internal Server Error')
  expectConsoleError('Failed to fetch dynamically imported module')
  server.mockFile('/index.md', '# Main Page')
  server.mockFile('/other.md', '# Other Page')

  await page.goto(server.url())
  await expect(page.getByRole('heading', {name: 'Main Page'})).toBeVisible()

  let otherPage = await browser.newPage()
  await otherPage.goto(server.url() + '/other')
  await expect(otherPage.getByRole('heading', {name: 'Other Page'})).toBeVisible()

  await server.updateMockFile('/other.md', '# Broken Page\n{#if true}<p>oops')
  await expect(page.getByRole('heading', {name: 'Main Page'})).toBeVisible()
  await expect(page.getByRole('heading', {name: 'Error loading page'})).toHaveCount(0)

  await expect(otherPage.getByRole('heading', {name: 'Error loading page'})).toBeVisible({timeout: 10000})
  await expect(otherPage).screenshot('hmr-other-tab-compile-error')

  await otherPage.close()
})
