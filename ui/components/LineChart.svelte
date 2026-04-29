<script lang="ts">
  import ECharts from './ECharts.svelte'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'
  import type {EChartsConfig, QueryResult, SeriesWithGroupingHint} from '../component-utilities/types.ts'

  interface Props {
    data: string | QueryResult
    x: string
    y: string
    y2?: string
    splitBy?: string
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
    sort = undefined,
    title = undefined,
    height = undefined,
    width = undefined,
  }: Props = $props()

  function buildConfig(): EChartsConfig {
    let yFields = parseCommaList(y)
    if (splitBy && yFields.length > 1) throw new Error('LineChart does not support splitBy with multiple y fields')

    let sortHint = typeof sort === 'string' && sort.trim().length > 0 ? {sort} : {}
    let series: SeriesWithGroupingHint[]

    if (splitBy) {
      // "tall" data, one template split into one series per splitBy value by enrich()
      series = [{type: 'line' as const, encode: {x, y: yFields[0], splitBy, ...sortHint}}]
    } else {
      // "wide" data, one line per field listed in y
      series = yFields.map(field => ({type: 'line' as const, name: field, encode: {x, y: field, ...sortHint}}))
    }

    if (y2) series.push({type: 'line' as const, name: y2, yAxisIndex: 1, encode: {x, y: y2, ...sortHint}})

    return {
      title: title ? {text: title} : undefined,
      tooltip: {trigger: 'axis'},
      legend: {show: Boolean(splitBy || y2 || yFields.length > 1)},
      xAxis: {},
      yAxis: [{}, ...(y2 ? [{}] : [])],
      series,
    }
  }

</script>

<ECharts data={data} config={buildConfig()} {height} {width} />
