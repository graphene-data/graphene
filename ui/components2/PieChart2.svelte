<script lang="ts">
  import QueryLoad2 from './QueryLoad2.svelte'
  import ECharts2 from './ECharts2.svelte'
  import type {EChartsConfig2} from './types.ts'

  interface Props {
    data: string | {rows?: any[]; fields?: any[]}
    category: string
    value: string
    title?: string
    subtitle?: string
    height?: string | number
    width?: string | number
    echartsOptions?: Record<string, any>
    seriesOptions?: Record<string, any>
  }

  let {
    data,
    category,
    value,
    title = undefined,
    subtitle = undefined,
    height = '240px',
    width = '100%',
    echartsOptions = undefined,
    seriesOptions = undefined,
  }: Props = $props()

  function buildConfig(): EChartsConfig2 {
    return {
      title: title ? {text: title, subtext: subtitle} : undefined,
      tooltip: {trigger: 'item', formatter: '{b}: {c} ({d}%)'},
      series: [{type: 'pie', data: value, radius: ['40%', '70%'], ...seriesOptions}],
      ...echartsOptions,
    }
  }
</script>

{#snippet pieChartContent(result)}
  <ECharts2 config={buildConfig()} rows={result.rows} fields={result.fields} {height} {width} chartTitle={title} />
{/snippet}

<QueryLoad2 data={data} fields={{category, value}} children={pieChartContent} />
