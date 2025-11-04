import {test, expect, waitForGrapheneQueries} from './fixtures'
import {assertNoConsoleErrors, expectConsoleError} from './browserConsole'

test('loads markdown files', async ({server, page}) => {
  server.mockFile('/index.md', `
    # Flight Delay Analysis

    \`\`\`gsql delays
    select carrier, avg(dep_delay) as delay from flights
    \`\`\`

    <BarChart data="delays" x="carrier" y="delay" />
  `)
  await page.goto(server.url() + '/')
  await expect(page.getByRole('heading', {level: 1, name: 'Flight Delay Analysis'})).toBeVisible()
  await expect(page.locator('main canvas').first()).toBeVisible()
  assertNoConsoleErrors(page)
  await expect(page).toHaveScreenshot('loads-markdown-files.png')
})

test('reports query errors', async ({server, page}) => {
  server.mockFile('/index.md', `
    # Broken Dashboard

    This view intentionally triggers an error.

    \`\`\`sql broken_query
    select not_a_function() as boom from flights
    \`\`\`

    <BarChart data="broken_query" x="origin" y="boom" />
  `)
  await page.goto(server.url() + '/')
  await waitForGrapheneQueries(page)
  await expect(page.getByRole('heading', {level: 1, name: 'Broken Dashboard'})).toBeVisible()
  expectConsoleError(page, 'Failed to load resource')
  await expect(page).toHaveScreenshot('reports-query-errors.png')
})

test('renders literal less-than characters', async ({server, page}) => {
  server.mockFile('/index.md', `
    # Comparison

    Profit is 1 < 2 and losses are 0 < 1.
  `)

  await page.goto(server.url() + '/')
  await expect(page.getByRole('heading', {level: 1, name: 'Comparison'})).toBeVisible()
  await expect(page.locator('main')).toHaveText(/1 < 2/)
  assertNoConsoleErrors(page)
})

test('sanitizes unsafe html', async ({server, page}) => {
  server.mockFile('/index.md', `
    # Sanitized

    <script>window.__MD_SCRIPT__ = true</script>
    <button id="danger" onclick="window.__MD_CLICK__ = true">Danger</button>
    <iframe id="embed" src="javascript:alert('boom')"></iframe>
  `)

  await page.goto(server.url() + '/')
  await expect(page.getByRole('heading', {level: 1, name: 'Sanitized'})).toBeVisible()
  await expect(page.locator('button')).toHaveCount(0)
  await expect(page.locator('iframe')).toHaveCount(0)

  let scriptRan = await page.evaluate(() => (window as any).__MD_SCRIPT__)
  expect(scriptRan).toBeUndefined()
  assertNoConsoleErrors(page)
})
