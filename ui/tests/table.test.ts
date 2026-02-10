import {expect, test, waitForGrapheneQueries} from './fixtures.ts'
import {groupedDataForSection, tableDataForPagination, tableDataWithDates, timeseriesGrouped} from './testData.ts'

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

test('paginates rows', async ({mount, page}) => {
  await mount('components/Table.svelte', {data: tableDataForPagination(12), rows: 5})
  let table = page.locator('[data-testid="DataTable-no-id"] table')
  await expect(table).toBeVisible()
  await expect(table.locator('tr:has(td)')).toHaveCount(5)

  let firstCell = () => table.locator('tr:has(td) td:first-child').first()

  await expect(firstCell()).toHaveText('Row 1')
  await page.getByRole('button', {name: 'Next'}).click()
  await expect(firstCell()).toHaveText('Row 6')
  await page.getByRole('button', {name: 'Prev'}).click()
  await expect(firstCell()).toHaveText('Row 1')
  await expect(page.getByText('Page 1 of 3')).toBeVisible()
  await expect(page.locator('.pagination__meta')).toHaveText('5 of 12 rows')
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
