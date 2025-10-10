import {test, expect} from './fixtures'
import {singleDim, timeseries, timeseriesGrouped} from './testData'

test.use({
  viewport: {width: 680, height: 400},
})

test('bar chart', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {data: timeseries(), x: 'month', y: 'sales_usd0k'})
  await expect(chart.el).toHaveScreenshot('bar-chart.png')
})

test('horizontal bar chart', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {data: singleDim(), x: 'category', y: 'value', swapXY: true})
  await expect(chart.el).toHaveScreenshot('horizontal-bar-chart.png')
})

test('area chart', async ({mount, chart}) => {
  await mount('components/AreaChart.svelte', {data: timeseries(), x: 'month', y: 'sales_usd0k'})
  await expect(chart.el).toHaveScreenshot('area-chart.png')
})

test('stacked area chart', async ({mount, chart}) => {
  await mount('components/AreaChart.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', series: 'category', type: 'stacked'})
  await expect(chart.el).toHaveScreenshot('stacked-area-chart.png')
})

test('line chart timeseries', async ({mount, page, chart}) => {
  await mount('components/LineChart.svelte', {data: timeseries(), x: 'month', y: 'sales_usd0k'})
  await expect(page.locator('canvas')).toBeVisible()
  let axisType = await chart.config(c => c.xAxis[0].type)
  expect(axisType).toBe('time')
  await expect(chart.el).toHaveScreenshot('line-chart-timeseries.png')
})

test('pie chart', async ({mount, chart}) => {
  await mount('components/PieChart.svelte', {data: singleDim(), category: 'category', value: 'value'})
  await expect(chart.el).toHaveScreenshot('pie-chart.png')
})

test('big value', async ({mount, page, chart}) => {
  await mount('components/BigValue.svelte', {data: singleDim(), value: 'value', fmt: 'num0', title: 'Sales'})
  await expect(page.getByText('Sales')).toBeVisible()
  await expect(page.getByText('611,113')).toBeVisible()
  await expect(chart.el).toHaveScreenshot('big-value.png')
})
