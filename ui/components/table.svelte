<script lang="ts">
  import QueryLoad from './QueryLoad.svelte'
  import EmptyChart from './EmptyChart.svelte'
  import ErrorChart from './ErrorChart.svelte'
  import TableInner from './_Table.svelte'

  export let data: unknown
  export let emptySet: 'pass' | 'warn' | 'error' = 'error'
  export let emptyMessage: string | undefined = undefined

  const restProps: Record<string, unknown> = $$restProps
  $: spreadProps = Object.fromEntries(Object.entries(restProps).filter(([, value]) => value !== undefined))

  let isInitial = true
  const chartType = 'Data Table'

  const handleLoaded = () => {
    isInitial = false
  }
</script>

<QueryLoad {data} let:loaded let:error on:loaded={handleLoaded}>
  <EmptyChart slot="empty" {emptyMessage} {emptySet} {chartType} {isInitial} />
  <ErrorChart slot="error" title={chartType} error={error?.message ?? 'Unable to load data'} />
  {#if $$slots.default}
    <TableInner {...spreadProps} data={loaded}>
      <slot />
    </TableInner>
  {:else}
    <TableInner {...spreadProps} data={loaded} />
  {/if}
</QueryLoad>
