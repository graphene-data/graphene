<script lang="ts">
  import ECharts from './ECharts.svelte'
  import type {EChartsConfig, QueryResult} from '../component-utilities/types.ts'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'

  interface Props {
    data: string | QueryResult
    x: string
    y: string
    y2?: string
    splitBy?: string
    arrange?: 'stack' | 'stack100'
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
    sort = undefined,
    title = undefined,
    height = undefined,
    width = undefined,
  }: Props = $props()

  function buildConfig(): EChartsConfig {
    let yFields = parseCommaList(y)
    if (splitBy && yFields.length > 1) throw new Error('AreaChart does not support splitBy with multiple y fields')

    let stack = arrange === 'stack' || arrange === 'stack100' ? 'area-stack' : undefined
    let stackPercentage = arrange === 'stack100' ? true : undefined
    let sortHint = typeof sort === 'string' && sort.trim().length > 0 ? {sort} : {}

    let series
    if (splitBy) {
      // "tall" data, one template split into one series per splitBy value by enrich()
      series = [{type: 'line' as const, areaStyle: {opacity: 0.2}, stack, stackPercentage, encode: {x, y: yFields[0], splitBy, ...sortHint}}]
    } else {
      // "wide" data, one area series per field listed in y
      series = yFields.map(field => ({type: 'line' as const, name: field, areaStyle: {opacity: 0.2}, encode: {x, y: field, ...sortHint}}))
    }

    if (y2) series.push({type: 'line' as const, name: y2, yAxisIndex: 1, encode: {x, y: y2, ...sortHint}})

    return {
      title: title ? {text: title} : undefined,
      tooltip: {trigger: 'axis'},
      legend: {show: Boolean(splitBy || y2 || yFields.length > 1)},
      xAxis: {},
      yAxis: [{max: stackPercentage ? 1 : undefined}, ...(y2 ? [{}] : [])],
      series,
    }
  }
</script>

<ECharts data={data} config={buildConfig()} {height} {width} />
