import stripAnsi from 'strip-ansi'

import {check} from '../../cli/check.ts'
import {runMdFile} from '../../cli/run.ts'
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
})

test('check defaults to analyzing the whole workspace', async ({server}) => {
  server.mockFile(
    '/tmp_bad.gsql',
    `
    table tmp_bad as (
      from flights select not_a_function()
    )
  `,
  )

  await check({log})
  expect(outputLines()).toEqual(
    `
    ERROR: tmp_bad.gsql line 3: Unknown function: not_a_function
   |   from flights select not_a_function()
   |                       ^^^^^^^^^^^^^^^^
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
   | from flights select 1 as origin, not_a_function() as explode
   |                                  ^^^^^^^^^^^^^^^^
  `.trim(),
  )
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
  expectConsoleError('Error in Bar Chart')
  expectConsoleError(/ECharts.*has been disposed/)
  server.mockFile(
    '/index.md',
    `
    # Runtime Chart Config Error
    \`\`\`sql chart_data
    from flights select carrier, min(dep_delay) as worst_delay
    \`\`\`
    <BarChart data="chart_data" x="carrier" y="worst_delay" yLog="true" title="Runtime Chart Config Error" />
  `,
  )

  await page.goto(server.url())
  await runMdFile({mdArg: 'index.md', log})
  expect(outputLines()).toEqual(
    trimIndentation(`
    Runtime errors in index.md:
    Runtime Chart Config Error (data="chart_data" x="carrier" y="worst_delay"): Log axis cannot display values less than or equal to zero
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
    DataTable: not_a_column is not a column in the dataset. sort should contain one column name and optionally a direction (asc or desc).
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
