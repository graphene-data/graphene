import {expect, test, waitForGrapheneQueries} from './fixtures.ts'
import {groupedDataForSection, tableDataForPagination, tableDataWithDates, timeseriesGrouped} from './testData.ts'

const tableSelector = '[data-testid="DataTable-no-id"] table'

test('renders table data', async ({mount, page}) => {
  await mount('components/Table.svelte', {data: timeseriesGrouped(), title: 'Sales'})
  await waitForGrapheneQueries(page)
  let table = page.locator('[data-testid="DataTable-no-id"] table')
  await expect(table).toBeVisible()
  // Use explicit td selector like other table tests since getByRole('cell') can match th elements
  await expect(table.locator('tr:has(td) td:first-child').first()).toHaveText('2021-01-01')
})

test('sorts by column header', async ({mount, page}) => {
  await mount('components/Table.svelte', {data: tableDataWithDates()})
  let table = page.locator('[data-testid="DataTable-no-id"] table')
  await expect(table).toBeVisible()
  await expect(table.locator('tr:has(td)')).toHaveCount(3)

  let readFirstColumn = () => table.locator('tr:has(td) td:first-child').allTextContents()

  await expect.poll(readFirstColumn).toEqual(['2021-03-01', '2021-01-01', '2021-02-01'])

  let header = table.getByRole('columnheader').first()
  await header.click()
  await expect.poll(readFirstColumn).toEqual(['2021-01-01', '2021-02-01', '2021-03-01'])

  await header.click()
  await expect.poll(readFirstColumn).toEqual(['2021-03-01', '2021-02-01', '2021-01-01'])
})

test('sortable=false keeps header clicks from changing order', async ({mount, page}) => {
  await mount('components/Table.svelte', {data: tableDataWithDates(), sortable: false})
  let table = page.locator('[data-testid="DataTable-no-id"] table')
  await expect(table).toBeVisible()

  let readFirstColumn = () => table.locator('tr:has(td) td:first-child').allTextContents()
  await expect.poll(readFirstColumn).toEqual(['2021-03-01', '2021-01-01', '2021-02-01'])

  let header = table.getByRole('columnheader').first()
  await expect(header).toHaveAttribute('aria-sort', 'none')
  await header.click()
  await expect.poll(readFirstColumn).toEqual(['2021-03-01', '2021-01-01', '2021-02-01'])
  await expect(page.locator('.table-container')).screenshot('sort-disabled')
})

test('paginates rows', async ({mount, page}) => {
  await mount('components/Table.svelte', {data: tableDataForPagination(12), rows: 5})
  let table = page.locator('[data-testid="DataTable-no-id"] table')
  await expect(table).toBeVisible()
  await expect(table.locator('tr:has(td)')).toHaveCount(5)

  let firstCell = () => table.locator('tr:has(td) td:first-child').first()

  await expect(firstCell()).toHaveText('Row 1')
  await expect(page.getByRole('button', {name: 'First'})).toBeDisabled()
  await expect(page.getByRole('button', {name: 'Prev'})).toBeDisabled()
  await page.getByRole('button', {name: 'Next'}).click()
  await expect(firstCell()).toHaveText('Row 6')
  await page.getByRole('button', {name: 'Last'}).click()
  await expect(firstCell()).toHaveText('Row 11')
  await expect(page.getByRole('button', {name: 'Last'})).toBeDisabled()
  await expect(page.getByRole('button', {name: 'Next'})).toBeDisabled()
  await page.getByRole('button', {name: 'First'}).click()
  await expect(firstCell()).toHaveText('Row 1')
  await expect(page.getByRole('button', {name: 'Prev'})).toBeDisabled()
  await expect(page.getByText('Page 1 of 3')).toBeVisible()
  await expect(page.locator('.pagination__meta')).toHaveText('5 of 12 rows')
  await expect(page.locator('.table-container')).screenshot('pagination-first-last')
})

