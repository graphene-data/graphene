// Tests that various echarts render as expected.
// When writing these tests, prefer just using a screenshot, and avoid adding assertions that check things already visible in the screenshot.

import {scalarType} from '../../lang/types.ts'
import {expect, test} from './fixtures.ts'
import {expectConsoleError} from './logWatcher.ts'
import {categoricalSeries, denseTimeseries, ratioTimeseries, singleDim, sparseGroupedMonthRows, timeseries, timeseriesGrouped, timeseriesWithDateSeries, yearlyCounts} from './testData.ts'

function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function timeseriesWithMultipleY() {
  let data = timeseries() as any
  let nextRandom = seededRandom(202604)
  data.rows = data.rows.map((row: any) => {
    let jitter = (nextRandom() - 0.5) * 0.06
    return {
      ...row,
      profit_usd0k: row.sales_usd0k * (0.22 + jitter),
      cost_usd0k: row.sales_usd0k * (0.68 - jitter),
    }
  })
  data.fields.push({name: 'profit_usd0k', type: scalarType('number'), metadata: {units: 'usd'}})
  data.fields.push({name: 'cost_usd0k', type: scalarType('number'), metadata: {units: 'usd'}})
  return data
}

test.beforeEach(async ({sharedPage}) => {
  await sharedPage.setViewportSize({width: 680, height: 400})
})

test('echarts query error state', async ({mount, chart}) => {
  expectConsoleError('Failed to load resource')
  await mount('components/ECharts.svelte', {
    config: {series: {type: 'bar', encode: {x: 'origin', y: 'explode'}}},
    data: 'from flights select origin, sqrt(dep_delay) as explode',
  })
  await expect(chart.el).screenshot('echarts-query-error-state')
})

test('echarts chart configuration error state', async ({mount, chart}) => {
  await mount('components/ECharts.svelte', {
    config: null as any,
    data: 'from flights select carrier limit 5',
  })
  await expect(chart.el.getByRole('alert')).toBeVisible()
  await expect(chart.el).screenshot('echarts-chart-config-error-state')
})

test('echarts expands encode.splitBy', async ({mount, chart}) => {
  await mount('components/ECharts.svelte', {
    data: timeseriesGrouped(),
    config: {
      title: {text: 'Monthly Sales by Category (direct ECharts)'},
      legend: {show: false},
      xAxis: {show: false},
      yAxis: {show: false},
      series: {type: 'bar', stack: 'bar-stack', encode: {x: 'month', y: 'sales_usd0k', splitBy: 'category'}},
    },
  })
  await expect(chart.el).screenshot('echarts-stack')
})

test('echarts supports splitBy=[group,stack] for grouped+stacked bars', async ({mount, chart}) => {
  let rows = [
    {month: '2024-01-01', region: 'NA', channel: 'Direct', revenue: 40},
    {month: '2024-01-01', region: 'NA', channel: 'Partner', revenue: 25},
    {month: '2024-01-01', region: 'EU', channel: 'Direct', revenue: 30},
    {month: '2024-01-01', region: 'EU', channel: 'Partner', revenue: 18},
    {month: '2024-02-01', region: 'NA', channel: 'Direct', revenue: 38},
    {month: '2024-02-01', region: 'NA', channel: 'Partner', revenue: 20},
    {month: '2024-02-01', region: 'EU', channel: 'Direct', revenue: 35},
    {month: '2024-02-01', region: 'EU', channel: 'Partner', revenue: 22},
  ]
  let fields = [
    {name: 'month', type: scalarType('date'), metadata: {timeGrain: 'month'}},
    {name: 'region', type: scalarType('string')},
    {name: 'channel', type: scalarType('string')},
    {name: 'revenue', type: scalarType('number'), metadata: {units: 'usd'}},
  ]

  await mount('components/ECharts.svelte', {
    data: {rows, fields},
    config: {
      title: {text: 'Grouped + Stacked (splitBy list)'},
      series: {type: 'bar', encode: {x: 'month', y: 'revenue', splitBy: ['region', 'channel']}},
    },
  })
  await expect(chart.el).screenshot('echarts-splitby-group-stack')
})

