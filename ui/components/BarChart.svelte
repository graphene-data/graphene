<script lang="ts">
  import {untrack} from 'svelte'
  import ECharts from './ECharts.svelte'
  import type {EChartsConfig, QueryResult, SeriesWithGroupingHint} from '../component-utilities/types.ts'
  import {componentLogger, logExtraProps} from '../internal/telemetry.ts'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'

  interface Props {
    data: string | QueryResult
    x: string
    y: string
    y2?: string
    splitBy?: string
    arrange?: 'stack' | 'group' | 'stack100'
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
    splitBy = undefined,
    arrange = 'stack',
    label = false,
    sort = undefined,
    title = undefined,
    height = undefined,
    width = undefined,
    ...extraProps
  }: Props & Record<string, unknown> = $props()

  let logger = untrack(() => componentLogger('BarChart', {data: typeof data == 'string' ? data : undefined, x, y}))
  untrack(() => logExtraProps(logger, 'BarChart', extraProps))

  function buildConfig(): EChartsConfig {
    let xFields = parseCommaList(x)
    let yFields = parseCommaList(y)
    let horizontal = xFields.length > 1

    if (xFields.length > 1 && yFields.length !== 1) throw new Error('BarChart only supports multiple x fields for horizontal charts with a single y field')
    if (splitBy && horizontal && xFields.length > 1) throw new Error('BarChart does not support splitBy with multiple x fields')
    if (splitBy && !horizontal && yFields.length > 1) throw new Error('BarChart does not support splitBy with multiple y fields')

    let barLabel = label ? {show: true} : undefined
    let stack = arrange === 'stack' || arrange === 'stack100' ? 'bar-stack' : undefined
    let stackPercentage = arrange === 'stack100' ? true : undefined
    let sortHint = typeof sort === 'string' && sort.trim().length > 0 ? {sort} : {}

    let series: SeriesWithGroupingHint[]

    if (splitBy) {
      // "tall" data, series are created for unique values of the valueField (handled by an enrichment)
      let valueField = horizontal ? xFields[0] : yFields[0]
      let encode = {x: horizontal ? valueField : x, y: horizontal ? y : valueField, splitBy, ...sortHint}
      series = [{type: 'bar' as const, encode, stack, stackPercentage, label: barLabel}]
    } else {
      // "wide" data, series are created for field listed in the y (or x, for horizontal) attribute
      if (horizontal) {
        series = xFields.map(field => ({type: 'bar' as const, name: field, encode: {x: field, y, ...sortHint}, label: barLabel}))
      } else {
        series = yFields.map(field => ({type: 'bar' as const, name: field, encode: {x, y: field, ...sortHint}, label: barLabel}))
      }
    }

    // y2 is a special shortcut for adding a line on top of a bar chart
    if (y2) series.push({type: 'line' as const, name: y2, yAxisIndex: 1, encode: {x, y: y2, ...sortHint}})

    return {
      title: title ? {text: title} : undefined,
      tooltip: {trigger: 'axis'},
      legend: {show: Boolean(splitBy || y2 || (!horizontal && yFields.length > 1) || (horizontal && xFields.length > 1))},
      xAxis: {},
      yAxis: [{max: stackPercentage ? 1 : undefined}, ...(y2 ? [{}] : [])],
      series,
    }
  }
</script>

<ECharts data={data} config={buildConfig()} {height} {width} componentId={logger.id} />
