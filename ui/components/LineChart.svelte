<script lang="ts">
  import ECharts from './ECharts.svelte'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'
  import type {EChartsConfig, QueryResult} from '../component-utilities/types.ts'

  interface Props {
    data: string | QueryResult
    x: string
    y: string
    series?: string
    sort?: string
    title?: string
    height?: string | number
    width?: string | number
  }

  let {
    data,
    x,
    y,
    series = undefined,
    sort = undefined,
    title = undefined,
    height = undefined,
    width = undefined,
  }: Props = $props()

  function buildConfig(): EChartsConfig {
    let yFields = parseCommaList(y)
    if (series && yFields.length > 1) throw new Error('LineChart does not support `series` when `y` has multiple fields')
    let groupedSeries = Boolean(series && yFields.length === 1)

    let sortHint = typeof sort === 'string' && sort.trim().length > 0 ? {sort} : {}
    let primarySeries = groupedSeries
      ? [{type: 'line', encode: {x, y: yFields[0], group: series, ...sortHint}}]
      : yFields.map(field => ({type: 'line', name: field, encode: {x, y: field, ...sortHint}}))

    let seriesTemplates: any[] = [...primarySeries]

    return {
      title: title ? {text: title} : undefined,
      tooltip: {trigger: 'axis'},
      legend: {show: groupedSeries || yFields.length > 1},
      xAxis: {},
      yAxis: [{}],
      series: seriesTemplates,
    }
  }

</script>

<ECharts data={data} config={buildConfig()} {height} {width} />
