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

test('timeseries chart formats x axis', async ({mount, chartConfig}) => {
  await mount('components/LineChart.svelte', {data: makeTimeseriesData(), x: 'flight_time', y: 'dep_delay', xType: 'time'})

  let sampleLabel = await chartConfig((cfg) => {
    let xAxis = Array.isArray(cfg?.xAxis) ? cfg?.xAxis[0] : cfg?.xAxis
    return xAxis?.axisLabel?.formatter?.('2023-01-01T00:00:00')
  })

  expect(sampleLabel).toBe('2023-01-01')
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

function makeTimeseriesData () {
  let rows = [
    {flight_time: new Date('2023-01-01T00:00:00'), dep_delay: 4},
    {flight_time: new Date('2023-01-01T01:00:00'), dep_delay: 8},
  ]
  rows._evidenceColumnTypes = [
    {name: 'flight_time', evidenceType: 'date', typeFidelity: 'precise'},
    {name: 'dep_delay', evidenceType: 'number', typeFidelity: 'precise'},
  ]
  return {rows}
}