test('bar chart', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {data: timeseries(), x: 'month', y: 'sales_usd0k', title: 'Monthly Sales'})
  await expect(chart.el).screenshot('bar-chart')
})

test('bar chart supports multiple y fields', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {data: timeseriesWithMultipleY(), x: 'month', y: 'sales_usd0k,profit_usd0k,cost_usd0k'})
  await expect(chart.el).screenshot('bar-chart-multiple-y')
})

test('bar chart formats very small values on y axis', async ({mount, chart}) => {
  let data = singleDim()
  data.rows = data.rows.map(row => ({...row, value: row.value / 1e12}))
  data.fields[1].metadata = {}

  await mount('components/BarChart.svelte', {data, x: 'category', y: 'value', title: 'Very Small Values'})
  await expect(chart.el).screenshot('bar-chart-very-small-values')
})

test('bar chart with just 0,1 has sensible y axis ticks', async ({mount, chart}) => {
  let rows = [
    {category: 'A', count: 1},
    {category: 'B', count: 0},
    {category: 'C', count: 1},
  ]
  let fields = [
    {name: 'category', type: scalarType('string')},
    {name: 'count', type: scalarType('number'), metadata: {units: 'count'}},
  ]
  await mount('components/BarChart.svelte', {data: {rows, fields}, x: 'category', y: 'count'})
  await expect(chart.el).screenshot('bar-chart-0-to-1')
})

test('bar chart grouped + stacked fills missing points and sorts x', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {data: sparseGroupedMonthRows(), x: 'month', y: 'value', splitBy: 'metric', arrange: 'stack', title: 'Grouped Stacked Missing + Sort'})
  await expect(chart.el).screenshot('bar-chart-stacked-missing-sort')
})

test('horizontal bar chart', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {data: singleDim(), x: 'value', y: 'category'})
  await expect(chart.el).screenshot('horizontal-bar-chart')
})

test('horizontal bar chart auto-expands height for many categories', async ({mount, chart}) => {
  let rows = Array.from({length: 14}, (_, index) => ({category: `Category ${index + 1}`, value: (index + 1) * 10}))
  let fields = [
    {name: 'category', type: scalarType('string')},
    {name: 'value', type: scalarType('number'), metadata: {units: 'count'}},
  ]

  await mount('components/BarChart.svelte', {data: {rows, fields}, x: 'value', y: 'category'})
  await expect(chart.el).screenshot('horizontal-bar-chart-auto-height')
})

test('horizontal bar chart supports multiple x fields', async ({mount, chart}) => {
  let rows = [
    {category: 'A', current: 20, previous: 12},
    {category: 'B', current: 14, previous: 18},
    {category: 'C', current: 11, previous: 8},
  ]
  let fields = [
    {name: 'category', type: scalarType('string')},
    {name: 'current', type: scalarType('number'), metadata: {units: 'count'}},
    {name: 'previous', type: scalarType('number'), metadata: {units: 'count'}},
  ]

  await mount('components/BarChart.svelte', {data: {rows, fields}, x: 'current,previous', y: 'category'})
  await expect(chart.el).screenshot('horizontal-bar-chart-multi-x')
})

test('stacked area chart', async ({mount, chart}) => {
  await mount('components/AreaChart.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', splitBy: 'category', arrange: 'stack'})
  await expect(chart.el).screenshot('area-chart-stacked')
})

test('area chart supports multiple y fields', async ({mount, chart}) => {
  await mount('components/AreaChart.svelte', {data: timeseriesWithMultipleY(), x: 'month', y: 'sales_usd0k,profit_usd0k,cost_usd0k'})
  await expect(chart.el).screenshot('area-chart-multiple-y')
})

test('line chart timeseries', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {data: timeseries(), x: 'month', y: 'sales_usd0k'})
  await expect(chart.el).screenshot('line-chart-timeseries')
})

test('line chart supports multiple y fields', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {data: timeseriesWithMultipleY(), x: 'month', y: 'sales_usd0k,profit_usd0k,cost_usd0k'})
  await expect(chart.el).screenshot('line-chart-multiple-y')
})

test('line charts hide markers on timeseries', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {data: denseTimeseries(), x: 'ts', y: 'value', title: 'Dense Time Axis'})
  await expect(chart.el).screenshot('line-chart-timeseries-hide-markers')
})

