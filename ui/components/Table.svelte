<script lang="ts">
  import QueryLoad from './QueryLoad.svelte'
  import TableInner from './_Table.svelte'

  export let data: string

  const restProps: Record<string, unknown> = $$restProps
  $: spreadProps = Object.fromEntries(Object.entries(restProps).filter(([, value]) => value !== undefined))
</script>

<QueryLoad {data} let:loaded>
  {#if $$slots.default}
    <TableInner {...spreadProps} data={loaded}>
      <slot />
    </TableInner>
  {:else}
    <TableInner {...spreadProps} data={loaded} />
  {/if}
</QueryLoad>
