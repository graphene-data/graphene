import stripAnsi from 'strip-ansi'

import {check} from '../../cli/check.ts'
import {mockFileMap} from '../../cli/mockFiles.ts'
import {listMdFileQueries, runMdFile} from '../../cli/run.ts'
import {trimIndentation} from '../../lang/util.ts'
import {test, expect} from './fixtures.ts'
import {expectConsoleError} from './logWatcher.ts'

let logs = ''
function log(...args: any[]) {
  // console.log(...args) // useful for debugging, but pollutes test outputs
  logs += args.map(a => String(a)).join(' ') + '\n'
}

function outputLines() {
  let normalized = logs.replace(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.png/g, '<timestamp>.png')
  normalized = normalized.replace(
    /Screenshot saved to[^\n]*node_modules\/\.graphene\/screenshots\/<timestamp>\.png/g,
    'Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png',
  )
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

test('check reports invalid metadata annotations', async () => {
  mockFileMap['tmp_bad_metadata.gsql'] = trimIndentation(`
    table tmp_bad_metadata (
      rate number #ratio=false
    )
  `)

  let result = await check({fileArg: 'tmp_bad_metadata.gsql', log})
  expect(result).toBe(false)
  expect(outputLines()).toContain('ERROR: tmp_bad_metadata.gsql line 2: Metadata "#ratio" is a flag; use "#ratio" or "#ratio=true".')
})

test('cli run with md file reports dynamic unsupported chart wrapper props', async ({server}) => {
  server.mockFile(
    '/index.md',
    `
    # Runtime Chart Prop Error
    \`\`\`sql chart_data
    from flights select carrier, distance limit 25
    \`\`\`
    <BarChart data="chart_data" x="carrier" y="distance" {...{yFmt: 'num0'}} />
  `,
  )

  server.url()
  let result = await runMdFile({mdArg: 'index.md', log})
  expect(result).toBe(false)
  expect(outputLines()).toEqual(
    trimIndentation(`
    Runtime errors in index.md:
    BarChart (data="chart_data" x="carrier" y="distance"): Unsupported prop "yFmt" on BarChart.
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
  `),
  )
})

test('cli run with md file reports dynamic unsupported ECharts top-level props', async ({server}) => {
  server.mockFile(
    '/index.md',
    `
    # Runtime ECharts Prop Error
    \`\`\`sql chart_data
    from flights select carrier, distance limit 25
    \`\`\`

    <ECharts data="chart_data" {...{chartAreaHeight: 240}}>
      xAxis: {},
      yAxis: {},
      series: [{type: "bar", encode: {x: "carrier", y: "distance"}}],
    </ECharts>
  `,
  )

  server.url()
  let result = await runMdFile({mdArg: 'index.md', log})
  expect(result).toBe(false)
  expect(outputLines()).toEqual(
    trimIndentation(`
    Runtime errors in index.md:
    ECharts (data="chart_data" x="carrier" y="distance"): Unsupported prop "chartAreaHeight" on ECharts.
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
  `),
  )
})

test('cli run with md file reports multiple dynamic unsupported chart props', async ({server}) => {
  server.mockFile(
    '/index.md',
    `
    # Multiple Runtime Chart Prop Errors
    \`\`\`sql chart_data
    from flights select carrier, distance limit 25
    \`\`\`
    <BarChart data="chart_data" x="carrier" y="distance" {...{yFmt: 'num0', emptySet: 'warn'}} />
  `,
  )

  server.url()
  let result = await runMdFile({mdArg: 'index.md', log})
  expect(result).toBe(false)
  expect(outputLines()).toEqual(
    trimIndentation(`
    Runtime errors in index.md:
    BarChart (data="chart_data" x="carrier" y="distance"): Unsupported prop "yFmt" on BarChart. Unsupported prop "emptySet" on BarChart.
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
  `),
  )
})

test('cli run with md file reports runtime chart prop and render errors together', async ({server}) => {
  expectConsoleError('Chart failed to render')
  server.mockFile(
    '/index.md',
    `
    # Runtime Chart Prop And Render Error
    \`\`\`sql chart_data
    from flights select dep_delay as x_value, dep_delay as bad_category limit 25
    \`\`\`

    <ECharts data="chart_data" {...{chartAreaHeight: 240}}>
      xAxis: {},
      yAxis: {type: "category"},
      series: [{type: "bar", encode: {x: "x_value", y: "bad_category"}}],
    </ECharts>
  `,
  )

  server.url()
  let result = await runMdFile({mdArg: 'index.md', log})
  expect(result).toBe(false)
  expect(outputLines()).toEqual(
    trimIndentation(`
    Runtime errors in index.md:
    ECharts (data="chart_data" x="x_value" y="bad_category"): Horizontal charts do not support a value or time-based x-axis
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
  `),
  )
})

test('cli run with md file reports runtime query errors', async ({server}) => {
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

  server.url()
  await runMdFile({mdArg: 'index.md', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    Runtime errors in index.md:
    BarChart (data="runtime_error_query" x="origin" y="explode"): Out of Range Error: cannot take square root of a negative number
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
  `),
  )
})

test('cli run with md file reports runtime chart configuration errors', async ({server}) => {
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

  server.url()
  await runMdFile({mdArg: 'index.md', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    Runtime errors in index.md:
    ECharts (data="chart_data" x="x_value" y="bad_category"): Horizontal charts do not support a value or time-based x-axis
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
  `),
  )
})

test('cli run with md file reports table configuration errors', async ({server}) => {
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

  server.url()
  await runMdFile({mdArg: 'index.md', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    Runtime errors in index.md:
    DataTable: not_a_column is not a column in the dataset. sort should contain one column name and optionally a direction (asc or desc).
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
`),
  )
})

test('cli run with md file reports big value query errors', async ({server}) => {
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

  server.url()
  await runMdFile({mdArg: 'index.md', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    Runtime errors in index.md:
    BigValue (data="big_value_data" value="value"): Out of Range Error: cannot take square root of a negative number
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
`),
  )
})

test('cli run with md file reports html compilation errors', async ({server}) => {
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

  server.url()
  let result = await runMdFile({mdArg: 'index.md', log})
  expect(result).toBe(false)
  let output = outputLines()
  expect(output).toContain('Runtime errors in index.md:')
  expect(output).toMatch(/ERROR: .*index\.md line 7: Unexpected block closing tag/)
  expect(output).toContain('<p>oops{/if}</p>')
  expect(output).toContain('^')
})

test('cli run with --chart captures a single chart screenshot', async ({server}) => {
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

  server.url()
  await runMdFile({mdArg: 'index.md', chart: 'Carrier Distance', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    No errors found 💎
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
  `),
  )
})

test('cli run with --input applies inputs to a full page run', async ({server}) => {
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

  server.url()
  let result = await runMdFile({mdArg: 'index.md', inputs: {carrier: 'AA'}, log})

  expect(result).toBe(true)
  expect(outputLines()).toEqual(
    trimIndentation(`
    No errors found 💎
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
  `),
  )
})

test('cli run with --chart captures an ECharts screenshot by title', async ({server}) => {
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

  server.url()
  await runMdFile({mdArg: 'index.md', chart: 'Carrier Distance', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    No errors found 💎
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
  `),
  )
})

test('cli list prints chart component IDs', async ({server}) => {
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

  server.url()
  let result = await listMdFileQueries('index.md', undefined, log)
  expect(result).toBe(true)
  expect(outputLines()).toEqual('BarChart (data="chart_data" x="carrier" y="total_distance")')
})

test('cli run with --chart captures a chart screenshot by component ID', async ({server}) => {
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

  server.url()
  await runMdFile({mdArg: 'index.md', chart: 'BarChart (data="chart_data" x="carrier" y="total_distance")', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    No errors found 💎
    Screenshot saved to <project>/node_modules/.graphene/screenshots/<timestamp>.png
  `),
  )
})

test('cli run with --chart reports when no chart title matches', async ({server}) => {
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

  server.url()
  let result = await runMdFile({mdArg: 'index.md', chart: 'Missing Chart', log})
  expect(result).toBe(false)
  expect(outputLines()).toEqual('Could not find chart "Missing Chart" on index.md')
})
