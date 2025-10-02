<script>
  import ECharts from './ECharts.svelte'
  import QueryLoad from './QueryLoad.svelte'

  export let data
  export let category
  export let value
  export let printEchartsConfig = undefined
  export let echartsOptions = undefined
  export let seriesOptions = undefined
  export let seriesColors = undefined
  $: void printEchartsConfig
</script>

<style></style>

<QueryLoad data={data} fields={[category, value]} let:loaded>
  <ECharts data={loaded} {echartsOptions} {seriesOptions} {seriesColors} config={{
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
</QueryLoad>
