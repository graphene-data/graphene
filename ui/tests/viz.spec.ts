import {test, expect, waitForGrapheneQueries} from './fixtures'

test('bar chart', async ({mount, page}) => {
  await mount('components/BarChart.svelte', {data: makeData(), x: 'origin', y: 'avg_delay'})
  await expect(page.locator('canvas')).toBeVisible()
})

test('area chart', async ({mount, page}) => {
  await mount('components/AreaChart.svelte', {data: makeData(), x: 'origin', y: 'avg_delay'})
  await expect(page.locator('canvas')).toBeVisible()
})

test('stacked area chart', async ({mount, page}) => {
  await mount('components/AreaChart.svelte', {
    data: {
      rows: [
        {origin: 'A', carrier: 'AA', avg_delay: 1},
        {origin: 'A', carrier: 'UA', avg_delay: 2},
        {origin: 'B', carrier: 'AA', avg_delay: 3},
        {origin: 'B', carrier: 'UA', avg_delay: 4},
      ],
    },
    x: 'origin',
    y: 'avg_delay',
    series: 'carrier',
    type: 'stacked',
  })
})

test('line chart', async ({mount, page}) => {
  await mount('components/LineChart.svelte', {data: makeData(), x: 'origin', y: 'avg_delay'})
  await expect(page.locator('canvas')).toBeVisible()
})

test('pie chart', async ({mount, page}) => {
  await mount('components/PieChart.svelte', {
    data: makeData(),
    category: 'origin',
    value: 'avg_delay',
    printEchartsConfig: null,
  })
  await expect(page.locator('canvas')).toBeVisible()
})

test('big value', async ({mount, page}) => {
  await mount('components/BigValue.svelte', {
    data: makeData(),
    value: 'avg_delay',
    fmt: 'num0',
    title: 'Average Delay',
  })
  await waitForGrapheneQueries(page)
  await expect(page.getByText('Average Delay')).toBeVisible()
  await expect(page.getByText('8')).toBeVisible()
})

test('table', async ({mount, page}) => {
  await mount('components/Table.svelte', {data: makeData(), title: 'Average Delay'})
  await waitForGrapheneQueries(page)
  let table = page.locator('[data-testid="DataTable-no-id"] table')
  await expect(table).toBeVisible()
  await expect(table.getByRole('cell', {name: 'SFO'}).first()).toBeVisible()
})

function makeData () {
  return {
    rows: [
      {origin: 'SFO', avg_delay: 8},
      {origin: 'LAX', avg_delay: 12},
    ],
  }
}
