import {test, expect, waitForGrapheneQueries} from './fixtures'
import fs from 'fs-extra'
import {fileURLToPath} from 'url'
import path from 'path'

let f = path.resolve(fileURLToPath(import.meta.url), '../ordersByCategory.json')
let ordersByCategory = JSON.parse(fs.readFileSync(f))

test.use({
  viewport: {width: 680, height: 400},
})

test('bar chart', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {data: timeseries(), x: 'month', y: 'sales_usd0k'})
  await expect(chart.el).toHaveScreenshot('bar-chart.png')
})

test('horizontal bar chart', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {data: singleDim(), x: 'category', y: 'value', swapXY: true})
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
  await expect(page.getByText('Average Delay')).toBeVisible()
  await expect(page.getByText('8')).toBeVisible()
  await expect(chart.el).toHaveScreenshot('big-value.png')
})

test('table', async ({mount, page}) => {
  await mount('components/Table.svelte', {data: timeseriesGrouped(), title: 'Sales'})
  await waitForGrapheneQueries(page)
  let table = page.locator('[data-testid="DataTable-no-id"] table')
  await expect(table).toBeVisible()
  await expect(table.getByRole('cell', {name: 'SFO'}).first()).toBeVisible()
})

function singleDim () {
  let res = {}
  ordersByCategory.forEach(r => res[r.category] = (res[r.category] || 0) + r['sales_usd0k'])
  let rows = Object.keys(res).map(k => ({category: k, value: res[k]})) as any
  rows._evidenceColumnTypes = [{name: 'category', evidenceType: 'string'}, {name: 'sales_usd0k', evidenceType: 'number'}]
  return {rows}
}

function timeseries () {
  let res = {}
  ordersByCategory.forEach(r => res[r.month] = (res[r.month] || 0) + r['sales_usd0k'])
  let rows = Object.keys(res).map(k => ({month: new Date(k), sales_usd0k: res[k]})) as any
  rows._evidenceColumnTypes = [{name: 'month', evidenceType: 'date'}, {name: 'sales_usd0k', evidenceType: 'number'}]
  return {rows}
}

function timeseriesGrouped () {
  let rows = ordersByCategory.map(r => ({...r, month: new Date(r.month)}))
  rows._evidenceColumnTypes = [
    {name: 'month', evidenceType: 'date'},
    {name: 'category', evidenceType: 'string'},
    {name: 'sales_usd0k', evidenceType: 'number'},
  ]
  return {rows}
}
