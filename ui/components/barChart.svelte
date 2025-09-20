<script>
  // import {BarChart} from '@evidence-dev/core-components/dist/unsorted/viz/bar/BarChart.svelte'
  import {BarChart} from '@evidence-dev/core-components'

  let callback
  let data = {
    isQuery: true,
    fetch: async () => {
      await Promise.resolve()
      let dt = await window.$GRAPHENE.query($$props.data)
      dt.dataLoaded = true
      callback(dt)
    },
    subscribe: (cb) => callback = cb
  }

  $: spreadProps = {
		...Object.fromEntries(Object.entries($$props).filter(([, v]) => v !== undefined))
	};
</script>

<style></style>

<BarChart showAllXAxisLabels={false} {...spreadProps} data={data} />
