<svelte:options customElement="graphene-barchart" />
<script>
  import { onMount, createEventDispatcher } from 'svelte'
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

<BarChart {...spreadProps} data={data} />

