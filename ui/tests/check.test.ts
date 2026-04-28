import stripAnsi from 'strip-ansi'

import {check} from '../../cli/check.ts'
import {listMdFileQueries, runMdFile} from '../../cli/run.ts'
import {mockFileMap} from '../../lang/mockFiles.ts'
import {trimIndentation} from '../../lang/util.ts'
import {test, expect} from './fixtures.ts'
import {expectConsoleError} from './logWatcher.ts'

let logs = ''
function log(...args: any[]) {
  // console.log(...args) // useful for debugging, but pollutes test outputs
  logs += args.map(a => String(a)).join(' ') + '\n'
}

function outputLines() {
  let normalized = logs.replace(/graphene-screenshot-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.png/g, 'graphene-screenshot-<timestamp>.png')
  normalized = normalized.replace(/Screenshot saved to[^\n]*graphene-screenshot-<timestamp>\.png/g, 'Screenshot saved to /tmp/graphene-screenshot-<timestamp>.png')
  return stripAnsi(normalized.trim())
}

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
  expect(outputLines()).toEqual(
    `
    ERROR: tmp_bad.gsql line 3: Unknown function: not_a_function
      from flights select not_a_function()
                          ^^^^^^^^^^^^^^^^
  `.trim(),
  )
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
  await check({fileArg: 'mock.md', log})
  expect(outputLines()).toEqual(
    `
    ERROR: mock.md line 3: Unknown function: not_a_function
from flights select 1 as origin, not_a_function() as explode
                                 ^^^^^^^^^^^^^^^^
  `.trim(),
  )
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
  expect(outputLines()).toContain('ERROR: mock.md line 4: Unsupported prop "yFmt" on BarChart. Use field metadata or ECharts for custom formatting.')
})

test('cli run with md file reports runtime query errors', async ({server, page}) => {
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
  await runMdFile({mdArg: 'index.md', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    Runtime errors in index.md:
    Query (data="runtime_error_query" x="origin" y="explode"): Out of Range Error: cannot take square root of a negative number
    Screenshot saved to /tmp/graphene-screenshot-<timestamp>.png
  `),
  )
})

test('cli run with md file reports runtime chart configuration errors', async ({server, page}) => {
  expectConsoleError('Chart failed to render')
  server.mockFile(
    '/index.md',
    `
    # Runtime Chart Config Error
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
  await runMdFile({mdArg: 'index.md', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    Runtime errors in index.md:
    Query (data="chart_data" x="x_value" y="bad_category"): Horizontal charts do not support a value or time-based x-axis
    Screenshot saved to /tmp/graphene-screenshot-<timestamp>.png
  `),
  )
})

test('cli run with md file reports table configuration errors', async ({server, page}) => {
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
  await runMdFile({mdArg: 'index.md', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    Runtime errors in index.md:
    Query (DataTable): not_a_column is not a column in the dataset. sort should contain one column name and optionally a direction (asc or desc).
    Screenshot saved to /tmp/graphene-screenshot-<timestamp>.png
`),
  )
})

test('cli run with md file reports html compilation errors', async ({server, page}) => {
  expectConsoleError('Failed to load resource')
  expectConsoleError('Internal Server Error')
  expectConsoleError('Failed to fetch dynamically imported module')
  server.mockFile(
    '/index.md',
    `
    # Test
    {#if true}oops{/if}
  `,
  )

  await page.goto(server.url())
  let result = await runMdFile({mdArg: 'index.md', log})
  expect(result).toBe(false)
  let output = outputLines()
  expect(output).toContain('Runtime errors in index.md:')
  expect(output).toMatch(/ERROR: .*index\.md line 7: Unexpected block closing tag/)
  expect(output).toContain('<p>oops{/if}</p>')
  expect(output).toContain('^')
})

test('cli run with --chart captures a single chart screenshot', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Chart Screenshot
    \`\`\`sql chart_data
    from flights select carrier, sum(distance) as total_distance
    \`\`\`
    <BarChart data="chart_data" x="carrier" y="total_distance" title="Carrier Distance" />
  `,
  )

  await page.goto(server.url())
  await runMdFile({mdArg: 'index.md', chart: 'Carrier Distance', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    No errors found 💎
    Screenshot saved to /tmp/graphene-screenshot-<timestamp>.png
  `),
  )
})

test('cli run with --chart captures an ECharts screenshot by title', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # ECharts Screenshot
    \`\`\`sql chart_data
    from flights select carrier, sum(distance) as total_distance
    \`\`\`
    <ECharts data="chart_data">
      title: [{text: "Carrier Distance"}],
      xAxis: {type: "category"},
      yAxis: {},
      series: [{type: "bar", encode: {x: "carrier", y: "total_distance"}}],
    </ECharts>
  `,
  )

  await page.goto(server.url())
  await runMdFile({mdArg: 'index.md', chart: 'Carrier Distance', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    No errors found 💎
    Screenshot saved to /tmp/graphene-screenshot-<timestamp>.png
  `),
  )
})

test('cli list prints chart query IDs', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Query List
    \`\`\`sql chart_data
    from flights select carrier, sum(distance) as total_distance
    \`\`\`
    <BarChart data="chart_data" x="carrier" y="total_distance" title="Carrier Distance" />
  `,
  )

  await page.goto(server.url())
  let result = await listMdFileQueries('index.md', undefined, log)
  expect(result).toBe(true)
  expect(outputLines()).toEqual('data="chart_data" x="carrier" y="total_distance"')
})

test('cli run with --chart captures a chart screenshot by query ID', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Chart Screenshot
    \`\`\`sql chart_data
    from flights select carrier, sum(distance) as total_distance
    \`\`\`
    <BarChart data="chart_data" x="carrier" y="total_distance" title="Carrier Distance" />
  `,
  )

  await page.goto(server.url())
  await runMdFile({mdArg: 'index.md', chart: 'data="chart_data" x="carrier" y="total_distance"', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    No errors found 💎
    Screenshot saved to /tmp/graphene-screenshot-<timestamp>.png
  `),
  )
})

test('cli run with --chart reports when no chart title matches', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    # Chart Screenshot
    \`\`\`sql chart_data
    from flights select carrier, sum(distance) as total_distance
    \`\`\`
    <BarChart data="chart_data" x="carrier" y="total_distance" title="Carrier Distance" />
  `,
  )

  await page.goto(server.url())
  let result = await runMdFile({mdArg: 'index.md', chart: 'Missing Chart', log})
  expect(result).toBe(false)
  expect(outputLines()).toEqual('Could not find chart "Missing Chart" on index.md')
})