test('line chart uses ratio metadata for axis and tooltip percentage formatting', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {data: ratioTimeseries(), x: 'month', y: 'conversion_rate', title: 'Conversion Rate'})
  await expect(chart.el).screenshot('line-chart-ratio-metadata-percent-axis')
})

test('time tooltip uses readable timeGrain formatting', async ({mount, chart, sharedPage}) => {
  let rows = [
    {period: '2023-01-01', value: 10},
    {period: '2023-02-01', value: 12},
    {period: '2023-03-01', value: 11},
    {period: '2023-04-01', value: 14},
  ]

  let fields = [
    {name: 'period', type: scalarType('date'), metadata: {timeGrain: 'month'}},
    {name: 'value', type: scalarType('number')},
  ]

  await mount('components/LineChart.svelte', {data: {rows, fields}, x: 'period', y: 'value', title: 'Month Grain'})
  await sharedPage.evaluate(async () => {
    let domNode = document.querySelector('#component-test .echarts') as HTMLElement | null
    let chart = domNode ? window.$GRAPHENE.getChart(domNode) : null
    chart?.dispatchAction({type: 'showTip', seriesIndex: 0, dataIndex: 3})
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  })

  await expect(chart.el).screenshot('line-chart-tooltip-time-month-grain')
})

test('line chart tooltip formats calculated non-whole numbers', async ({mount, chart, sharedPage}) => {
  let rows = [
    {month: 'Jan', avg_delay: 10 / 3},
    {month: 'Feb', avg_delay: 14 / 3},
    {month: 'Mar', avg_delay: 22 / 3},
  ]
  let fields = [
    {name: 'month', type: scalarType('string')},
    {name: 'avg_delay', type: scalarType('number')},
  ]

  await mount('components/LineChart.svelte', {data: {rows, fields}, x: 'month', y: 'avg_delay', title: 'Average Delay'})

  await sharedPage.evaluate(() => {
    let domNode = document.querySelector('#component-test .echarts') as HTMLElement | null
    let chart = domNode ? window.$GRAPHENE.getChart(domNode) : null
    chart?.dispatchAction({type: 'showTip', seriesIndex: 0, dataIndex: 0})
  })

  await expect(chart.el).screenshot('line-chart-tooltip-calculated-non-whole')
})

test('hour_of_day ordinal axis labels and tooltip formatting', async ({mount, chart, sharedPage}) => {
  let rows = [
    {hour_of_day: 23, flights: 8},
    {hour_of_day: 0, flights: 18},
    {hour_of_day: 13, flights: 14},
    {hour_of_day: 6, flights: 11},
  ]
  let fields = [
    {name: 'hour_of_day', type: scalarType('number'), metadata: {timeOrdinal: 'hour_of_day'}},
    {name: 'flights', type: scalarType('number'), metadata: {units: 'count'}},
  ]

  await mount('components/LineChart.svelte', {data: {rows, fields}, x: 'hour_of_day', y: 'flights', title: 'Hour Ordinal'})
  await sharedPage.evaluate(() => {
    let charts = window[Symbol.for('__evidence-chart-window-debug__') as any]
    let chart = charts && (Object.values(charts)[0] as any)
    chart?.dispatchAction({type: 'showTip', seriesIndex: 0, dataIndex: 2})
  })

  await expect(chart.el).screenshot('line-chart-hour-of-day-ordinal-tooltip')
})

test('day_of_week ordinal axis labels and tooltip formatting', async ({mount, chart, sharedPage}) => {
  let rows = [
    {day_of_week: 1, flights: 35},
    {day_of_week: 2, flights: 12},
    {day_of_week: 3, flights: 21},
    {day_of_week: 4, flights: 17},
    {day_of_week: 5, flights: 33},
    {day_of_week: 6, flights: 25},
    {day_of_week: 7, flights: 19},
  ]
  let fields = [
    {name: 'day_of_week', type: scalarType('number'), metadata: {timeOrdinal: 'dow_1s'}},
    {name: 'flights', type: scalarType('number'), metadata: {units: 'count'}},
  ]

  await mount('components/BarChart.svelte', {data: {rows, fields}, x: 'day_of_week', y: 'flights', title: 'Weekday Ordinal'})
  await sharedPage.evaluate(() => {
    let charts = window[Symbol.for('__evidence-chart-window-debug__') as any]
    let chart = charts && (Object.values(charts)[0] as any)
    chart?.dispatchAction({type: 'showTip', seriesIndex: 0, dataIndex: 0})
  })

  await expect(chart.el).screenshot('bar-chart-day-of-week-ordinal-tooltip')
})

