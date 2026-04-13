<script lang="ts">
  import ECharts from './ECharts.svelte'
  import type {EChartsConfig, QueryResult} from '../component-utilities/types.ts'

  interface Props {
    data: string | QueryResult
    x: string
    y: string
    group?: string
    stack?: string
    stack100?: string
    sort?: string
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
    sort = undefined,
    title = undefined,
    height = undefined,
    width = undefined,
  }: Props = $props()

  function buildConfig(): EChartsConfig {
    let yFields = parseList(y)
    let mode = resolveGroupingMode(group, stack, stack100)
    let grouped = Boolean(mode && yFields.length === 1)
    let stackKey = mode?.kind === 'stack' || mode?.kind === 'stack100' ? 'area-stack' : undefined
    let stackPercentage = mode?.kind === 'stack100' ? true : undefined

    let sortHint = typeof sort === 'string' && sort.trim().length > 0 ? {sort} : {}
    let series = grouped
      ? [{type: 'line' as const, areaStyle: {opacity: 0.2}, stack: stackKey, stackPercentage, encode: {x, y: yFields[0], group: mode?.field, ...sortHint}}]
      : yFields.map(field => ({type: 'line' as const, name: field, areaStyle: {opacity: 0.2}, encode: {x, y: field, ...sortHint}}))

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
    throw new Error('AreaChart accepts only one of `group`, `stack`, or `stack100`')
  }
</script>

<ECharts data={data} config={buildConfig()} {height} {width} />
