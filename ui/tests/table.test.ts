import {expect, test, waitForGrapheneQueries} from './fixtures.ts'
import {groupedDataForSection, tableDataForPagination, tableDataWithDates, timeseriesGrouped} from './testData.ts'

test('renders table data', async ({mount, page}) => {
  await mount('components/Table.svelte', {data: timeseriesGrouped(), title: 'Sales'})
  await waitForGrapheneQueries(page)
  let table = page.locator('[data-testid="DataTable-no-id"] table')
  await expect(table).toBeVisible()
  await expect(table.getByRole('cell').first()).toHaveText('2021-01-01')
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
