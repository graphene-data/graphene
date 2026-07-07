import {scalarType} from '../../lang/types.ts'
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

test('remaps Snowflake-style uppercase query result keys to requested field casing', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    \`\`\`gsql snowflake_case
    select 3 as num
    \`\`\`

    <Value data="snowflake_case" column="num" />
  `,
  )

  // We don't have ui tests that hit snowflake yet, so fake the response
  await page.route('**/_api/query', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({rows: [{NUM: 3}], fields: [{name: 'num', type: scalarType('number')}], sql: ''}),
    })
  })

  await page.goto(server.url() + '/')
  await expect(page).screenshot('markdown-snowflake-uppercase-result-keys')
})

test('shows browser-cached query staleness and refreshes without cache reads', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    \`\`\`gsql cached_query
    select 3 as num
    \`\`\`

    <Value data="cached_query" column="num" />
  `,
  )

  let requestCount = 0
  let lastCacheControl = ''
  let hash = 'browser-cache-hash'
  let runAt = new Date('2024-01-01T00:00:00Z').getTime()
  await page.route('**/_api/query', async route => {
    requestCount++
    lastCacheControl = route.request().headers()['cache-control'] || ''
    let body = route.request().postDataJSON()
    if (body.hashes?.includes(hash) && lastCacheControl != 'no-cache') {
      await route.fulfill({status: 304, headers: {ETag: hash}})
      return
    }

    await route.fulfill({
      status: 200,
      headers: {ETag: hash},
      contentType: 'application/json',
      body: JSON.stringify({rows: [{num: requestCount}], fields: [{name: 'num', type: scalarType('number')}], sql: '', runAt: lastCacheControl == 'no-cache' ? runAt + 60_000 : runAt}),
    })
  })

  await page.clock.install({time: new Date('2024-01-01T00:00:00Z')})
  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await expect(page.locator('.query-cache-status')).toHaveCount(1)
  await expect(page.locator('.query-cache-status')).toHaveText('')

  await page.evaluate(() => window.$GRAPHENE.rerunQueries())
  await expect(page.locator('.query-cache-status')).toHaveCount(1)
  await expect(page.locator('.query-cache-status')).toHaveText('')
  await page.clock.fastForward('05:00')
  await expect(page.locator('.query-cache-status')).toContainText('5m ago')
  await expect(page).screenshot('markdown-browser-cache-status')

  await page.getByRole('button', {name: /Click to re-run/}).click()
  await expect.poll(() => requestCount).toBe(3)
  expect(lastCacheControl).toBe('no-cache')
  await expect(page.locator('.query-cache-status')).toHaveCount(1)
  await expect(page.locator('.query-cache-status')).toHaveText('')
})

test('disables browser query caching behind an internal query parameter', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    \`\`\`gsql cached_query
    select 3 as num
    \`\`\`

    <Value data="cached_query" column="num" />
  `,
  )

  let requestBodies: any[] = []
  await page.route('**/_api/query', async route => {
    requestBodies.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      headers: {ETag: 'disabled-browser-cache-hash'},
      contentType: 'application/json',
      body: JSON.stringify({
        rows: [{num: requestBodies.length}],
        fields: [{name: 'num', type: scalarType('number')}],
        sql: '',
        runAt: Date.now() - 90_000,
      }),
    })
  })

  await page.goto(server.url() + '/?__graphene_no_browser_cache=1')
  await waitForGrapheneLoad(page)
  await page.evaluate(() => window.$GRAPHENE.rerunQueries())

  expect(requestBodies).toHaveLength(2)
  expect(requestBodies[0].hashes).toEqual([])
  expect(requestBodies[1].hashes).toEqual([])
  await expect(page.locator('.query-cache-status')).toHaveText('')
  await expect(page).screenshot('markdown-browser-cache-disabled')
})

test('uses warehouse cache timestamps when browser cache serves the response', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    \`\`\`gsql cached_query
    select 3 as num
    \`\`\`

    <Value data="cached_query" column="num" />
  `,
  )

  let hash = 'warehouse-cache-hash'
  let runAt = Date.now() - 125 * 60_000
  await page.route('**/_api/query', async route => {
    let body = route.request().postDataJSON()
    if (body.hashes?.includes(hash)) {
      await route.fulfill({status: 304, headers: {ETag: hash}})
      return
    }

    await route.fulfill({
      status: 200,
      headers: {ETag: hash},
      contentType: 'application/json',
      body: JSON.stringify({
        rows: [{num: 3}],
        fields: [{name: 'num', type: scalarType('number')}],
        sql: '',
        runAt,
      }),
    })
  })

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await expect(page.locator('.query-cache-status')).toContainText('2h ago')

  await page.evaluate(() => window.$GRAPHENE.rerunQueries())
  await expect(page.locator('.query-cache-status')).toContainText('2h ago')
  await expect(page).screenshot('markdown-warehouse-cache-status')
})

