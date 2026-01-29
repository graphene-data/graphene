<script lang="ts">
  import ECharts from './ECharts.svelte'
  import QueryLoad from './QueryLoad.svelte'

  interface Props {
    data: any
    category: any
    value: any
    title?: any
    subtitle?: any
    printEchartsConfig?: any
    echartsOptions?: any
    seriesOptions?: any
    seriesColors?: any
  }

  let {
    data, category, value, title = undefined, subtitle = undefined, printEchartsConfig = undefined,
    echartsOptions = undefined, seriesOptions = undefined, seriesColors = undefined,
  }: Props = $props()

  // printEchartsConfig is intentionally unused - it's a debug prop that
  // users can pass but we don't implement it yet. Using $derived to read
  // it reactively and suppress state_referenced_locally warning.
  $effect(() => { void printEchartsConfig })
</script>

{#snippet pieChartContent(loaded: any[])}
  <ECharts data={loaded} {echartsOptions} {seriesOptions} {seriesColors} config={{
    title: {
      text: title,
      subtext: subtitle,
    },
    tooltip: {
      formatter: '{b}: {c} ({d}%)',
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: [...loaded.map(r => ({name: r[category], value: r[value]}))],
      },
    ],
  }} />
{/snippet}

<QueryLoad data={data} fields={{category, value}} children={pieChartContent} />
