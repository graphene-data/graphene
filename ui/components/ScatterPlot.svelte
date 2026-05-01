<script lang="ts">
  import ECharts from './ECharts.svelte'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'
  import type {EChartsConfig, QueryResult, SeriesWithGroupingHint} from '../component-utilities/types.ts'

  interface Props {
    data: string | QueryResult
    x: string
    y: string
    splitBy?: string
    title?: string
    height?: string | number
    width?: string | number
  }

  let {
    data,
    x,
    y,
    splitBy = undefined,
    title = undefined,
    height = undefined,
    width = undefined,
  }: Props = $props()

  function buildConfig(): EChartsConfig {
    let yFields = parseCommaList(y)
    if (splitBy && yFields.length > 1) throw new Error('ScatterPlot does not support splitBy with multiple y fields')

    let series: SeriesWithGroupingHint[]

    if (splitBy) {
      // "tall" data, one template split into one series per splitBy value by enrich()
      series = [{type: 'scatter' as const, encode: {x, y: yFields[0], splitBy}}]
    } else {
      // "wide" data, one scatter series per field listed in y
      series = yFields.map(field => ({type: 'scatter' as const, name: field, encode: {x, y: field}}))
    }

    return {
      title: title ? {text: title} : undefined,
      tooltip: {trigger: 'item'},
      legend: {show: Boolean(splitBy || yFields.length > 1)},
      grid: {left: 56, bottom: 52},
      xAxis: {name: x, nameLocation: 'middle', nameGap: 28},
      yAxis: {name: y, nameLocation: 'middle', nameGap: 40},
      series,
    }
  }
</script>

<ECharts data={data} config={buildConfig()} {height} {width} />
