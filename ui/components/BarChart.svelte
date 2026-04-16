<script lang="ts">
  import ECharts from './ECharts.svelte'
  import type {EChartsConfig, QueryResult, SeriesWithGroupingHint} from '../component-utilities/types.ts'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'

  interface Props {
    data: string | QueryResult
    x: string
    y: string
    y2?: string
    group?: string
    stack?: string
    stack100?: string
    label?: boolean
    sort?: string
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
    sort = undefined,
    title = undefined,
    height = undefined,
    width = undefined,
  }: Props = $props()

  function buildConfig(): EChartsConfig {
    let yFields = parseCommaList(y)
    let mode = resolveGroupingMode(group, stack, stack100)
    if (mode && yFields.length > 1) throw new Error('BarChart does not support `group`, `stack`, or `stack100` when `y` has multiple fields')
    let grouped = Boolean(mode && yFields.length === 1)
    let barLabel = label ? {show: true} : undefined
    let stackKey = mode?.kind === 'stack' || mode?.kind === 'stack100' ? 'bar-stack' : undefined
    let stackPercentage = mode?.kind === 'stack100' ? true : undefined

    let sortHint = typeof sort === 'string' && sort.trim().length > 0 ? {sort} : {}
    let series: SeriesWithGroupingHint[] = grouped
      ? [{type: 'bar' as const, encode: {x, y: yFields[0], group: mode?.field, ...sortHint}, stack: stackKey, stackPercentage, label: barLabel}]
      : yFields.map(field => ({type: 'bar' as const, name: field, encode: {x, y: field, ...sortHint}, label: barLabel}))

    if (y2) series.push({type: 'line' as const, name: y2, yAxisIndex: 1, encode: {x, y: y2, ...sortHint}})

    return {
      title: title ? {text: title} : undefined,
      tooltip: {trigger: 'axis'},
      legend: {show: Boolean(grouped || yFields.length > 1 || y2)},
      xAxis: {},
      yAxis: [{max: stackPercentage ? 1 : undefined}, ...(y2 ? [{}] : [])],
      series,
    }
  }

  function resolveGroupingMode(group?: string, stack?: string, stack100?: string) {
    let modes = [
      group ? {kind: 'group' as const, field: group} : undefined,
      stack ? {kind: 'stack' as const, field: stack} : undefined,
      stack100 ? {kind: 'stack100' as const, field: stack100} : undefined,
    ].filter(Boolean)

    if (modes.length <= 1) return modes[0]
    throw new Error('BarChart accepts only one of `group`, `stack`, or `stack100`')
  }
</script>

<ECharts data={data} config={buildConfig()} {height} {width} />
