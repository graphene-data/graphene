<script lang="ts">
  import QueryLoad2 from './QueryLoad2.svelte'
  import ECharts2 from './ECharts2.svelte'
  import type {EChartsConfig2} from './types.ts'

  interface Props {
    data: string | {rows?: any[]; fields?: any[]}
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
    height = '240px',
    width = '100%',
  }: Props = $props()

  function buildConfig(): EChartsConfig2 {
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

{#snippet lineChartContent(result)}
  <ECharts2 config={buildConfig()} rows={result.rows} fields={result.fields} {height} {width} chartTitle={title} />
{/snippet}

<QueryLoad2 data={data} fields={{x, y: parseList(y), y2, series}} children={lineChartContent} />
