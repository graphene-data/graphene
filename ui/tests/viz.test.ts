import {expect, test} from './fixtures'
import {singleDim, timeseries, timeseriesGrouped} from './testData'

test.beforeEach(async ({page}) => {
  await page.setViewportSize({width: 680, height: 400})
})

test('bar chart', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {data: timeseries(), x: 'month', y: 'sales_usd0k'})
  await expect(chart.el).screenshot('bar-chart')
})

test('horizontal bar chart', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {data: singleDim(), x: 'category', y: 'value', swapXY: true})
  await expect(chart.el).screenshot('horizontal-bar-chart')
})

test('area chart', async ({mount, chart}) => {
  await mount('components/AreaChart.svelte', {data: timeseries(), x: 'month', y: 'sales_usd0k'})
  await expect(chart.el).screenshot('area-chart')
})

test('stacked area chart', async ({mount, chart}) => {
  await mount('components/AreaChart.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', series: 'category', type: 'stacked'})
  await expect(chart.el).screenshot('stacked-area-chart')
})

test('line chart timeseries', async ({mount, page, chart}) => {
  await mount('components/LineChart.svelte', {data: timeseries(), x: 'month', y: 'sales_usd0k'})
  await expect(page.locator('canvas')).toBeVisible()
  let axisType = await chart.config(c => c.xAxis[0].type)
  expect(axisType).toBe('time')
  await expect(chart.el).screenshot('line-chart-timeseries')
})

test('pie chart', async ({mount, chart}) => {
  await mount('components/PieChart.svelte', {data: singleDim(), category: 'category', value: 'value'})
  await expect(chart.el).screenshot('pie-chart')
})

test('big value', async ({mount, page, chart}) => {
  await mount('components/BigValue.svelte', {data: singleDim(), value: 'value', fmt: 'num0', title: 'Sales'})
  await expect(page.getByText('Sales')).toBeVisible()
  await expect(page.getByText('611,113')).toBeVisible()
  await expect(chart.el).screenshot('big-value')
})

test('chart uses css named colors from comma-separated palette', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {
    data: timeseriesGrouped(),
    x: 'month',
    y: 'sales_usd0k',
    series: 'category',
    colorPalette: 'red, SteelBlue, #00ff00',
  })

  let colors = await chart.config((config) => (config.color ?? []).slice(0, 3))
  expect(colors).toEqual(['red', 'SteelBlue', '#00ff00'])
})

test('chart accepts json string palette', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {
    data: timeseriesGrouped(),
    x: 'month',
    y: 'sales_usd0k',
    series: 'category',
    colorPalette: '["#123456", "LightPink", "hsl(120, 100%, 50%)"]',
  })

  let colors = await chart.config((config) => (config.color ?? []).slice(0, 3))
  expect(colors).toEqual(['#123456', 'LightPink', 'hsl(120, 100%, 50%)'])
})

test('series colors accepts json string input', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {
    data: timeseriesGrouped(),
    x: 'month',
    y: 'sales_usd0k',
    series: 'category',
    seriesColors: JSON.stringify({
      'Odd Equipment': 'steelblue',
      'Cursed Sporting Goods': '#123456',
    }),
  })

  let colors = await chart.config((config) => {
    let series = config.series ?? []
    return series.map((entry) => entry.itemStyle?.color).filter(Boolean)
  })
  expect(colors).toContain('steelblue')
  expect(colors).toContain('#123456')
})

test('bar chart accepts comma-separated multi y', async ({mount, chart}) => {
  let data = timeseries() as any
  // augment dataset with a second numeric column while preserving metadata
  let rows = data.rows.map((r: any) => ({...r, profit_usd0k: r.sales_usd0k * 0.5}))
  rows._evidenceColumnTypes = [
    ...data.rows._evidenceColumnTypes,
    {name: 'profit_usd0k', evidenceType: 'number'},
  ]
  data.rows = rows

  await mount('components/BarChart.svelte', {data, x: 'month', y: 'sales_usd0k, profit_usd0k'})

  let seriesLen = await chart.config((c) => (c.series ?? []).length)
  expect(seriesLen).toBe(2)
  await expect(chart.el).screenshot('bar-chart-multi-y')
})