test('month_of_year ordinal axis labels and tooltip formatting', async ({mount, chart, sharedPage}) => {
  let rows = [
    {month_of_year: 11, revenue: 85},
    {month_of_year: 2, revenue: 64},
    {month_of_year: 7, revenue: 72},
    {month_of_year: 1, revenue: 58},
    {month_of_year: 12, revenue: 91},
    {month_of_year: 4, revenue: 67},
  ]
  let fields = [
    {name: 'month_of_year', type: scalarType('number'), metadata: {timeOrdinal: 'month_of_year'}},
    {name: 'revenue', type: scalarType('number'), metadata: {units: 'usd'}},
  ]

  await mount('components/LineChart.svelte', {data: {rows, fields}, x: 'month_of_year', y: 'revenue', title: 'Month Ordinal'})
  await sharedPage.evaluate(() => {
    let charts = window[Symbol.for('__evidence-chart-window-debug__') as any]
    let chart = charts && (Object.values(charts)[0] as any)
    chart?.dispatchAction({type: 'showTip', seriesIndex: 0, dataIndex: 2})
  })

  await expect(chart.el).screenshot('line-chart-month-of-year-ordinal-tooltip')
})

test('quarter_of_year ordinal axis labels and tooltip formatting', async ({mount, chart, sharedPage}) => {
  let rows = [
    {quarter_of_year: 4, value: 91},
    {quarter_of_year: 1, value: 58},
    {quarter_of_year: 3, value: 72},
    {quarter_of_year: 2, value: 67},
  ]
  let fields = [
    {name: 'quarter_of_year', type: scalarType('number'), metadata: {timeOrdinal: 'quarter_of_year'}},
    {name: 'value', type: scalarType('number'), metadata: {units: 'count'}},
  ]

  await mount('components/BarChart.svelte', {data: {rows, fields}, x: 'quarter_of_year', y: 'value', title: 'Quarter Ordinal'})
  await sharedPage.evaluate(() => {
    let charts = window[Symbol.for('__evidence-chart-window-debug__') as any]
    let chart = charts && (Object.values(charts)[0] as any)
    chart?.dispatchAction({type: 'showTip', seriesIndex: 0, dataIndex: 1})
  })

  await expect(chart.el).screenshot('bar-chart-quarter-of-year-ordinal-tooltip')
})

test('line chart hides markers at 30 categorical points', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {data: categoricalSeries(30), x: 'category', y: 'value', title: 'Categorical 30'})
  await expect(chart.el).screenshot('line-chart-categorical-markers-over-threshold')
})

test('pie chart', async ({mount, chart, sharedPage}) => {
  await mount('components/PieChart.svelte', {data: singleDim(), category: 'category', value: 'value'})
  await expect(chart.el).screenshot('pie-chart')

  await sharedPage.evaluate(async () => {
    let domNode = document.querySelector('#component-test .echarts') as HTMLElement | null
    let chart = domNode ? window.$GRAPHENE.getChart(domNode) : null
    chart?.dispatchAction({type: 'showTip', seriesIndex: 0, dataIndex: 0})
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  })

  await expect(chart.el).screenshot('pie-chart-tooltip')
})

test.skip('can provide a list of colors for different series', async () => {})

test.skip('line chart seriesLabelFmt formats date series names', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {data: timeseriesWithDateSeries(), x: 'category', y: 'sales', splitBy: 'quarter'})
  let names = await chart.config(c => (c.series ?? []).map((s: any) => s.name).sort())
  expect(names).toEqual(['2021-01', '2021-04', '2021-07'])
  await expect(chart.el).screenshot('line-chart-series-label-fmt')
})

