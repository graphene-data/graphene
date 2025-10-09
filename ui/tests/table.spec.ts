import {expect, test, waitForGrapheneQueries} from './fixtures'
import {tableDataForPagination, tableDataWithDates, timeseriesGrouped} from './testData'

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
