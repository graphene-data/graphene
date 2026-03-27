<script lang="ts">
  import QueryLoad2 from './QueryLoad2.svelte'
  import ECharts2 from './ECharts2.svelte'
  import type {EChartsConfig2} from './types.ts'

  interface Props {
    data: string | {rows?: any[]; fields?: any[]}
    x: string
    y: string
    y2?: string
    series?: string
    xType?: 'category' | 'value' | 'time'
    title?: string
    subtitle?: string
    legend?: boolean
    markers?: boolean | string
    markerShape?: string
    markerSize?: number
    handleMissing?: 'connect' | 'zero'
    step?: boolean | string
    stepPosition?: 'start' | 'middle' | 'end'
    lineType?: 'solid' | 'dashed' | 'dotted'
    colorPalette?: string
    y2AxisColor?: string
    xGridlines?: boolean | string
    yGridlines?: boolean | string
    xTickMarks?: boolean | string
    yTickMarks?: boolean | string
    xBaseline?: boolean | string
    yBaseline?: boolean | string
    leftPadding?: string
    rightPadding?: string
    xLabelWrap?: boolean | string
    showAllXAxisLabels?: boolean | string
    seriesOptions?: Record<string, any>
    height?: string | number
    width?: string | number
  }

  let {
    data,
    x,
    y,
    y2 = undefined,
    series = undefined,
    xType = undefined,
    title = undefined,
    subtitle = undefined,
    legend = undefined,
    markers = false,
    markerShape = 'circle',
    markerSize = 8,
    handleMissing = undefined,
    step = false,
    stepPosition = 'end',
    lineType = 'solid',
    colorPalette = undefined,
    y2AxisColor = undefined,
    xGridlines = undefined,
    yGridlines = undefined,
    xTickMarks = undefined,
    yTickMarks = undefined,
    xBaseline = undefined,
    yBaseline = undefined,
    leftPadding = undefined,
    rightPadding = undefined,
    xLabelWrap = undefined,
    showAllXAxisLabels = undefined,
    seriesOptions = undefined,
    height = '240px',
    width = '100%',
  }: Props = $props()

  function buildConfig(): EChartsConfig2 {
    let yFields = parseList(y)
    let color = parsePalette(colorPalette)

    let groupedSeries = Boolean(series && yFields.length === 1)
    let primarySeries = groupedSeries
      ? [buildLineTemplate(yFields[0], {seriesField: series, name: undefined, yAxisIndex: 0})]
      : yFields.map(field => buildLineTemplate(field, {seriesField: undefined, name: field, yAxisIndex: 0}))

    let seriesTemplates: any[] = [...primarySeries]
    if (y2) seriesTemplates.push({...buildLineTemplate(y2, {seriesField: undefined, name: y2, yAxisIndex: 1}), type: 'line'})

    return {
      color,
      title: title ? {text: title, subtext: subtitle} : undefined,
      tooltip: {trigger: 'axis'},
      legend: {show: legend ?? (groupedSeries || yFields.length > 1 || Boolean(y2))},
      grid: [{left: leftPadding, right: rightPadding}],
      xAxis: {
        type: xType,
        splitLine: {show: parseBool(xGridlines)},
        axisTick: {show: parseBool(xTickMarks)},
        axisLine: {show: parseBool(xBaseline)},
        axisLabel: buildXAxisLabelOptions(),
      },
      yAxis: [
        {
          type: 'value',
          show: true,
          splitLine: {show: parseBool(yGridlines)},
          axisTick: {show: parseBool(yTickMarks)},
          axisLine: {show: parseBool(yBaseline)},
          axisLabel: {show: true},
        },
        ...(y2 ? [{type: 'value', show: true, axisLabel: {show: true, color: y2AxisColor}, splitLine: {show: false}, axisTick: {show: true}, axisLine: {show: true}}] : []),
      ],
      series: seriesTemplates,
    }
  }

  function buildLineTemplate(field: string, options: {seriesField?: string; name?: string; yAxisIndex: number}) {
    return {
      type: 'line',
      encode: {x, y: field},
      series: options.seriesField,
      name: options.name,
      yAxisIndex: options.yAxisIndex,
      connectNulls: handleMissing === 'connect',
      step: parseBool(step) ? stepPosition : undefined,
      lineStyle: lineType && lineType !== 'solid' ? {type: lineType} : undefined,
      symbol: parseBool(markers) ? markerShape : 'none',
      symbolSize: parseBool(markers) ? markerSize : undefined,
      ...seriesOptions,
    }
  }

  function buildXAxisLabelOptions() {
    let showAll = parseBool(showAllXAxisLabels)
    if (!showAll && !parseBool(xLabelWrap)) return undefined
    if (!parseBool(xLabelWrap)) return {interval: 0, showMaxLabel: true}
    return {interval: 0, overflow: 'break', width: 96, showMaxLabel: true}
  }

  function parseList(value?: string) {
    if (!value) return []
    return value.split(',').map(v => v.trim()).filter(Boolean)
  }

  function parseBool(value: unknown) {
    if (value === undefined || value === null) return undefined
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') return value.toLowerCase() === 'true'
    return Boolean(value)
  }

  function parsePalette(value?: string) {
    if (!value) return undefined
    try {
      let parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {}
    return value.split(',').map(v => v.trim()).filter(Boolean)
  }
</script>

{#snippet lineChartContent(result)}
  <ECharts2 config={buildConfig()} rows={result.rows} fields={result.fields} {height} {width} chartTitle={title} />
{/snippet}

<QueryLoad2 data={data} fields={{x, y: parseList(y), y2, series}} children={lineChartContent} />