test('colorscale with colorBreakpoints applies correct background colors', async ({server, page}) => {
  // Three columns with different value ranges against the same 0-1 breakpoints.
  // High column should be green, low column should be red — verify via screenshot.
  server.mockFile('/index.md', `
    \`\`\`sql retention_data
    from flights select carrier, count(*) / 100000.0 as high_val, count(*) / 500000.0 as mid_val, count(*) / 2000000.0 as low_val group by carrier limit 5
    \`\`\`

    <Table data=retention_data rows=all>
      <Column id=carrier title="Carrier" />
      <Column id=high_val fmt=pct0 title="High" contentType=colorscale colorScale="red, yellow, green" colorBreakpoints="0, 0.5, 1" />
      <Column id=mid_val fmt=pct0 title="Mid" contentType=colorscale colorScale="red, yellow, green" colorBreakpoints="0, 0.5, 1" />
      <Column id=low_val fmt=pct0 title="Low" contentType=colorscale colorScale="red, yellow, green" colorBreakpoints="0, 0.5, 1" />
    </Table>
  `)

  await page.goto(server.url() + '/', {waitUntil: 'commit'})
  await page.locator('table tr:has(td)').first().waitFor()
  await expect(page.locator('.table-container')).screenshot('colorscale-breakpoints')
})

test('colorBreakpoints work when all column values are identical', async ({server, page}) => {
  // Edge case: all rows have the same value (columnMin === columnMax).
  // Breakpoints define the domain, so val=1.0 should map to green end of 0/0.5/1 scale.
  server.mockFile('/index.md', `
    \`\`\`sql uniform_data
    from flights select carrier, 1.0 as val limit 3
    \`\`\`

    <Table data=uniform_data rows=all>
      <Column id=carrier title="Carrier" />
      <Column id=val fmt=pct0 title="Value" contentType=colorscale colorScale="red, yellow, green" colorBreakpoints="0, 0.5, 1" />
    </Table>
  `)

  await page.goto(server.url() + '/', {waitUntil: 'commit'})
  await page.locator('table tr:has(td)').first().waitFor()
  await expect(page.locator('.table-container')).screenshot('colorscale-breakpoints-uniform')
})

test('groupType=section renders correct rowSpan for first row of each group', async ({mount, page}) => {
  // expect(1).toBe(2)
  await mount('components/Table.svelte', {data: groupedDataForSection(), groupBy: 'time_horizon', groupType: 'section'})
  await waitForGrapheneQueries(page)
  let table = page.locator('[data-testid="DataTable-no-id"] table')
  await expect(table).toBeVisible()

  // Find cells containing group names and verify they have correct rowspan
  // "30 days" group has 3 rows, so its cell should have rowspan=3
  let cell30days = table.locator('td', {hasText: '30 days'}).first()
  await expect(cell30days).toBeVisible()
  await expect(cell30days).toHaveAttribute('rowspan', '3')

  // "60 days" group has 2 rows, so its cell should have rowspan=2
  let cell60days = table.locator('td', {hasText: '60 days'}).first()
  await expect(cell60days).toBeVisible()
  await expect(cell60days).toHaveAttribute('rowspan', '2')

  // "90 days" group has 1 row, so its cell should have rowspan=1
  let cell90days = table.locator('td', {hasText: '90 days'}).first()
  await expect(cell90days).toBeVisible()
  await expect(cell90days).toHaveAttribute('rowspan', '1')
})

test('row numbers stay stable across sort and pagination states', async ({mount, page}) => {
  await mount('components/Table.svelte', {
    data: tableDataForPagination(12),
    rows: 5,
    rowNumbers: true,
    sort: 'value desc',
  })
  await waitForGrapheneQueries(page)

  let table = page.locator(tableSelector)
  await expect(table).toBeVisible()
  await expect(table.locator('tr.table-row').first().locator('td.index')).toHaveText('1')
  await expect(table.locator('tr.table-row').first().locator('td.number')).toHaveText('12')
  await expect(page.locator('.table-container')).screenshot('row-numbers-sort-page-1')

  await table.getByRole('columnheader', {name: 'Value'}).click()
  await expect(table.locator('tr.table-row').first().locator('td.number')).toHaveText('1')
  await expect(page.locator('.table-container')).screenshot('row-numbers-sort-asc-page-1')

  await page.getByRole('button', {name: 'Next'}).click()
  await expect(table.locator('tr.table-row').first().locator('td.index')).toHaveText('6')
  await expect(table.locator('tr.table-row').first().locator('td.number')).toHaveText('6')
  await expect(page.locator('.table-container')).screenshot('row-numbers-sort-asc-page-2')
})

