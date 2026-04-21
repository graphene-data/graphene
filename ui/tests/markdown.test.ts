import {test, expect, waitForGrapheneLoad} from './fixtures.ts'
import {expectConsoleError} from './logWatcher.ts'

test('loads markdown files', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    ---
    title: Flight Delay Analysis
    layout: dashboard
    ---

    \`\`\`gsql delays
    select carrier, avg(dep_delay) as delay from flights
    \`\`\`

    <BarChart data="delays" x="carrier" y="delay" />
  `,
  )
  server.mockFile('delays.md', '---\ntitle: Delay Deep-Dive\n---\n# Delays')

  await page.goto(server.url() + '/')
  await expect(page.getByRole('heading', {level: 1, name: 'Flight Delay Analysis'})).toBeVisible()
  let nav = page.getByRole('navigation')
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('link', {name: 'Flight Delay Analysis'})).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', {name: 'Delay Deep-Dive'})).toBeVisible()
  await expect(page.locator('main svg').first()).toBeVisible()
  await expect(page.locator('main#content')).toHaveCSS('max-width', '1200px')
  await expect(page).screenshot('loads-markdown-files')
})

test('flights simple stacked bar renders', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    \`\`\`gsql monthly_flight_status
    select
      date_trunc('month', dep_time) as month,
      case
        when cancelled = 'Y' then 'Cancelled'
        when diverted = 'Y' then 'Diverted'
        else 'Completed'
      end as status,
      count(*) as flights
    from flights
    where (cancelled = 'Y' OR diverted = 'Y')
    group by 1, 2
    order by 1 asc, 2 asc
    \`\`\`

    <BarChart title="Flights by Month (Stacked)" data=monthly_flight_status x=month y=flights splitBy=status arrange=stack />
  `,
  )

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await expect(page).screenshot('flights-simple-stacked-bar')
})

test('parses inline echarts config body in markdown', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Inline ECharts Config

    \`\`\`gsql delays
    select carrier, avg(dep_delay) as delay from flights
    \`\`\`

    <ECharts data="delays">
      title: {text: "Inline ECharts Config"},
      xAxis: {type: "category"},
      yAxis: {type: "value"},
      series: [{type: "bar", encode: {x: "carrier", y: "delay"}}],
    </ECharts>
  `,
  )

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await expect(page.getByRole('heading', {level: 1, name: 'Inline ECharts Config'})).toBeVisible()
  await expect(page).screenshot('echarts-inline-config-markdown')
})

test('charts resize when shrunk', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    \`\`\`gsql delays
    select date_trunc('week', dep_time) as week, avg(dep_delay) as dep_delay, avg(arr_delay) as arr_delay from flights
    \`\`\`

    <Row>
      <LineChart data="delays" x="week" y="dep_delay" />
      <LineChart data="delays" x="week" y="arr_delay" />
    </Row>
  `,
  )

  await page.setViewportSize({width: 1200, height: 700})
  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await page.setViewportSize({width: 700, height: 700})
  await expect(page).screenshot('charts-resize')
})

test('allows collapsing and expanding folders', async ({server, page}) => {
  server.mockFile('/other/index.md', '# Other Folder')
  server.mockFile('/other/more.md', '---\ntitle: Very long title for this one that should clip\n---\n\nHi there!')
  server.mockFile('/other/third.md', '# Third')
  server.mockFile('/other/second/foo.md', 'Foo')
  await page.goto(server.url() + '/other/more')
  // Sidebar is hidden by default; reveal it by hovering the hamburger trigger.
  await page.getByRole('button', {name: 'Toggle navigation'}).hover()
  let nav = page.getByRole('navigation')
  let otherToggle = nav.locator('[data-folder-toggle="other"]')
  await otherToggle.click()
  await expect(nav.getByRole('link', {name: 'Third'})).toBeHidden()
  await otherToggle.click()
  await expect(nav.getByRole('link', {name: 'Third'})).toBeVisible()
  await expect(page).screenshot('expanded-nav')
})

