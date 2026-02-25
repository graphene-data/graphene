import {expect, test} from './fixtures.ts'
import {expectConsoleError} from './logWatcher.ts'
import {singleDim, timeseries, timeseriesGrouped, timeseriesWithDateSeries} from './testData.ts'

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

test('stacked100 keeps time axis when x values are dates', async ({mount, chart}) => {
  await mount('components/AreaChart.svelte', {
    data: timeseriesGrouped(),
    x: 'month',
    y: 'sales_usd0k',
    series: 'category',
    type: 'stacked100',
  })
  let axisType = await chart.config((c) => (Array.isArray(c.xAxis) ? c.xAxis[0] : c.xAxis).type)
  expect(axisType).toBe('time')
  await expect(chart.el).screenshot('stacked100-date-axis-order')
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

test('bar chart y-axis uses integer ticks for integer data', async ({mount, chart}) => {
  // there was a regression where we'd try to render fractional ticks (0, 0.25, 0.5, 0.75, 1), but they got rounded
  let rows = [{category: 'A', count: 1}, {category: 'B', count: 1}, {category: 'C', count: 1}] as any
  rows._evidenceColumnTypes = [{name: 'category', evidenceType: 'string'}, {name: 'count', evidenceType: 'number'}]
  await mount('components/BarChart.svelte', {data: {rows}, x: 'category', y: 'count'})
  let minInterval = await chart.config(c => (Array.isArray(c.yAxis) ? c.yAxis[0] : c.yAxis).minInterval)
  expect(minInterval).toBe(1)
  await expect(chart.el).screenshot('bar-chart-integer-ticks')
})

test('line chart dual axis shows both y-axis labels', async ({mount, chart}) => {
  let data = timeseries() as any
  let rows = data.rows.map((r: any) => ({...r, profit_usd0k: r.sales_usd0k * 0.1}))
  rows._evidenceColumnTypes = [
    ...data.rows._evidenceColumnTypes,
    {name: 'profit_usd0k', evidenceType: 'number'},
  ]
  data.rows = rows

  await mount('components/LineChart.svelte', {data, x: 'month', y: 'sales_usd0k', y2: 'profit_usd0k'})

  // Verify both y-axes are visible and have labels enabled
  let yAxisConfig = await chart.config((c) => (c.yAxis ?? []).map((a: any) => ({
    show: a.show,
    labelShow: a.axisLabel?.show,
    // Axis label color must be a string (not a store object) for ECharts to render
    labelColorType: typeof a.axisLabel?.color,
  })))
  expect(yAxisConfig[0]).toMatchObject({show: true, labelShow: true})
  expect(yAxisConfig[1]).toMatchObject({show: true, labelShow: true})
  // Ensure colors are properly resolved strings, not store objects
  for (let axis of yAxisConfig) {
    expect(axis.labelColorType).not.toBe('object')
  }
  await expect(chart.el).screenshot('line-chart-dual-axis')
})

test('line chart seriesLabelFmt formats date series names', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {
    data: timeseriesWithDateSeries(),
    x: 'category',
    y: 'sales',
    series: 'quarter',
    seriesLabelFmt: 'yyyy-mm',
  })
  let names = await chart.config((c) => (c.series ?? []).map((s: any) => s.name).sort())
  expect(names).toEqual(['2021-01', '2021-04', '2021-07'])
  await expect(chart.el).screenshot('line-chart-series-label-fmt')
})

test('numeric year xFmt=yyyy keeps year labels', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {
    data: yearlyCounts(),
    x: 'year',
    y: 'flights',
    xFmt: 'yyyy',
  })
  let axisLabel = await chart.config((c) => {
    let xAxis = Array.isArray(c.xAxis) ? c.xAxis[0] : c.xAxis
    return xAxis.axisLabel.formatter(2000)
  })
  expect(axisLabel).toBe('2000')
  await expect(chart.el).screenshot('bar-chart-numeric-year-xfmt')
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