test('accordion grouping with subtotals renders and collapses predictably', async ({mount, page}) => {
  await mount('components/Table.svelte', {
    data: groupedDataForSection(),
    groupBy: 'time_horizon',
    groupType: 'accordion',
    subtotals: true,
    rowNumbers: true,
  })
  await waitForGrapheneQueries(page)

  let table = page.locator(tableSelector)
  await expect(table).toBeVisible()
  await expect(table.locator('tr.group-row')).toHaveCount(3)
  await expect(table.locator('tr.subtotal-row')).toHaveCount(3)
  await expect(page.locator('.table-container')).screenshot('group-accordion-subtotals-open')

  await mount('components/Table.svelte', {
    data: groupedDataForSection(),
    groupBy: 'time_horizon',
    groupType: 'accordion',
    subtotals: true,
    rowNumbers: true,
    groupsOpen: false,
  })
  await waitForGrapheneQueries(page)
  await expect(table.locator('tr.group-row')).toHaveCount(3)
  await expect(table.locator('tr.table-row')).toHaveCount(0)
  await expect(table.locator('tr.subtotal-row')).toHaveCount(0)
  await expect(page.locator('.table-container')).screenshot('group-accordion-subtotals-collapsed')
})

test('table attributes render grouped headers, wrapped titles, and row styling options', async ({server, page}) => {
  server.mockFile('/index.md', `
    \`\`\`sql table_style_data
    from flights
    select
      carrier,
      count(*) as flights,
      avg(dep_delay) as avg_delay,
      max(dep_delay) as max_delay
    group by carrier
    order by carrier
    limit 4
    \`\`\`

    <Table
      data=table_style_data
      rows=all
      title="Carrier delay profile"
      subtitle="Grouped headers, wrapped titles, and compact rows"
      rowShading=true
      rowLines=false
      wrapTitles=true
      compact=true
      headerColor="#d9f0ff"
      headerFontColor="#0f172a"
      backgroundColor="#f8fafc"
    >
      <Column id=carrier title="Carrier" description="Carrier code" colGroup="Meta" />
      <Column id=flights title="Total Flights" colGroup="Metrics" align=right />
      <Column id=avg_delay title="Average Delay Minutes Across All Flight Records" colGroup="Metrics" fmt=num2 wrapTitle=true />
      <Column id=max_delay title="Peak Delay" colGroup="Metrics" fmt=num1 align=center />
    </Table>
  `)

  await page.goto(server.url() + '/', {waitUntil: 'commit'})
  let table = page.locator(tableSelector)
  await table.locator('tr:has(td)').first().waitFor()

  await expect(page.getByText('Carrier delay profile')).toBeVisible()
  await expect(page.getByText('Grouped headers, wrapped titles, and compact rows')).toBeVisible()
  await expect(table.locator('.header-group__label', {hasText: 'Metrics'})).toBeVisible()
  await expect(table.locator('.header-title__info').first()).toHaveAttribute('title', 'Carrier code')
  await expect(table.locator('tr.table-row').first()).not.toHaveClass(/table-row--lined/)
  await expect(table.locator('tr.table-row').nth(1)).toHaveClass(/table-row--shaded/)
  await expect(page.locator('.table-container')).screenshot('attribute-groups-and-styling')
})

test('section groups respect groupNamePosition and subtotal styles', async ({mount, page}) => {
  await mount('components/Table.svelte', {
    data: groupedDataForSection(),
    groupBy: 'time_horizon',
    groupType: 'section',
    groupNamePosition: 'top',
    subtotals: true,
    subtotalRowColor: '#ecfeff',
    subtotalFontColor: '#0c4a6e',
  })
  await waitForGrapheneQueries(page)

  let table = page.locator(tableSelector)
  await expect(table).toBeVisible()
  await expect(table.locator('tr.subtotal-row')).toHaveCount(3)
  await expect(table.locator('td[rowspan="3"]').first()).toHaveAttribute('style', /vertical-align:\s*top/i)
  await expect(page.locator('.table-container')).screenshot('section-group-position-top')
})

test('total row renders for ungrouped tables', async ({mount, page}) => {
  await mount('components/Table.svelte', {
    data: tableDataForPagination(4),
    rowNumbers: true,
    totalRow: true,
    rows: 'all',
  })
  await waitForGrapheneQueries(page)

  let table = page.locator(tableSelector)
  await expect(table.locator('tr.total-row')).toBeVisible()
  await expect(table.locator('tr.total-row td.number')).toHaveText('10')
  await expect(page.locator('.table-container')).screenshot('total-row-basic')
})

