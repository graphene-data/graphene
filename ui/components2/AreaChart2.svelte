<script lang="ts">
  import ECharts2 from './ECharts2.svelte'
  import type {EChartsConfig2} from './types.ts'

  interface Props {
    data: string | {rows?: any[]; fields?: any[]}
    x: string
    y: string
    group?: string
    stack?: string
    stack100?: string
    title?: string
    height?: string | number
    width?: string | number
  }

  let {
    data,
    x,
    y,
    group = undefined,
    stack = undefined,
    stack100 = undefined,
    title = undefined,
    height = '240px',
    width = '100%',
  }: Props = $props()

  function buildConfig(): EChartsConfig2 {
    let yFields = parseList(y)
    let mode = resolveGroupingMode(group, stack, stack100)
    let grouped = Boolean(mode && yFields.length === 1)
    let stackKey = mode?.kind === 'stack' || mode?.kind === 'stack100' ? 'area-stack' : undefined
    let stackPercentage = mode?.kind === 'stack100' ? true : undefined

    let series = grouped
      ? [{type: 'line', areaStyle: {opacity: 0.2}, stack: stackKey, stackPercentage, encode: {x, y: yFields[0], group: mode?.field}}]
      : yFields.map(field => ({type: 'line', name: field, areaStyle: {opacity: 0.2}, encode: {x, y: field}}))

    return {
      title: title ? {text: title} : undefined,
      tooltip: {trigger: 'axis'},
      legend: {show: grouped || yFields.length > 1},
      xAxis: {},
      yAxis: {max: stackPercentage ? 1 : undefined},
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
    throw new Error('AreaChart2 accepts only one of `group`, `stack`, or `stack100`')
  }
</script>

<ECharts2 data={data} config={buildConfig()} {height} {width} />
