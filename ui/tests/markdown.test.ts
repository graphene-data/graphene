import {scalarType} from '../../lang/types.ts'
import {test, expect, waitForGrapheneLoad} from './fixtures.ts'
import {expectConsoleError} from './logWatcher.ts'

const pageFrame = (page: any) => page.frameLocator('iframe[title="Graphene page"]')

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
  await expect(pageFrame(page).getByRole('heading', {level: 1, name: 'Flight Delay Analysis'})).toBeVisible()
  let nav = page.getByRole('navigation')
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('link', {name: 'Flight Delay Analysis'})).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', {name: 'Delay Deep-Dive'})).toBeVisible()
  await expect(pageFrame(page).locator('main svg').first()).toBeVisible()
  await expect(page.locator('main#content')).toHaveCSS('max-width', 'none')
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
  await expect(pageFrame(page).getByRole('heading', {level: 1, name: 'Inline ECharts Config'})).toBeVisible()
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
  await expect(page.locator('.query-cache-status')).toHaveCount(0)

  await page.evaluate(() => window.$GRAPHENE.rerunQueries())
  await expect(page.locator('.query-cache-status')).toHaveCount(0)
  await page.clock.fastForward('01:00')
  await expect(page.locator('.query-cache-status')).toContainText('1m ago')
  await expect(page).screenshot('markdown-browser-cache-status')

  await page.getByRole('button', {name: 'Refresh cached queries'}).click()
  await expect.poll(() => requestCount).toBe(3)
  expect(lastCacheControl).toBe('no-cache')
  await expect(page.locator('.query-cache-status')).toHaveCount(0)
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
  await expect(page.locator('.query-cache-status')).toContainText('1m ago')
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
  await expect(page.locator('.query-cache-status')).toContainText('2h 5m ago')

  await page.evaluate(() => window.$GRAPHENE.rerunQueries())
  await expect(page.locator('.query-cache-status')).toContainText('2h 5m ago')
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
  await expect(pageFrame(page).locator('.echarts')).toHaveAttribute('data-chart-title', 'This & That')
  await expect(pageFrame(page).locator('.echarts')).not.toHaveAttribute('data-chart-title', 'This &amp; That')
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
  await expect(pageFrame(page).getByRole('heading', {level: 1, name: 'Broken Dashboard'})).toBeVisible()
  await expect(pageFrame(page).getByText('Unknown function: not_a_function')).toBeVisible()
  let details = pageFrame(page).locator('.g-error__details').first()
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
  await expect(pageFrame(page).getByText('Out of Range Error')).toBeVisible()
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
  await expect(pageFrame(page).getByText('Sprockets imploded')).toBeVisible()
  await expect(page).screenshot('reports-server-query-errors')
})

test('renders markdown compile errors with error display', async ({server, page}) => {
  expectConsoleError('Failed to load resource')
  expectConsoleError('Internal Server Error')
  expectConsoleError('Failed to fetch dynamically imported module')
  expectConsoleError('vite:error')
  server.mockFile(
    '/index.md',
    `
    # Test
    <script>
      let broken =
    </script>
  `,
  )

  await page.goto(server.url() + '/')
  await expect(page.getByRole('heading', {name: 'Error loading page'})).toBeVisible({timeout: 5000})
  await expect(page.locator('.g-error')).toBeVisible()
  await expect(page.locator('.g-error__message')).not.toContainText('Failed to fetch dynamically imported module')
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
  await expect(pageFrame(page).getByRole('heading', {level: 1, name: 'Comparison'})).toBeVisible()
  await expect(pageFrame(page).locator('main')).toHaveText(/1 < 2/)
})

test('runs authored page scripts inside the sandboxed frame', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Isolated Script
    <script>globalThis.__MD_SCRIPT__ = true</script>
    <button id="run" onclick={() => globalThis.__MD_CLICK__ = true}>Run</button>
  `,
  )

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  await expect(pageFrame(page).getByRole('heading', {level: 1, name: 'Isolated Script'})).toBeVisible()
  await pageFrame(page).getByRole('button', {name: 'Run'}).click()

  expect(await page.evaluate(() => (window as any).__MD_SCRIPT__)).toBeUndefined()
  let frame = page.frames().find(f => f.url().includes('/_graphene/frame/'))
  expect(await frame?.evaluate(() => (globalThis as any).__MD_SCRIPT__)).toBe(true)
  expect(await frame?.evaluate(() => (globalThis as any).__MD_CLICK__)).toBe(true)
})

test('allows trusted visual html and style blocks while CSP blocks remote css resources', async ({server, page}) => {
  expectConsoleError(/Content Security Policy/)
  let remoteRequests = 0
  await page.route('https://example.com/**', async route => {
    remoteRequests++
    await route.abort()
  })

  server.mockFile(
    '/index.md',
    `
    # Styled
    <style>
      .custom-layout {
        display: grid;
        gap: 12px;
        color: rgb(12, 34, 56);
        background-image: url("https://example.com/leak.png");
      }
      .custom-layout .metric { border: 3px solid rgb(20, 120, 80); }
    </style>

    <div id="custom-layout" class="custom-layout" data-kind="visual" aria-label="Custom Layout" role="region" style="padding: 1px">
      <span class="metric">Metric</span>
    </div>
  `,
  )

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)
  let layout = pageFrame(page).locator('#custom-layout')
  await expect(layout).toBeVisible()
  await expect(layout).toHaveAttribute('data-kind', 'visual')
  await expect(layout).toHaveAttribute('aria-label', 'Custom Layout')
  await expect(layout).toHaveAttribute('role', 'region')
  await expect(layout).toHaveAttribute('style', 'padding: 1px')
  await expect(layout).toHaveCSS('display', 'grid')
  await expect(layout).toHaveCSS('color', 'rgb(12, 34, 56)')
  await expect(layout).not.toHaveCSS('background-image', 'none')
  await expect(pageFrame(page).locator('.metric')).toHaveCSS('border-top-color', 'rgb(20, 120, 80)')
  expect(remoteRequests).toBe(0)
})