test('row-level link behavior opens external destinations and hides link column', async ({mount, page}) => {
  let rows = [
    {name: 'Alpha', value: 12, url: 'https://example.com/alpha'},
    {name: 'Beta', value: 8, url: null},
    {name: 'Gamma', value: 5, url: 'https://example.com/gamma'},
  ] as any
  rows._evidenceColumnTypes = [
    {name: 'name', evidenceType: 'string'},
    {name: 'value', evidenceType: 'number'},
    {name: 'url', evidenceType: 'string'},
  ]

  await mount('components/Table.svelte', {data: {rows}, link: 'url', rowNumbers: true, rows: 'all'})
  await waitForGrapheneQueries(page)

  let table = page.locator(tableSelector)
  await expect(table).toBeVisible()
  await expect(table.getByRole('columnheader', {name: 'Url'})).toHaveCount(0)
  await expect(table.locator('tr.table-row').first()).toHaveClass(/table-row--clickable/)
  await expect(table.locator('tr.table-row').nth(1)).not.toHaveClass(/table-row--clickable/)
  await expect(page.locator('.table-container')).screenshot('row-link-hidden-column')

  let popupPromise = page.waitForEvent('popup')
  await table.locator('tr.table-row').first().click()
  let popup = await popupPromise
  await expect.poll(() => popup.url()).toContain('https://example.com/alpha')
  await popup.close()
})

test('colorscale and link content columns render together', async ({server, page}) => {
  server.mockFile('/index.md', `
    \`\`\`sql style_table
    from flights select carrier, count(*) / 30000.0 as retention, 'https://example.com' as details_url group by carrier order by carrier limit 5
    \`\`\`

    <Table data=style_table rows=all>
      <Column id=carrier title="Carrier" />
      <Column id=retention fmt=pct0 title="Retention" contentType=colorscale colorScale="red, yellow, green" colorBreakpoints="0, 0.5, 1" />
      <Column id=details_url title="Details" contentType=link linkLabel="Open" openInNewTab=true />
    </Table>
  `)

  await page.goto(server.url() + '/', {waitUntil: 'commit'})
  let table = page.locator(tableSelector)
  await table.locator('tr:has(td)').first().waitFor()

  await expect(table.locator('a.table-link')).toHaveCount(5)
  await expect(table.locator('a.table-link').first()).toHaveText('Open')
  await expect(table.locator('tr:has(td) td').nth(1)).toHaveAttribute('style', /background-color/i)
  await expect(table.locator('a.table-link').first()).toHaveAttribute('target', '_blank')
  await expect(page.locator('.table-container')).screenshot('colorscale-with-link-content')
})

test('image and link content columns honor sizing, labels, and tab target attributes', async ({server, page}) => {
  server.mockFile('/index.md', `
    \`\`\`sql media_table
    from flights
    select
      carrier,
      concat('https://example.com/images/', lower(carrier), '.png') as logo,
      concat('https://example.com/carriers/', lower(carrier)) as profile_url
    group by carrier
    order by carrier
    limit 3
    \`\`\`

    <Table data=media_table rows=all>
      <Column id=carrier title="Carrier" />
      <Column id=logo title="Logo" contentType=image alt=carrier width="34px" height="18px" />
      <Column id=profile_url title="Profile" contentType=link linkLabel=carrier openInNewTab=false />
    </Table>
  `)

  await page.goto(server.url() + '/', {waitUntil: 'commit'})
  let table = page.locator(tableSelector)
  await table.locator('tr:has(td)').first().waitFor()

  await expect(table.locator('img.table-image')).toHaveCount(3)
  await expect(table.locator('img.table-image').first()).toHaveAttribute('alt', 'AA')
  await expect(table.locator('img.table-image').first()).toHaveAttribute('style', /height:\s*18px/i)
  await expect(table.locator('img.table-image').first()).toHaveAttribute('style', /width:\s*34px/i)
  await expect(table.locator('a.table-link').first()).toHaveText('AA')
  await expect(table.locator('a.table-link').first()).not.toHaveAttribute('target', '_blank')
  await expect(page.locator('.table-container')).screenshot('content-image-and-link')
})
