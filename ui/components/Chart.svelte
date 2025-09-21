<script lang="ts">
  import QueryLoad from './QueryLoad.svelte'
  import Chart from './_Chart.svelte'
  import EmptyChart from './EmptyChart.svelte'
  import ErrorChart from './ErrorChart.svelte'

  type LoadedEvent = CustomEvent<unknown>

  export let data: unknown
  export let emptySet: 'pass' | 'warn' | 'error' | undefined = undefined
  export let emptyMessage: string | undefined = undefined
  export let height = 200

  let isInitial = true
  let loadedData: unknown
  let dataset: any[] | undefined
  let hasDataset = false

  $: spreadProps = Object.fromEntries(
    Object.entries($$props).filter(([, value]) => value !== undefined)
  )

  $: queryID = typeof data === 'string' ? data : (data as any)?.id

  function normalizeDataset (value: unknown) {
    if (Array.isArray(value)) return value
    if (value && Array.isArray((value as any)?.rows)) return (value as any).rows
    return undefined
  }

  function handleLoaded (event: LoadedEvent) {
    loadedData = event.detail
    dataset = normalizeDataset(loadedData)
    hasDataset = Array.isArray(dataset)
    if (loadedData !== undefined && isInitial) isInitial = false
  }
</script>

<!-- Pass all the props through-->
<QueryLoad {data} {height} on:loaded={handleLoaded} let:loaded>
	<EmptyChart
		slot="empty"
		{emptyMessage}
		{emptySet}
		chartType={spreadProps.chartType ?? 'Chart'}
		{isInitial}
	/>
	<ErrorChart let:loaded slot="error" title={spreadProps.chartType ?? 'Chart'} error={loaded?.error} />
	{#if hasDataset}
		<Chart {...spreadProps} data={dataset} {queryID}>
			<slot />
		</Chart>
	{/if}
</QueryLoad>
