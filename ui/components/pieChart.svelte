<script>
  import {ECharts} from '@evidence-dev/core-components'
  // import {QueryLoad} from '@evidence-dev/core-components/dist/atoms/query-load'

  export let category
  export let value

  $: Promise.resolve().then(() => window.$GRAPHENE.query($$props.data)).then(dt => {
    loaded = dt.map(row => ({
      name: row[category],
      value: row[value]
    }))
  })

  let loaded
</script>

<style></style>

{#if loaded}
  <ECharts data={loaded} config={{
    tooltip: {
        formatter: '{b}: {c} ({d}%)'
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: [...loaded],
      }
    ]
    }
  }
  />
{/if}


<!-- <PieChart {...spreadProps} data={data} /> -->
