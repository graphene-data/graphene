import {test, expect, waitForGrapheneQueries} from './fixtures'
import {expectConsoleError} from './browserConsole'

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
  let nav = page.getByRole('navigation')
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('link', {name: 'Home'})).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', {name: 'Delays'})).toBeVisible()
  await expect(page.locator('main canvas').first()).toBeVisible()
  await expect(page).screenshot('loads-markdown-files')
})

test('expands nav for nested files', async ({server, page}) => {
  server.mockFile('/other/index.md', '# Other Folder')
  server.mockFile('/other/more.md', 'Hi there!')
  await page.goto(server.url() + '/other/more')
  await expect(page.locator('main')).toContainText('Hi there!')
  let nav = page.getByRole('navigation')
  let otherToggle = nav.locator('[data-folder-toggle="other"]')
  await expect(otherToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(nav.getByRole('link', {name: 'More'})).toHaveAttribute('aria-current', 'page')
})

test('allows collapsing and expanding folders', async ({server, page}) => {
  server.mockFile('/other/index.md', '# Other Folder')
  server.mockFile('/other/more.md', 'More page content')
  await page.goto(server.url() + '/other/more')
  let nav = page.getByRole('navigation')
  let otherFolder = nav.locator('[data-folder="other"]')
  let otherToggle = nav.locator('[data-folder-toggle="other"]')
  await otherFolder.hover()
  await otherToggle.click()
  await expect(nav.getByRole('link', {name: 'More'})).toBeHidden()
  await otherFolder.hover()
  await otherToggle.click()
  await expect(nav.getByRole('link', {name: 'More'})).toBeVisible()
})


test('reports query errors', async ({server, page}) => {
  expectConsoleError(page, 'Failed to load resource')
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
  await expect(page).screenshot('reports-query-errors')
})

test('renders literal less-than characters', async ({server, page}) => {
  server.mockFile('/index.md', `
    # Comparison
    Profit is 1 < 2 and losses are 0 < 1.
  `)

  await page.goto(server.url() + '/')
  await page.pause()
  await expect(page.getByRole('heading', {level: 1, name: 'Comparison'})).toBeVisible()
  await expect(page.locator('main')).toHaveText(/1 < 2/)
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
  await expect(page.locator('main button')).toHaveCount(0)
  await expect(page.locator('iframe')).toHaveCount(0)

  let scriptRan = await page.evaluate(() => (window as any).__MD_SCRIPT__)
  expect(scriptRan).toBeUndefined()
})
