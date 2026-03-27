<script lang="ts">
  import QueryLoad2 from './QueryLoad2.svelte'
  import ECharts2 from './ECharts2.svelte'
  import type {EChartsConfig2} from './types.ts'

  interface Props {
    data: string | {rows?: any[]; fields?: any[]}
    x: string
    y: string
    series?: string
    xType?: 'category' | 'value' | 'time'
    type?: 'stacked' | 'stacked100' | 'grouped'
    title?: string
    subtitle?: string
    legend?: boolean
    line?: boolean | string
    markers?: boolean | string
    markerShape?: string
    markerSize?: number
    handleMissing?: 'connect' | 'zero'
    step?: boolean | string
    stepPosition?: 'start' | 'middle' | 'end'
    colorPalette?: string
    seriesOptions?: Record<string, any>
    height?: string | number
    width?: string | number
  }

  let {
    data,
    x,
    y,
    series = undefined,
    xType = undefined,
    type = 'stacked',
    title = undefined,
    subtitle = undefined,
    legend = undefined,
    line = true,
    markers = false,
    markerShape = 'circle',
    markerSize = 8,
    handleMissing = undefined,
    step = false,
    stepPosition = 'end',
    colorPalette = undefined,
    seriesOptions = undefined,
    height = '240px',
    width = '100%',
  }: Props = $props()

  function buildConfig(): EChartsConfig2 {
    let yFields = parseList(y)
    let groupedSeries = Boolean(series && yFields.length === 1)
    let shouldStack = type === 'stacked' || type === 'stacked100'

    let seriesTemplates = groupedSeries
      ? [buildAreaTemplate(yFields[0], {name: undefined, seriesField: series, stack: shouldStack ? 'area' : undefined})]
      : yFields.map(field => buildAreaTemplate(field, {name: field, seriesField: undefined, stack: shouldStack ? 'area' : undefined}))

    return {
      color: parsePalette(colorPalette),
      title: title ? {text: title, subtext: subtitle} : undefined,
      tooltip: {trigger: 'axis'},
      legend: {show: legend ?? (groupedSeries || yFields.length > 1)},
      xAxis: {type: xType, data: x},
      yAxis: {type: 'value', max: type === 'stacked100' ? 1 : undefined},
      series: seriesTemplates,
    }
  }

  function buildAreaTemplate(field: string, options: {name?: string; seriesField?: string; stack?: string}) {
    return {
      type: 'line',
      data: field,
      series: options.seriesField,
      name: options.name,
      stack: options.stack,
      areaStyle: {},
      lineStyle: parseBool(line) ? undefined : {width: 0},
      symbol: parseBool(markers) ? markerShape : 'none',
      symbolSize: parseBool(markers) ? markerSize : undefined,
      step: parseBool(step) ? stepPosition : undefined,
      connectNulls: handleMissing === 'connect',
      ...seriesOptions,
    }
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

{#snippet areaChartContent(result)}
  <ECharts2 config={buildConfig()} rows={result.rows} fields={result.fields} {height} {width} chartTitle={title} />
{/snippet}

<QueryLoad2 data={data} fields={{x, y: parseList(y), series}} children={areaChartContent} />