test('bar chart grouped labels', async ({mount, chart}) => {
  await mount('components/BarChart.svelte', {
    data: timeseriesGrouped(),
    x: 'month',
    y: 'sales_usd0k',
    series: 'category',
    type: 'grouped',
    labels: true,
    showAllLabels: true,
    labelPosition: 'above',
  })

  let config = await chart.config(c => ({
    seriesCount: (c.series ?? []).length,
    labelShows: (c.series ?? []).map((s: any) => s.label?.show),
    stacks: (c.series ?? []).map((s: any) => s.stack),
  }))
  expect(config?.seriesCount).toBe(4)
  expect(config?.labelShows.every(Boolean)).toBe(true)
  expect(config?.stacks.every((stack: any) => !stack)).toBe(true)
  await expect(chart.el).screenshot('bar-chart-grouped-labels')
})

test('bar chart invalid horizontal timeseries renders error state', async ({mount, page}) => {
  expectConsoleError('Error in Bar Chart')

  await mount('components/BarChart.svelte', {
    data: timeseries(),
    x: 'month',
    y: 'sales_usd0k',
    swapXY: true,
    title: 'Invalid Horizontal Timeseries',
  })

  await expect(page.getByRole('alert')).toContainText('Horizontal charts do not support a value or time-based x-axis')
  await expect(page.locator('#component-test')).screenshot('bar-chart-horizontal-timeseries-error')
})

test('line chart markers and step', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {
    data: timeseries(),
    x: 'month',
    y: 'sales_usd0k',
    markers: true,
    markerShape: 'diamond',
    markerSize: 10,
    step: true,
    stepPosition: 'middle',
    handleMissing: 'connect',
    lineType: 'dashed',
  })

  let lineConfig = await chart.config((c) => c.series?.[0])
  expect(lineConfig?.step).toBe('middle')
  expect(lineConfig?.connectNulls).toBe(true)
  expect(lineConfig?.lineStyle?.type).toBe('dashed')
  expect(lineConfig?.symbol).toBe('diamond')
  await expect(chart.el).screenshot('line-chart-markers-step')
})

test('line chart wraps x labels when requested', async ({mount, chart, page}) => {
  let data = longCategorySeriesData()
  await mount('components/LineChart.svelte', {
    data,
    x: 'label',
    y: 'value',
    xType: 'category',
    showAllXAxisLabels: true,
    xLabelWrap: true,
  })

  await page.waitForTimeout(150)
  let axisLabel = await chart.config((c) => (Array.isArray(c.xAxis) ? c.xAxis[0] : c.xAxis).axisLabel)
  let axisType = await chart.config((c) => (Array.isArray(c.xAxis) ? c.xAxis[0] : c.xAxis).type)
  expect(axisType).toBe('category')
  expect(axisLabel?.interval).toBe('auto')
  expect(axisLabel?.showMaxLabel).toBe(true)
  await expect(chart.el).screenshot('line-chart-wrapped-x-labels')
})

test('line chart applies axis controls and padding attributes', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {
    data: timeseries(),
    x: 'month',
    y: 'sales_usd0k',
    xGridlines: 'true',
    yGridlines: 'false',
    xTickMarks: 'true',
    yTickMarks: 'true',
    xBaseline: 'false',
    yBaseline: 'true',
    leftPadding: '14%',
    rightPadding: '9%',
  })

  let config = await chart.config((c) => ({
    xGridlines: (Array.isArray(c.xAxis) ? c.xAxis[0] : c.xAxis).splitLine?.show,
    yGridlines: (Array.isArray(c.yAxis) ? c.yAxis[0] : c.yAxis).splitLine?.show,
    xTickMarks: (Array.isArray(c.xAxis) ? c.xAxis[0] : c.xAxis).axisTick?.show,
    yTickMarks: (Array.isArray(c.yAxis) ? c.yAxis[0] : c.yAxis).axisTick?.show,
    xBaseline: (Array.isArray(c.xAxis) ? c.xAxis[0] : c.xAxis).axisLine?.show,
    yBaseline: (Array.isArray(c.yAxis) ? c.yAxis[0] : c.yAxis).axisLine?.show,
    gridLeft: c.grid?.[0]?.left,
    gridRight: c.grid?.[0]?.right,
  }))

  expect(config?.xGridlines).toBe(true)
  expect(config?.yGridlines).toBe(false)
  expect(config?.xTickMarks).toBe(true)
  expect(config?.yTickMarks).toBe(true)
  expect(config?.xBaseline).toBe(false)
  expect(config?.yBaseline).toBe(true)
  expect(config?.gridLeft).toBe('14%')
  expect(config?.gridRight).toBe('9%')
  await expect(chart.el).screenshot('line-chart-axis-controls')
})

