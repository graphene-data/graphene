import {expect, test} from './fixtures.ts'
import {singleDim, sparseGroupedMonthRows, timeseries, timeseriesGrouped, timeseriesWithDateSeries, yearlyCounts} from './testData.ts'

function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

test.beforeEach(async ({page}) => {
  await page.setViewportSize({width: 680, height: 400})
})

test('bar chart', async ({mount, chart}) => {
  await mount('components2/BarChart2.svelte', {data: timeseries(), x: 'month', y: 'sales_usd0k', title: 'Monthly Sales'})
  await expect(chart.el).screenshot('bar-chart')
})

test('bar chart formats very small values on y axis', async ({mount, chart}) => {
  let data = singleDim()
  data.rows = data.rows.map(row => ({...row, value: row.value / 1e12}))

  await mount('components2/BarChart2.svelte', {data, x: 'category', y: 'value', title: 'Very Small Values'})
  await expect(chart.el).screenshot('bar-chart-very-small-values')
})

test('bar chart with just 0,1 has sensible y axis ticks', async ({mount, chart}) => {
  let rows = [{category: 'A', count: 1}, {category: 'B', count: 0}, {category: 'C', count: 1}]
  await mount('components2/BarChart2.svelte', {data: {rows}, x: 'category', y: 'count'})
  await expect(chart.el).screenshot('bar-chart-0-to-1')
})

test('bar chart grouped + stacked fills missing points and sorts x', async ({mount, chart}) => {
  await mount('components2/BarChart2.svelte', {data: sparseGroupedMonthRows(), x: 'month', y: 'value', stack: 'metric', title: 'Grouped Stacked Missing + Sort'})
  await expect(chart.el).screenshot('bar-chart-stacked-missing-sort')
})

test('horizontal bar chart', async ({mount, chart}) => {
  await mount('components2/BarChart2.svelte', {data: singleDim(), x: 'value', y: 'category'})
  await expect(chart.el).screenshot('horizontal-bar-chart')
})

test('stacked area chart', async ({mount, chart}) => {
  await mount('components2/AreaChart2.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', stack: 'category'})
  await expect(chart.el).screenshot('area-chart-stacked')
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


test.skip('can provide a list of colors for different series', async () => {
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
  await mount('components2/BarChart2.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', group: 'category', label: true})
  await expect(chart.el).screenshot('bar-chart-grouped-labels')
})

test('categorical stacked bar charts sort by total value descending', async ({mount, chart}) => {
  let rows = [
    {segment: 'SMB', metric: 'New', value: 8},
    {segment: 'Enterprise', metric: 'New', value: 35},
    {segment: 'Mid Market', metric: 'New', value: 16},
    {segment: 'SMB', metric: 'Expansion', value: 12},
    {segment: 'Enterprise', metric: 'Expansion', value: 30},
    {segment: 'Mid Market', metric: 'Expansion', value: 18},
  ]

  await mount('components2/BarChart2.svelte', {data: {rows}, x: 'segment', y: 'value', stack: 'metric', title: 'Stacked Category Sort'})
  await expect(chart.el).screenshot('bar-chart-categorical-stacked-sort-total-desc')
})

test('line chart sorts time axis, and shows gap for missing points', async ({mount, chart}) => {
  await mount('components2/LineChart2.svelte', {data: sparseGroupedMonthRows(), x: 'month', y: 'value', series: 'metric', title: 'Line Missing + Sort'})
  await expect(chart.el).screenshot('line-chart-grouped-missing-sort')
})

test('stacked area uses 0 for missing points', async ({mount, chart}) => {
  await mount('components2/AreaChart2.svelte', {data: sparseGroupedMonthRows(), x: 'month', y: 'value', stack: 'metric', title: 'Area Missing + Sort'})
  await expect(chart.el).screenshot('area-chart-grouped-missing-sort')
})

test('unstacked area leaves gaps for missing points', async ({mount, chart}) => {
  await mount('components2/AreaChart2.svelte', {data: sparseGroupedMonthRows(), x: 'month', y: 'value', group: 'metric', title: 'Area Missing + Gaps'})
  await expect(chart.el).screenshot('area-chart-grouped-missing-gap')
})

test('area chart stacked100', async ({mount, chart}) => {
  await mount('components2/AreaChart2.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', stack100: 'category'})
  await expect(chart.el).screenshot('area-chart-stacked100')
})

test('bar chart stacked100', async ({mount, chart}) => {
  await mount('components2/BarChart2.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', stack100: 'category'})
  await expect(chart.el).screenshot('bar-chart-stacked100')
})

test('area chart supports stepped markers and hidden line', async ({chart}) => {
  await expect(chart.el).screenshot('area-chart-stepped-markers-no-line')
})

test('bar chart applies secondary axis assignment', async ({mount, chart}) => {
  let data = timeseries() as any
  let nextRandom = seededRandom(202503)
  data.rows = data.rows.map((r: any) => {
    let delta = (nextRandom() - 0.5) * 0.08
    return {...r, profit_usd0k: r.sales_usd0k * (0.15 + delta)}
  })
  data.fields.push({ name: 'profit_usd0k', type: 'number', metadata: { units: 'usd' } })
  await mount('components2/BarChart2.svelte', {data, x: 'month', y: 'sales_usd0k', y2: 'profit_usd0k'})
  await expect(chart.el).screenshot('bar-chart-secondary-axis-line')
})

test('dev echarts2 gallery renders without runtime errors', async ({mount, page}) => {
  await page.setViewportSize({width: 1200, height: 1400})
  await mount('internal/DevECharts2Gallery.svelte', {})

  await expect(page.locator('.echarts2-chart')).toHaveCount(14)
  await expect(page.locator('#component-test')).screenshot('echarts2-gallery')
}, 30_000)
