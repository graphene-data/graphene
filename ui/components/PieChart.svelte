<script>
  import ECharts from './ECharts.svelte'
  import QueryLoad from './QueryLoad.svelte'

  export let data
  export let category
  export let value
</script>

<style></style>

<QueryLoad data={data} fields={[category, value]} let:loaded>
  <ECharts data={loaded} config={{
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
