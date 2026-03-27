<script lang="ts">
  import QueryLoad2 from './QueryLoad2.svelte'
  import ECharts2 from './ECharts2.svelte'
  import type {EChartsConfig2} from './types.ts'

  interface Props {
    data: string | {rows?: any[]; fields?: any[]}
    x: string
    y: string
    y2?: string
    group?: string
    stack?: string | boolean
    label?: boolean | string
    title?: string
    height?: string | number
    width?: string | number
  }

  let {
    data,
    x,
    y,
    y2 = undefined,
    group = undefined,
    stack = false,
    label = false,
    title = undefined,
    height = '240px',
    width = '100%',
  }: Props = $props()

  function buildConfig(): EChartsConfig2 {
    let yFields = parseList(y)
    let grouped = Boolean(group && yFields.length === 1)
    let barLabel = label ? {show: true} : undefined
    let stackKey = resolveStack(stack)

    let series = grouped
      ? [{type: 'bar', encode: {x, y: yFields[0], group}, stack: stackKey, label: barLabel}]
      : yFields.map(field => ({type: 'bar', name: field, stack: stackKey, encode: {x, y: field}, label: barLabel}))

    if (y2) {
      series.push({type: 'line', name: y2, yAxisIndex: 1, encode: {x, y: y2}})
    }

    return {
      title: title ? {text: title} : undefined,
      tooltip: {trigger: 'axis'},
      legend: {show: Boolean(grouped || yFields.length > 1 || y2)},
      xAxis: {},
      yAxis: [{}, ...(y2 ? [{}] : [])],
      series,
    }
  }

  function parseList(value?: string) {
    if (!value) return []
    return value.split(',').map(v => v.trim()).filter(Boolean)
  }

  function resolveStack(value?: string | boolean) {
    if (!value) return undefined
    if (typeof value === 'string') return value
    return 'bar-stack'
  }
</script>

{#snippet barChartContent(result)}
  <ECharts2 config={buildConfig()} rows={result.rows} fields={result.fields} {height} {width} chartTitle={title} />
{/snippet}

<QueryLoad2 data={data} fields={{x, y: parseList(y), y2, group}} children={barChartContent} />
