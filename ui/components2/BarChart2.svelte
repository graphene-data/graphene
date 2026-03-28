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
    stack?: string
    stack100?: string
    label?: boolean
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
    stack = undefined,
    stack100 = undefined,
    label = false,
    title = undefined,
    height = '240px',
    width = '100%',
  }: Props = $props()

  function buildConfig(): EChartsConfig2 {
    let yFields = parseList(y)
    let mode = resolveGroupingMode(group, stack, stack100)
    let grouped = Boolean(mode && yFields.length === 1)
    let barLabel = label ? {show: true} : undefined
    let stackKey = mode?.kind === 'stack' || mode?.kind === 'stack100' ? 'bar-stack' : undefined
    let stackPercentage = mode?.kind === 'stack100' ? true : undefined

    let series = grouped
      ? [{type: 'bar', encode: {x, y: yFields[0], group: mode?.field}, stack: stackKey, stackPercentage, label: barLabel}]
      : yFields.map(field => ({type: 'bar', name: field, encode: {x, y: field}, label: barLabel}))

    if (y2) series.push({type: 'line', name: y2, yAxisIndex: 1, encode: {x, y: y2}})

    return {
      title: title ? {text: title} : undefined,
      tooltip: {trigger: 'axis'},
      legend: {show: Boolean(grouped || yFields.length > 1 || y2)},
      xAxis: {},
      yAxis: [{max: stackPercentage ? 1 : undefined}, ...(y2 ? [{}] : [])],
      series,
    }
  }

  function parseList(value?: string) {
    if (!value) return []
    return value.split(',').map(v => v.trim()).filter(Boolean)
  }

  function resolveGroupingMode(group?: string, stack?: string, stack100?: string) {
    let modes = [
      group ? {kind: 'group' as const, field: group} : undefined,
      stack ? {kind: 'stack' as const, field: stack} : undefined,
      stack100 ? {kind: 'stack100' as const, field: stack100} : undefined,
    ].filter(Boolean)

    if (modes.length <= 1) return modes[0]
    throw new Error('BarChart2 accepts only one of `group`, `stack`, or `stack100`')
  }
</script>

{#snippet barChartContent(result)}
  <ECharts2 config={buildConfig()} rows={result.rows} fields={result.fields} {height} {width} chartTitle={title} />
{/snippet}

<QueryLoad2 data={data} fields={{x, y: parseList(y), y2, group: resolveGroupingMode(group, stack, stack100)?.field}} children={barChartContent} />