test('expires browser cache entries from the cached result creation time', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    \`\`\`gsql cached_query
    select 3 as num
    \`\`\`

    <Value data="cached_query" column="num" />
  `,
  )

  let requestBodies: any[] = []
  let expiredRunAt = Date.now() - 25 * 60 * 60_000
  await page.route('**/_api/query', async route => {
    requestBodies.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      headers: {ETag: 'expired-warehouse-cache-hash'},
      contentType: 'application/json',
      body: JSON.stringify({
        rows: [{num: requestBodies.length}],
        fields: [{name: 'num', type: scalarType('number')}],
        sql: '',
        runAt: requestBodies.length == 1 ? expiredRunAt : Date.now(),
      }),
    })
  })

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await page.evaluate(() => window.$GRAPHENE.rerunQueries())

  expect(requestBodies).toHaveLength(2)
  expect(requestBodies[1].hashes).toEqual([])
  await expect(page).screenshot('markdown-expired-warehouse-cache-status')
})

test('deduplicates chart query fields already used for sort', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    \`\`\`gsql delays_by_carrier
    select 'Alaska Airlines' as name, 12 as avg_delay
    \`\`\`

    <BarChart data="delays_by_carrier" x="name" y="avg_delay" sort="avg_delay desc" />
  `,
  )

  await page.goto(server.url() + '/')
  await expect(page).screenshot('markdown-deduplicates-chart-sort-field')
})

test('decodes html entities in inline echarts config strings', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Inline ECharts Config

    \`\`\`gsql delays
    select carrier, avg(dep_delay) as delay from flights
    \`\`\`

    <ECharts data="delays">
      title: {text: "This & That"},
      xAxis: {type: "category"},
      yAxis: {type: "value"},
      series: [{type: "bar", encode: {x: "carrier", y: "delay"}}],
    </ECharts>
  `,
  )

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await expect(page.locator('.echarts')).toHaveAttribute('data-chart-title', 'This & That')
  await expect(page.locator('.echarts')).not.toHaveAttribute('data-chart-title', 'This &amp; That')
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
  await page.getByRole('button', {name: 'Open navigation'}).hover()
  let nav = page.getByRole('navigation')
  // The folder's index.md shows up as its own "Home" page routed to the folder path.
  await expect(nav.getByRole('link', {name: 'Home'})).toHaveAttribute('href', /\/other$/)
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
  await expect(details).toContainText('BarChart (data="broken_query" x="origin" y="boom")')
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

test('renders svelte control flow in markdown', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Test
    {#if true}<p>Visible</p>{/if}
  `,
  )

  await page.goto(server.url() + '/')
  await expect(page.getByRole('heading', {level: 1, name: 'Test'})).toBeVisible()
  await expect(page.getByText('Visible')).toBeVisible()
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

test('allows arbitrary html and framework directives', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Unsanitized
    <button id="danger" on:click={() => globalThis['__MD_CLICK__'] = true}>Danger</button>
    <iframe id="embed" title="Embed" src="javascript:alert('boom')"></iframe>
  `,
  )

  await page.goto(server.url() + '/')
  await expect(page.getByRole('heading', {level: 1, name: 'Unsanitized'})).toBeVisible()
  await expect(page.locator('main button')).toBeVisible()
  await expect(page.locator('iframe')).toBeAttached()

  await page.locator('main button').click()
  let clicked = await page.evaluate(() => (globalThis as any).__MD_CLICK__)
  expect(clicked).toBe(true)
})

test('allows visual html attributes and inline styles', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Styled
    <div id="custom-layout" class="custom-layout" data-kind="visual" aria-label="Custom Layout" role="region" style="color: red">
      <span class="metric">Metric</span>
    </div>
  `,
  )

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  let layout = page.locator('#custom-layout')
  await expect(layout).toBeVisible()
  await expect(layout).toHaveAttribute('data-kind', 'visual')
  await expect(layout).toHaveAttribute('aria-label', 'Custom Layout')
  await expect(layout).toHaveAttribute('role', 'region')
  await expect(layout).toHaveAttribute('style', 'color: red')
  await expect(layout).toHaveCSS('color', 'rgb(255, 0, 0)')
})