test.skip('numeric year xFmt=yyyy keeps year labels', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {data: yearlyCounts(), x: 'year', y: 'flights', xFmt: 'yyyy'})
  let axisLabel = await chart.config(c => {
    let xAxis = Array.isArray(c.xAxis) ? c.xAxis[0] : c.xAxis
    return xAxis.axisLabel.formatter(2000)
  })
  expect(axisLabel).toBe('2000')
  await expect(chart.el).screenshot('bar-chart-numeric-year-xfmt')
})

test('bar chart grouped labels', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', splitBy: 'category', arrange: 'group', label: true})
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

  let fields = [
    {name: 'segment', type: scalarType('string')},
    {name: 'metric', type: scalarType('string')},
    {name: 'value', type: scalarType('number'), metadata: {units: 'count'}},
  ]

  await mount('components/BarChart.svelte', {data: {rows, fields}, x: 'segment', y: 'value', splitBy: 'metric', arrange: 'stack', title: 'Stacked Category Sort'})
  await expect(chart.el).screenshot('bar-chart-categorical-stacked-sort-total-desc')
})

test('bar chart explicit sort orders categories by another column', async ({mount, chart}) => {
  let rows = [
    {segment: 'SMB', metric: 'New', value: 8, sort_rank: 2},
    {segment: 'Enterprise', metric: 'New', value: 35, sort_rank: 3},
    {segment: 'Mid Market', metric: 'New', value: 16, sort_rank: 1},
    {segment: 'SMB', metric: 'Expansion', value: 12, sort_rank: 2},
    {segment: 'Enterprise', metric: 'Expansion', value: 30, sort_rank: 3},
    {segment: 'Mid Market', metric: 'Expansion', value: 18, sort_rank: 1},
  ]

  let fields = [
    {name: 'segment', type: scalarType('string')},
    {name: 'metric', type: scalarType('string')},
    {name: 'value', type: scalarType('number'), metadata: {units: 'count'}},
    {name: 'sort_rank', type: scalarType('number')},
  ]

  await mount('components/BarChart.svelte', {data: {rows, fields}, x: 'segment', y: 'value', splitBy: 'metric', arrange: 'stack', sort: 'sort_rank asc', title: 'Explicit Sort'})
  await expect(chart.el).screenshot('bar-chart-explicit-sort-column')
})

test('line chart sorts time axis, and shows gap for missing points', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {data: sparseGroupedMonthRows(), x: 'month', y: 'value', splitBy: 'metric', title: 'Line Missing + Sort'})
  await expect(chart.el).screenshot('line-chart-grouped-missing-sort')
})

test('stacked area uses 0 for missing points', async ({mount, chart}) => {
  await mount('components/AreaChart.svelte', {data: sparseGroupedMonthRows(), x: 'month', y: 'value', splitBy: 'metric', arrange: 'stack', title: 'Area Missing + Sort'})
  await expect(chart.el).screenshot('area-chart-grouped-missing-sort')
})

test.skip('unstacked area split-by was removed in the arrange API cutover', async () => {})

test('area chart stacked100', async ({mount, chart}) => {
  await mount('components/AreaChart.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', splitBy: 'category', arrange: 'stack100'})
  await expect(chart.el).screenshot('area-chart-stacked100')
})

test('bar chart stacked100', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {data: timeseriesGrouped(), x: 'month', y: 'sales_usd0k', splitBy: 'category', arrange: 'stack100'})
  await expect(chart.el).screenshot('bar-chart-stacked100')
})

test.skip('area chart supports stepped markers and hidden line', async ({chart}) => {
  await expect(chart.el).screenshot('area-chart-stepped-markers-no-line')
})

test('bar chart applies secondary axis assignment', async ({mount, chart}) => {
  let data = timeseries() as any
  let nextRandom = seededRandom(202503)
  data.rows = data.rows.map((r: any) => {
    let delta = (nextRandom() - 0.5) * 0.08
    return {...r, profit_usd0k: r.sales_usd0k * (0.15 + delta)}
  })
  data.fields.push({name: 'profit_usd0k', type: scalarType('number'), metadata: {units: 'usd'}})
  await mount('components/BarChart.svelte', {data, x: 'month', y: 'sales_usd0k', y2: 'profit_usd0k'})
  await expect(chart.el).screenshot('bar-chart-secondary-axis-line')
})
