<script lang="ts">
  import ECharts from './ECharts.svelte'
  import type {EChartsConfig, QueryResult} from '../component-utilities/types.ts'

  interface Props {
    data: string | QueryResult
    x: string
    y: string
    y2?: string
    series?: string
    title?: string
    height?: string | number
    width?: string | number
  }

  let {
    data,
    x,
    y,
    y2 = undefined,
    series = undefined,
    title = undefined,
    height = undefined,
    width = undefined,
  }: Props = $props()

  function buildConfig(): EChartsConfig {
    let yFields = parseList(y)
    let groupedSeries = Boolean(series && yFields.length === 1)

    let primarySeries = groupedSeries
      ? [{type: 'line', encode: {x, y: yFields[0], group: series}}]
      : yFields.map(field => ({type: 'line', name: field, encode: {x, y: field}}))

    let seriesTemplates: any[] = [...primarySeries]
    if (y2) {
      seriesTemplates.push({type: 'line', name: y2, yAxisIndex: 1, encode: {x, y: y2}})
    }

    return {
      title: title ? {text: title} : undefined,
      tooltip: {trigger: 'axis'},
      legend: {show: groupedSeries || yFields.length > 1 || Boolean(y2)},
      xAxis: {},
      yAxis: [{}, ...(y2 ? [{}] : [])],
      series: seriesTemplates,
    }
  }

  function parseList(value?: string) {
    if (!value) return []
    return value.split(',').map(v => v.trim()).filter(Boolean)
  }
</script>

<ECharts data={data} config={buildConfig()} {height} {width} />
