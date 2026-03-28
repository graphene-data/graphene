import {expect, test} from './fixtures.ts'
import {singleDim, timeseries, timeseriesGrouped, timeseriesWithDateSeries, yearlyCounts} from './testData.ts'

test.beforeEach(async ({page}) => {
  await page.setViewportSize({width: 680, height: 400})
})

test('bar chart', async ({mount, chart}) => {
  await mount('components2/BarChart2.svelte', {data: timeseries(), x: 'month', y: 'sales_usd0k', title: 'Monthly Sales'})
  await expect(chart.el).screenshot('bar-chart')
})

test('bar chart with just 0,1 has sensible y axis ticks', async ({mount, chart, page}) => {
  let rows = [{category: 'A', count: 1}, {category: 'B', count: 0}, {category: 'C', count: 1}]
  await mount('components2/BarChart2.svelte', {data: {rows}, x: 'category', y: 'count'})
  await expect(chart.el).screenshot('bar-chart-0-to-1')
})

test('bar chart grouped + stacked', async ({mount, chart}) => {
})

test('horizontal bar chart', async ({mount, chart}) => {
  await mount('components2/BarChart2.svelte', {data: singleDim(), x: 'value', y: 'category'})
  await expect(chart.el).screenshot('horizontal-bar-chart')
})

test('stacked area chart', async ({mount, chart}) => {
  await mount('components2/AreaChart2.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', stack: 'category'})
  await expect(chart.el).screenshot('stacked-area-chart')
})

test('line chart timeseries', async ({mount, page, chart}) => {
  await mount('components2/LineChart2.svelte', {data: timeseries(), x: 'month', y: 'sales_usd0k'})
  await expect(page.locator('#component-test svg')).toBeVisible()
  let axisType = await chart.config(c => (Array.isArray(c.xAxis) ? c.xAxis[0] : c.xAxis).type)
  expect(axisType).toBe('time')
  await expect(chart.el).screenshot('line-chart-timeseries')
})

test('pie chart', async ({mount, chart}) => {
  await mount('components2/PieChart2.svelte', {data: singleDim(), category: 'category', value: 'value'})
  await expect(chart.el).screenshot('pie-chart')
})


test.skip('can provide a list of colors for different series', async ({mount, chart}) => {
})

test('bar chart y-axis uses integer ticks for integer data', async ({mount, chart}) => {
  // there was a regression where we'd try to render fractional ticks (0, 0.25, 0.5, 0.75, 1), but they got rounded
  let rows = [
    {category: 'A', count: 1},
    {category: 'B', count: 1},
    {category: 'C', count: 1},
  ] as any
  rows._evidenceColumnTypes = [
    {name: 'category', evidenceType: 'string'},
    {name: 'count', evidenceType: 'number'},
  ]
  await mount('components2/BarChart2.svelte', {data: {rows}, x: 'category', y: 'count'})
  let minInterval = await chart.config(c => (Array.isArray(c.yAxis) ? c.yAxis[0] : c.yAxis).minInterval)
  expect(minInterval).toBe(1)
  await expect(chart.el).screenshot('bar-chart-integer-ticks')
})

test.skip('line chart seriesLabelFmt formats date series names', async ({mount, chart}) => {
  await mount('components2/LineChart2.svelte', {data: timeseriesWithDateSeries(), x: 'category', y: 'sales', series: 'quarter'})
  let names = await chart.config(c => (c.series ?? []).map((s: any) => s.name).sort())
  expect(names).toEqual(['2021-01', '2021-04', '2021-07'])
  await expect(chart.el).screenshot('line-chart-series-label-fmt')
})

test.skip('numeric year xFmt=yyyy keeps year labels', async ({mount, chart}) => {
  await mount('components2/BarChart2.svelte', {data: yearlyCounts(), x: 'year', y: 'flights', xFmt: 'yyyy'})
  let axisLabel = await chart.config(c => {
    let xAxis = Array.isArray(c.xAxis) ? c.xAxis[0] : c.xAxis
    return xAxis.axisLabel.formatter(2000)
  })
  expect(axisLabel).toBe('2000')
  await expect(chart.el).screenshot('bar-chart-numeric-year-xfmt')
})

test('bar chart grouped labels', async ({mount, chart}) => {
  await mount('components2/BarChart2.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', group: 'category', labels: true})
  await expect(chart.el).screenshot('bar-chart-grouped-labels')
})

test('line chart markers and step', async ({mount, chart}) => {
})

test('line chart wraps wide x labels', async ({mount, chart}) => {
})

test('area chart stacked100', async ({mount, chart}) => {
  await mount('components2/AreaChart2.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', stack100: 'category'})
  await expect(chart.el).screenshot('area-chart-stacked100')
})

test('bar chart stacked100', async ({mount, chart}) => {
  await mount('components2/BarChart2.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', stack100: 'category'})
  await expect(chart.el).screenshot('bar-chart-stacked100')
})

test('area chart supports stepped markers and hidden line', async ({mount, chart}) => {
  await expect(chart.el).screenshot('area-chart-stepped-markers-no-line')
})

test('bar chart applies secondary axis assignment', async ({mount, chart}) => {
  let data = timeseries() as any
  data.rows = data.rows.map((r: any) => ({...r, profit_usd0k: r.sales_usd0k * 0.15}))
  await mount('components2/BarChart2.svelte', {data, x: 'month', y: 'sales_usd0k', y2: 'profit_usd0k'})
  await expect(chart.el).screenshot('bar-chart-secondary-axis-line')
})

test('dev echarts2 gallery renders without runtime errors', async ({mount, page}) => {
  await page.setViewportSize({width: 1200, height: 1400})
  await mount('internal/DevECharts2Gallery.svelte', {})

  await expect(page.locator('.echarts2-chart')).toHaveCount(14)
  await expect(page.locator('#component-test')).screenshot('echarts2-gallery')
}, 30_000)
