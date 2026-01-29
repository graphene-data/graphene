<script lang="ts">
  import type {Snippet} from 'svelte'
  import QueryLoad from './QueryLoad.svelte'
  import TableInner from './_Table.svelte'

  interface Props {
    data: string
    children?: Snippet
    [key: string]: unknown
  }

  let {data, children, ...restProps}: Props = $props()

  let spreadProps = $derived(Object.fromEntries(Object.entries(restProps).filter(([, value]) => value !== undefined)))
</script>

{#snippet tableContent(loaded: any[])}
  {#if children}
    <TableInner {...spreadProps} data={loaded} {children} />
  {:else}
    <TableInner {...spreadProps} data={loaded} />
  {/if}
{/snippet}

<QueryLoad {data} children={tableContent} />
