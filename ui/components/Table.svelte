<script lang="ts">
  import type {Snippet} from 'svelte'
  import type {QueryResult} from '../component-utilities/types.ts'
  import QueryLoad from './QueryLoad.svelte'
  import TableInner from './_Table.svelte'

  interface Props {
    data: string | QueryResult
    children?: Snippet
    [key: string]: unknown
  }

  let {data, children, ...restProps}: Props = $props()

  let spreadProps = $derived(Object.fromEntries(Object.entries(restProps).filter(([, value]) => value !== undefined)))
</script>

{#snippet tableContent(loaded: QueryResult)}
  {#if children}
    <TableInner {...spreadProps} data={loaded} {children} />
  {:else}
    <TableInner {...spreadProps} data={loaded} />
  {/if}
{/snippet}

<QueryLoad {data} children={tableContent} />
