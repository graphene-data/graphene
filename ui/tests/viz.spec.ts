import {test, expect, waitForGrapheneQueries} from './fixtures'

test('bar chart', async ({mount, page}) => {
  await mount('components/barChart.svelte', {data: makeData(), x: 'origin', y: 'avg_delay'})
  await expect(page.locator('canvas')).toBeVisible()
})

test('area chart', async ({mount, page}) => {
  await mount('components/areaChart.svelte', {data: makeData(), x: 'origin', y: 'avg_delay'})
  await expect(page.locator('canvas')).toBeVisible()
})

test('line chart', async ({mount, page}) => {
  await mount('components/lineChart.svelte', {data: makeData(), x: 'origin', y: 'avg_delay'})
  await expect(page.locator('canvas')).toBeVisible()
})

test('pie chart', async ({mount, page}) => {
  await mount('components/pieChart.svelte', {
    data: makeData(),
    category: 'origin',
    value: 'avg_delay',
    printEchartsConfig: null,
  })
  await expect(page.locator('canvas')).toBeVisible()
})

test('big value', async ({mount, page}) => {
  await mount('components/bigValue.svelte', {
    data: makeData(),
    value: 'avg_delay',
    fmt: 'num0',
    title: 'Average Delay',
  })
  await waitForGrapheneQueries(page)
  await expect(page.getByText('Average Delay')).toBeVisible()
  await expect(page.getByText('8')).toBeVisible()
  await page.pause()
})

test('table', async ({mount, page}) => {
  await mount('components/table.svelte', {data: makeData(), title: 'Average Delay'})
  await waitForGrapheneQueries(page)
  let table = page.locator('[data-testid="DataTable-no-id"] table')
  await expect(table).toBeVisible()
  await expect(table.getByRole('cell', {name: 'SFO'}).first()).toBeVisible()
})

function makeData () {
  return [
    {origin: 'SFO', avg_delay: 8},
    {origin: 'LAX', avg_delay: 12},
  ]
}
