<script lang="ts">
  import QueryLoad2 from './QueryLoad2.svelte'
  import ECharts2 from './ECharts2.svelte'
  import type {EChartsConfig2} from './types.ts'

  interface Props {
    data: string | {rows?: any[]; fields?: any[]}
    x: string
    y: string
    group?: string
    stack?: string | boolean
    stack100?: string | boolean
    title?: string
    height?: string | number
    width?: string | number
  }

  let {
    data,
    x,
    y,
    group = undefined,
    stack = true,
    stack100 = false,
    title = undefined,
    height = '240px',
    width = '100%',
  }: Props = $props()

  function buildConfig(): EChartsConfig2 {
    let yFields = parseList(y)
    let groupedSeries = Boolean(series && yFields.length === 1)
    let stackKey = type === 'stacked' || type === 'stacked100' ? 'area' : undefined

    let seriesTemplates = groupedSeries
      ? [{type: 'line', areaStyle: {}, stack: stackKey, encode: {x, y: yFields[0], group: series}}]
      : yFields.map(field => ({type: 'line', name: field, areaStyle: {}, stack: stackKey, encode: {x, y: field}}))

    return {
      title: title ? {text: title} : undefined,
      tooltip: {trigger: 'axis'},
      legend: {show: groupedSeries || yFields.length > 1},
      xAxis: {},
      yAxis: {max: type === 'stacked100' ? 1 : undefined},
      series: seriesTemplates,
    }
  }

  function parseList(value?: string) {
    if (!value) return []
    return value.split(',').map(v => v.trim()).filter(Boolean)
  }
</script>

{#snippet areaChartContent(result)}
  <ECharts2 config={buildConfig()} rows={result.rows} fields={result.fields} {height} {width} chartTitle={title} />
{/snippet}

<QueryLoad2 data={data} fields={{x, y: parseList(y), series}} children={areaChartContent} />