test('renders gsql query errors clearly with file context', async ({server, page}) => {
  expectConsoleError('Failed to load resource')
  server.mockFile(
    '/index.md',
    `
    # Broken Dashboard

    This view intentionally triggers an error.

    \`\`\`sql broken_query
    select not_a_function() as boom from flights
    \`\`\`

    <BarChart data="broken_query" x="origin" y="boom" />
  `,
  )
  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await expect(page.getByRole('heading', {level: 1, name: 'Broken Dashboard'})).toBeVisible()
  await expect(page.getByText('Unknown function: not_a_function')).toBeVisible()
  let details = page.locator('.g-error__details').first()
  await expect(details).not.toContainText('input')
  await expect(details).toContainText('Query (data="broken_query" x="origin" y="boom")')
  await expect(details).toContainText('^')
  await expect(details).not.toContainText('"message"')
  await expect(page).screenshot('reports-analysis-query-errors')
})

test('renders database query failures clearly', async ({server, page}) => {
  expectConsoleError('Failed to load resource')
  server.mockFile(
    '/index.md',
    `
    # Database Failure

    \`\`\`sql broken_query
    from flights select origin, sqrt(dep_delay) as boom
    \`\`\`

    <BarChart data="broken_query" x="origin" y="boom" />
  `,
  )

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await expect(page.getByText('Out of Range Error')).toBeVisible()
  await expect(page).screenshot('reports-database-query-errors')
})

test('renders generic server failures clearly', async ({server, page}) => {
  expectConsoleError('Failed to load resource')
  server.mockFile(
    '/index.md',
    `
    # Server Failure

    \`\`\`sql broken_query
    from flights select origin, dep_delay
    \`\`\`

    <BarChart data="broken_query" x="origin" y="dep_delay" />
  `,
  )

  await page.route('**/_api/query', async route => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({message: 'Sprockets imploded'}),
    })
  })

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await expect(page.getByText('Sprockets imploded')).toBeVisible()
  await expect(page).screenshot('reports-server-query-errors')
})

test('renders html syntax errors with error display', async ({server, page}) => {
  expectConsoleError('Failed to load resource')
  expectConsoleError('Internal Server Error')
  expectConsoleError('Failed to fetch dynamically imported module')
  expectConsoleError('vite:error')
  server.mockFile(
    '/index.md',
    `
    # Test
    {#if true}oops{/if}
  `,
  )

  await page.goto(server.url() + '/')
  await expect(page.getByRole('heading', {name: 'Error loading page'})).toBeVisible({timeout: 5000})
  await expect(page.locator('.g-error')).toBeVisible()
  await expect(page.locator('.g-error__message')).toContainText('Unexpected block closing tag')
  await expect(page).screenshot('html-syntax-error')
})

test('renders literal less-than characters', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Comparison
    Profit is 1 < 2 and losses are 0 < 1.
  `,
  )

  await page.goto(server.url() + '/')
  await expect(page.getByRole('heading', {level: 1, name: 'Comparison'})).toBeVisible()
  await expect(page.locator('main')).toHaveText(/1 < 2/)
})

test('sanitizes unsafe html', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Sanitized
    <script>window.__MD_SCRIPT__ = true</script>
    <button id="danger" onclick="window.__MD_CLICK__ = true">Danger</button>
    <iframe id="embed" src="javascript:alert('boom')"></iframe>
  `,
  )

  await page.goto(server.url() + '/')
  await expect(page.getByRole('heading', {level: 1, name: 'Sanitized'})).toBeVisible()
  await expect(page.locator('main button')).toHaveCount(0)
  await expect(page.locator('iframe')).toHaveCount(0)

  let scriptRan = await page.evaluate(() => (window as any).__MD_SCRIPT__)
  expect(scriptRan).toBeUndefined()
})
