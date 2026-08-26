import {readFile} from 'node:fs/promises'
import stripAnsi from 'strip-ansi'
import {expect as vitestExpect} from 'vitest'

import {check} from '../../cli/check.ts'
import {mockFileMap} from '../../cli/mockFiles.ts'
import {config} from '../../lang/config.ts'
import {deindent, trimIndentation} from '../../lang/util.ts'
import {test, expect, waitForGrapheneLoad} from './fixtures.ts'
import {expectConsoleError} from './logWatcher.ts'

let logs = ''
function log(...args: any[]) {
  logs += args.map(a => String(a)).join(' ') + '\n'
}

async function expectPngScreenshot(output: string) {
  let screenshotPath = output.match(/Screenshot saved to ([^\n]+)/)?.[1] || ''
  let screenshot = await readFile(screenshotPath)
  expect(screenshot.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
}

function outputLines(output = logs) {
  let normalized = output.replace(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.png/g, '<timestamp>.png')
  normalized = normalized.replace(
    /Screenshot saved to[^\n]*node_modules\/\.graphene\/screenshots\/<timestamp>\.png/g,
    'Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png',
  )
  normalized = normalized.replace(/Page available at http:\/\/localhost:\d+/g, 'Page available at http://localhost:<port>')
  return stripAnsi(normalized.trim())
}

const carrierDistanceOutput = deindent(`
  Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
  ┌─────────┬────────────────┐
  │ carrier │ total_distance │
  ├─────────┼────────────────┤
  │ WN      │ 54619152       │
  ├─────────┼────────────────┤
  │ UA      │ 38882934       │
  ├─────────┼────────────────┤
  │ AA      │ 37684885       │
  ├─────────┼────────────────┤
  │ NW      │ 33376503       │
  ├─────────┼────────────────┤
  │ US      │ 23721642       │
  ├─────────┼────────────────┤
  │ DL      │ 21547874       │
  ├─────────┼────────────────┤
  │ RU      │ 7676766        │
  ├─────────┼────────────────┤
  │ AS      │ 7072451        │
  ├─────────┼────────────────┤
  │ B6      │ 6452288        │
  ├─────────┼────────────────┤
  │ HP      │ 6441707        │
  ├─────────┼────────────────┤
  │ CO      │ 5794572        │
  ├─────────┼────────────────┤
  │ MQ      │ 4251459        │
  ├─────────┼────────────────┤
  │ EV      │ 3172376        │
  ├─────────┼────────────────┤
  │ TZ      │ 2645227        │
  ├─────────┼────────────────┤
  │ OH      │ 1997359        │
  └─────────┴────────────────┘
  Page available at http://localhost:<port>/
`)

const carrierTotalsOutput = deindent(`
  Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
  ┌─────────┬───────────────┐
  │ carrier │ total_flights │
  ├─────────┼───────────────┤
  │ AA      │ 34577         │
  ├─────────┼───────────────┤
  │ AS      │ 8453          │
  ├─────────┼───────────────┤
  │ B6      │ 4842          │
  ├─────────┼───────────────┤
  │ CO      │ 7139          │
  ├─────────┼───────────────┤
  │ DL      │ 32130         │
  └─────────┴───────────────┘
  Page available at http://localhost:<port>/
`)

const carrierCsvOutput = deindent(`
  Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
  carrier,total_flights
  AA,34577
  DL,32130
  Page available at http://localhost:<port>/
`)

test.beforeEach(() => {
  logs = ''
  Object.keys(mockFileMap).forEach(key => delete mockFileMap[key])
})

test('check defaults to analyzing the whole workspace', async () => {
  mockFileMap['tmp_bad.gsql'] = `
    table tmp_bad as (
      from flights select not_a_function()
    )
  `

  await check({log})
  expect(outputLines()).toBe(deindent(`
    ERROR: tmp_bad.gsql line 3: Unknown function: not_a_function
          from flights select not_a_function()
                              ^^^^^^^^^^^^^^^^
  `))
})

test('check with mdFile reports analysis errors', async ({server, page}) => {
  expectConsoleError('Failed to load resource')
  server.mockFile(
    '/other.md',
    `
    \`\`\`sql error_query
    from flights select wtfmate() as explode
    \`\`\`
    <BarChart data="error_query" x="origin" y="explode" />
  `,
  )

  server.mockFile(
    '/mock.md',
    `
    \`\`\`sql error_query
    from flights select 1 as origin, not_a_function() as explode
    \`\`\`
    <BarChart data="error_query" x="origin" y="explode" />
  `,
  )

  await page.goto(server.url() + '/mock')
  await check({fileArg: 'pages/mock.md', log})
  expect(outputLines()).toBe(deindent(`
    ERROR: pages/mock.md line 3: Unknown function: not_a_function
    from flights select 1 as origin, not_a_function() as explode
                                     ^^^^^^^^^^^^^^^^
  `))
})

test('check with mdFile reports unsupported chart wrapper props', async () => {
  mockFileMap['mock.md'] = trimIndentation(`
    \`\`\`sql chart_data
    from flights select carrier, distance
    \`\`\`
    <BarChart data=chart_data x=carrier y=distance yFmt=num0 />
  `)

  let result = await check({fileArg: 'mock.md', log})
  expect(result).toBe(false)
  vitestExpect(outputLines()).toBe(deindent(`
    ERROR: mock.md line 4: Unsupported prop "yFmt" on BarChart. Use field metadata or ECharts for custom formatting.
    <BarChart data=chart_data x=carrier y=distance yFmt=num0 />
                                                   ^^^^
  `))
})

test('check reports invalid metadata annotations', async () => {
  mockFileMap['tmp_bad_metadata.gsql'] = trimIndentation(`
    table tmp_bad_metadata (
      rate number #ratio=false
    )
  `)

  let result = await check({fileArg: 'tmp_bad_metadata.gsql', log})
  expect(result).toBe(false)
  vitestExpect(outputLines()).toBe(deindent(`
    ERROR: tmp_bad_metadata.gsql line 2: Metadata "#ratio" is a flag; use "#ratio" or "#ratio=true".
      rate number #ratio=false
                         ^^^^^
  `))
})

test('cli run reports unsupported props across chart types', async ({runCli, server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Runtime Chart Prop Errors
    \`\`\`sql chart_data
    from flights select carrier, distance limit 25
    \`\`\`
    <BarChart data="chart_data" x="carrier" y="distance" yFmt="num0" emptySet="warn" />
    <ECharts data="chart_data" chartAreaHeight="240">
      xAxis: {},
      yAxis: {},
      series: [{type: "bar", encode: {x: "carrier", y: "distance"}}],
    </ECharts>
  `,
  )

  await page.goto(server.url())
  let result = await runCli(['run', 'pages/index.md'], config)
  let output = outputLines(result.stdout + result.stderr)
  expect(result.code).toBe(1)
  vitestExpect(output).toBe(deindent(`
    ERROR: input: Unsupported prop "yFmt" on BarChart. Unsupported prop "emptySet" on BarChart.

    ERROR: input: Unsupported prop "chartAreaHeight" on ECharts.
  `))
})

test('cli run with md file reports runtime chart render errors', async ({runCli, server, page}) => {
  expectConsoleError('Chart failed to render')
  server.mockFile(
    '/index.md',
    `
    # Runtime Chart Render Error
    \`\`\`sql chart_data
    from flights select dep_delay as x_value, dep_delay as bad_category limit 25
    \`\`\`

    <ECharts data="chart_data">
      xAxis: {},
      yAxis: {type: "category"},
      series: [{type: "bar", encode: {x: "x_value", y: "bad_category"}}],
    </ECharts>
  `,
  )

  await page.goto(server.url())
  let result = await runCli(['run', 'pages/index.md'], config)
  expect(result.code).toBe(1)
  vitestExpect(outputLines(result.stdout + result.stderr)).toBe('ERROR: input: Horizontal charts do not support a value or time-based x-axis')
})

test('cli run with md file reports runtime query errors', async ({runCli, server, page}) => {
  expectConsoleError('Failed to load resource')
  server.mockFile(
    '/index.md',
    `
    # Runtime Cast Error Page
    \`\`\`sql runtime_error_query
    from flights select origin, sqrt(dep_delay) as explode
    \`\`\`
    <BarChart data="runtime_error_query" x="origin" y="explode" title="Runtime Cast Error" />
  `,
  )

  await page.goto(server.url())
  let result = await runCli(['run', 'pages/index.md'], config)
  vitestExpect(outputLines(result.stdout + result.stderr)).toBe('ERROR: input: Out of Range Error: cannot take square root of a negative number')
})

test('cli run handles page query with trailing column annotation', async ({runCli, server}) => {
  server.mockFile(
    '/index.md',
    `
    # Page Query Column Annotations
    \`\`\`sql annotated
    from flights select carrier,
      extract(month from dep_time) as month_num, #timeOrdinal=month_of_year
      dep_delay / 100 as delay_drop_pct #ratio
    \`\`\`
    <BigValue data="annotated" value="delay_drop_pct" title="Delay Drop" />
  `,
  )

  server.url()
  let result = await runCli(['run', 'pages/index.md', '--headless'], config)
  expect(result.code).toBe(0)
  await expectPngScreenshot(result.stdout)
  vitestExpect(outputLines(result.stdout + result.stderr)).toBe(deindent(`
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
    Page available at http://localhost:<port>/
  `))
})

test('cli run with md file reports table configuration errors', async ({runCli, server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Runtime Table Config Error
    \`\`\`sql table_data
    from flights select carrier, sum(distance) as total_distance
    \`\`\`
    <Table data="table_data" sort="not_a_column asc" title="Runtime Table Config Error" />
  `,
  )

  await page.goto(server.url())
  let result = await runCli(['run', 'pages/index.md'], config)
  vitestExpect(outputLines(result.stdout + result.stderr)).toBe('ERROR: input: not_a_column is not a column in the dataset. sort should contain one column name and optionally a direction (asc or desc).')
})

test('cli run with md file reports big value query errors', async ({runCli, server, page}) => {
  expectConsoleError('Failed to load resource')
  server.mockFile(
    '/index.md',
    `
    # Runtime BigValue Query Error
    \`\`\`sql big_value_data
    from flights select sqrt(dep_delay) as value
    \`\`\`
    <BigValue data="big_value_data" value="value" title="Runtime BigValue Query Error" />
  `,
  )

  await page.goto(server.url())
  let result = await runCli(['run', 'pages/index.md'], config)
  vitestExpect(outputLines(result.stdout + result.stderr)).toBe('ERROR: input: Out of Range Error: cannot take square root of a negative number')
})

test('cli run reports a missing markdown file', async ({runCli}) => {
  let result = await runCli(['run', 'missing.md'], config)

  expect(result.code).toBe(1)
  expect(outputLines(result.stdout + result.stderr)).toBe("Couldn't find missing.md")
})

test('cli run with md file reports html compilation errors', async ({runCli, server, page}) => {
  expectConsoleError('Failed to load resource')
  expectConsoleError('Internal Server Error')
  expectConsoleError('Failed to fetch dynamically imported module')
  server.mockFile(
    '/index.md',
    `
    # Test
    {#if true}<p>oops
  `,
  )

  await page.goto(server.url())
  let result = await runCli(['run', 'pages/index.md'], config)
  expect(result.code).toBe(1)
  let output = outputLines(result.stdout + result.stderr)
  vitestExpect(output.replace(/ERROR: .*index\.md line \d+:/, 'ERROR: <path>/index.md line <line>:')).toBe(deindent(`
    ERROR: <path>/index.md line <line>: \`<p>\` was left open
     5 |  <h1>Test</h1>
     6 |  {#if true}
     7 |  <p>oops
           ^
     8 |
  `))
})

test('cli run selects chart, table, and ECharts screenshots by title', async ({runCli, server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Component Screenshots
    \`\`\`sql chart_data
    from flights select carrier, sum(distance) as total_distance
    \`\`\`
    \`\`\`sql table_data
    from flights select carrier, count() as total_flights group by 1 order by carrier limit 5
    \`\`\`
    <BarChart data="chart_data" x="carrier" y="total_distance" title="Carrier Distance" />
    <Table data="table_data" title="Carrier Totals" rows=5 />
    <ECharts data="chart_data">
      title: [{text: "ECharts Distance"}],
      xAxis: {type: "category"},
      yAxis: {},
      series: [{type: "bar", encode: {x: "carrier", y: "total_distance"}}],
    </ECharts>
  `,
  )

  await page.goto(server.url())
  let outputs: string[] = []
  for (let title of ['Carrier Distance', 'Carrier Totals', 'ECharts Distance']) {
    let result = await runCli(['run', 'pages/index.md', '--chart', title], config)
    await expectPngScreenshot(result.stdout)
    outputs.push(outputLines(result.stdout + result.stderr))
  }
  vitestExpect(outputs).toEqual([carrierDistanceOutput, carrierTotalsOutput, carrierDistanceOutput])
})

test('cli run with --headless captures a screenshot without an open page', async ({runCli, server}) => {
  server.mockFile(
    '/index.md',
    `
    # Headless Screenshot
    \`\`\`sql chart_data
    from flights select carrier, sum(distance) as total_distance
    \`\`\`
    <BarChart data="chart_data" x="carrier" y="total_distance" title="Carrier Distance" />
  `,
  )

  server.url()
  let result = await runCli(['run', 'pages/index.md', '--headless', '--chart', 'Carrier Distance'], config)
  await expectPngScreenshot(result.stdout)
  vitestExpect(outputLines(result.stdout + result.stderr)).toBe(carrierDistanceOutput)
})



test('cli run with --headless captures a table screenshot by title', async ({runCli, server}) => {
  server.mockFile(
    '/index.md',
    `
    # Table Screenshot
    \`\`\`sql table_data
    from flights select carrier, count() as total_flights group by 1 order by carrier limit 5
    \`\`\`
    <Table data="table_data" title="Carrier Totals" rows=5 />
  `,
  )

  server.url()
  let result = await runCli(['run', 'pages/index.md', '--headless', '--chart', 'Carrier Totals'], config)
  vitestExpect(outputLines(result.stdout + result.stderr)).toBe(carrierTotalsOutput)
})

test('cli run with --input applies inputs to a full page run', async ({runCli, server, page}) => {
  let queryBodies: any[] = []
  server.mockFile(
    '/index.md',
    `
    # Input Page
    <TextInput name="carrier" title="Carrier" defaultValue="WN" />

    \`\`\`sql filtered
    from flights where carrier = $carrier select carrier, count() as total group by 1
    \`\`\`
    <Table data="filtered" />
  `,
  )

  await page.route('**/_api/query', async route => {
    queryBodies.push(route.request().postDataJSON())
    await route.continue()
  })

  await page.goto(server.url() + '/?carrier=AA')
  await waitForGrapheneLoad(page)
  let result = await runCli(['run', 'pages/index.md', '--param', 'carrier=AA'], config)

  expect(result.code).toBe(0)
  expect(queryBodies.some(body => JSON.stringify(body.params) == JSON.stringify({carrier: 'AA'}))).toBe(true)
  vitestExpect(outputLines(result.stdout + result.stderr)).toBe(deindent(`
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
    Page available at http://localhost:<port>/?carrier=AA
  `))
})



test('cli list prints chart and table component IDs', async ({runCli, server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Query List
    \`\`\`sql chart_data
    from flights select carrier, sum(distance) as total_distance
    \`\`\`
    \`\`\`sql table_data
    from flights select carrier, count() as total_flights group by 1 order by carrier limit 5
    \`\`\`
    <BarChart data="chart_data" x="carrier" y="total_distance" title="Carrier Distance" />
    <Table data="table_data" title="Carrier Totals" rows=5 />
  `,
  )

  await page.goto(server.url())
  let result = await runCli(['list', 'pages/index.md'], config)
  expect(result.code).toBe(0)
  expect(outputLines(result.stdout + result.stderr)).toBe(deindent(`
    BarChart (data="chart_data" x="carrier" y="total_distance")
    DataTable (data="table_data")
  `))
})

test('cli run exports chart and table data as csv', async ({runCli, server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Component CSV
    \`\`\`sql component_data
    from flights where carrier in ('AA', 'DL') select carrier, count() as total_flights group by 1 order by carrier
    \`\`\`
    <BarChart data="component_data" x="carrier" y="total_flights" title="Carrier Flights" />
    <Table data="component_data" title="Carrier Totals" />
  `,
  )

  await page.goto(server.url())
  let outputs: string[] = []
  for (let title of ['Carrier Flights', 'Carrier Totals']) {
    let result = await runCli(['run', 'pages/index.md', '--chart', title, '--format', 'csv'], config)
    expect(result.code).toBe(0)
    outputs.push(outputLines(result.stdout + result.stderr))
  }
  vitestExpect(outputs).toEqual([carrierCsvOutput, carrierCsvOutput])
})

test('cli run with --headless formats chart data as csv', async ({runCli, server}) => {
  server.mockFile(
    '/index.md',
    `
    # Headless Chart CSV
    \`\`\`sql chart_data
    from flights where carrier in ('AA', 'DL') select carrier, count() as total_flights group by 1 order by carrier
    \`\`\`
    <BarChart data="chart_data" x="carrier" y="total_flights" title="Carrier Flights" />
  `,
  )

  server.url()
  let result = await runCli(['run', 'pages/index.md', '--chart', 'Carrier Flights', '--format', 'csv', '--headless'], config)
  expect(result.code).toBe(0)
  vitestExpect(outputLines(result.stdout + result.stderr)).toBe(carrierCsvOutput)
})



test('cli run selects components by ID and reports an unknown selector', async ({runCli, server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Component Screenshots
    \`\`\`sql chart_data
    from flights select carrier, sum(distance) as total_distance
    \`\`\`
    \`\`\`sql table_data
    from flights select carrier, count() as total_flights group by 1 order by carrier limit 5
    \`\`\`
    <BarChart data="chart_data" x="carrier" y="total_distance" title="Carrier Distance" />
    <Table data="table_data" title="Carrier Totals" rows=5 />
  `,
  )

  await page.goto(server.url())
  let outputs: string[] = []
  for (let componentId of ['BarChart (data="chart_data" x="carrier" y="total_distance")', 'DataTable (data="table_data")']) {
    let result = await runCli(['run', 'pages/index.md', '--chart', componentId], config)
    outputs.push(outputLines(result.stdout + result.stderr))
  }
  vitestExpect(outputs).toEqual([carrierDistanceOutput, carrierTotalsOutput])

  let result = await runCli(['run', 'pages/index.md', '--chart', 'Missing Chart'], config)
  expect(result.code).toBe(1)
  vitestExpect(outputLines(result.stdout + result.stderr)).toBe('ERROR: input: Could not find chart "Missing Chart"')
})