test('area chart stacked100', async ({mount, chart}) => {
  await mount('components/AreaChart.svelte', {
    data: timeseriesGrouped(),
    x: 'month',
    y: 'sales_usd0k',
    series: 'category',
    type: 'stacked100',
  })

  let config = await chart.config((c) => ({
    yMax: (Array.isArray(c.yAxis) ? c.yAxis[0] : c.yAxis).max,
    stacks: (c.series ?? []).map((s: any) => s.stack),
  }))
  expect(config?.yMax).toBe(1)
  expect(config?.stacks.every((stack: any) => stack === 'area')).toBe(true)
  await expect(chart.el).screenshot('area-chart-stacked100')
})

test('area chart supports stepped markers and hidden line', async ({mount, chart}) => {
  await mount('components/AreaChart.svelte', {
    data: areaMissingData(),
    x: 'month',
    y: 'sales',
    xType: 'category',
    line: 'false',
    markers: 'true',
    markerShape: 'triangle',
    markerSize: 12,
    step: 'true',
    stepPosition: 'start',
    handleMissing: 'zero',
  })

  let config = await chart.config((c) => c.series?.[0])
  expect(config?.lineStyle?.width).toBe(0)
  expect(config?.symbol).toBe('triangle')
  expect(config?.symbolSize).toBe(12)
  expect(config?.step).toBe('start')
  expect(config?.connectNulls).toBe(false)
  await expect(chart.el).screenshot('area-chart-stepped-markers-no-line')
})

test('bar chart applies secondary axis colors and assignment', async ({mount, chart}) => {
  let data = timeseries() as any
  let rows = data.rows.map((r: any) => ({...r, profit_usd0k: r.sales_usd0k * 0.15}))
  rows._evidenceColumnTypes = [...data.rows._evidenceColumnTypes, {name: 'profit_usd0k', evidenceType: 'number'}]
  data.rows = rows

  await mount('components/BarChart.svelte', {
    data,
    x: 'month',
    y: 'sales_usd0k',
    y2: 'profit_usd0k',
    y2SeriesType: 'line',
    yAxisColor: 'tomato',
    y2AxisColor: 'steelblue',
  })

  let config = await chart.config((c) => ({
    seriesCount: c.series?.length,
    y2AxisIndex: c.series?.[1]?.yAxisIndex,
    primaryAxisColor: c.yAxis?.[0]?.axisLabel?.color,
    secondaryAxisColor: c.yAxis?.[1]?.axisLabel?.color,
  }))
  expect(config?.seriesCount).toBe(2)
  expect(config?.y2AxisIndex).toBe(1)
  expect(config?.primaryAxisColor).toBe('tomato')
  expect(config?.secondaryAxisColor).toBe('steelblue')
  await expect(chart.el).screenshot('bar-chart-secondary-axis-line')
})

test('line chart applies series options to each rendered series', async ({mount, chart}) => {
  await mount('components/LineChart.svelte', {
    data: timeseriesGrouped(),
    x: 'month',
    y: 'sales_usd0k',
    series: 'category',
    seriesOptions: {smooth: true},
  })

  let smoothFlags = await chart.config((c) => (c.series ?? []).map((entry: any) => entry.smooth))
  expect(smoothFlags?.length).toBeGreaterThan(1)
  expect(smoothFlags?.every(Boolean)).toBe(true)
  await expect(chart.el).screenshot('line-chart-series-options-smooth')
})

test('pie chart with series options', async ({mount, chart}) => {
  await mount('components/PieChart.svelte', {
    data: singleDim(),
    category: 'category',
    value: 'value',
    title: 'Category Share',
    subtitle: 'Sales',
    seriesOptions: {label: {show: true, formatter: '{b}'}},
    echartsOptions: {legend: {show: true, bottom: 0}},
  })

  let config = await chart.config((c) => ({
    legendShow: c.legend?.[0]?.show,
    pieLabelShow: c.series?.[0]?.label?.show,
    pieLabelFormatter: c.series?.[0]?.label?.formatter,
  }))
  expect(config?.legendShow).toBe(true)
  expect(config?.pieLabelShow).toBe(true)
  expect(config?.pieLabelFormatter).toBe('{b}')
  await expect(chart.el).screenshot('pie-chart-labeled')
})

test('big value percent formatting', async ({mount, page}) => {
  await mount('components/BigValue.svelte', {
    data: percentData(),
    value: 'ratio',
    fmt: 'pct1',
    title: 'Conversion',
    subtitle: 'This month',
  })

  await expect(page.getByText('Conversion')).toBeVisible()
  await expect(page.getByText('This month')).toBeVisible()
  await expect(page.getByText('31.4%')).toBeVisible()
  await expect(page.locator('#component-test')).screenshot('big-value-percent')
})

test('big value null renders em dash', async ({mount, page}) => {
  await mount('components/BigValue.svelte', {
    data: nullValueData(),
    value: 'value',
    title: 'Nullable Metric',
  })

  await expect(page.getByText('Nullable Metric')).toBeVisible()
  await expect(page.getByText('—')).toBeVisible()
  await expect(page.locator('#component-test')).screenshot('big-value-null')
})

test('echarts primitive honors dimensions and metadata attributes', async ({mount, page}) => {
  await mount('components/ECharts.svelte', {
    config: {
      xAxis: {type: 'category', data: ['A', 'B', 'C']},
      yAxis: {type: 'value'},
      series: [{type: 'bar', data: [3, 2, 5]}],
    },
    data: [],
    height: 180,
    width: 320,
    chartTitle: 'Standalone ECharts',
    queryID: 'standalone-echarts',
  })

  let chartRoot = page.locator('.echarts-chart')
  await expect(chartRoot).toHaveAttribute('data-chart-title', 'Standalone ECharts')
  await expect(chartRoot).toHaveAttribute('data-query-id', 'standalone-echarts')
  let style = await chartRoot.getAttribute('style')
  expect(style).toContain('height: 180px')
  expect(style).toContain('width: 320px')
  await expect(page.locator('#component-test')).screenshot('echarts-standalone')
})

test('echarts primitive supports svg renderer', async ({mount, page}) => {
  await mount('components/ECharts.svelte', {
    config: {
      xAxis: {type: 'category', data: ['A', 'B', 'C']},
      yAxis: {type: 'value'},
      series: [{type: 'line', data: [1, 3, 2]}],
    },
    data: [],
    renderer: 'svg',
    chartTitle: 'SVG Renderer ECharts',
    queryID: 'svg-renderer-echarts',
  })

  let chartRoot = page.locator('.echarts-chart')
  await expect(chartRoot).toHaveAttribute('data-chart-title', 'SVG Renderer ECharts')
  await expect(chartRoot.locator('svg')).toBeVisible()
  await expect(page.locator('#component-test')).screenshot('echarts-svg-renderer')
})

function longCategorySeriesData () {
  let rows = [
    {label: 'A very long category label for January', value: 11},
    {label: 'A very long category label for February', value: 19},
    {label: 'A very long category label for March', value: 7},
    {label: 'A very long category label for April', value: 13},
  ] as any
  rows._evidenceColumnTypes = [
    {name: 'label', evidenceType: 'string'},
    {name: 'value', evidenceType: 'number'},
  ]
  return {rows}
}

function percentData () {
  let rows = [{ratio: 0.314}] as any
  rows._evidenceColumnTypes = [{name: 'ratio', evidenceType: 'number'}]
  return {rows}
}

function nullValueData () {
  let rows = [{value: null}] as any
  rows._evidenceColumnTypes = [{name: 'value', evidenceType: 'number'}]
  return {rows}
}

function areaMissingData () {
  let rows = [
    {month: 'Jan', sales: 12},
    {month: 'Feb', sales: null},
    {month: 'Mar', sales: 24},
    {month: 'Apr', sales: 18},
  ] as any
  rows._evidenceColumnTypes = [
    {name: 'month', evidenceType: 'string'},
    {name: 'sales', evidenceType: 'number'},
  ]
  return {rows}
}
