<script lang="ts">
  import {untrack, type Snippet} from 'svelte'
  import type {QueryResult} from '../component-utilities/types.ts'
  import {componentLogger} from '../internal/telemetry.ts'
  import QueryLoad from './QueryLoad.svelte'
  import TableInner from './_Table.svelte'

  interface Props {
    data: string | QueryResult
    children?: Snippet
    [key: string]: unknown
  }

  let {data, children, ...restProps}: Props = $props()

  let logger = untrack(() => componentLogger('DataTable', {data: typeof data == 'string' ? data : undefined}))
  let componentTitle = $derived(restProps.title === undefined || restProps.title === null ? undefined : String(restProps.title))
  let spreadProps = $derived(Object.fromEntries(Object.entries(restProps).filter(([, value]) => value !== undefined)))
</script>

{#snippet tableContent(loaded: QueryResult)}
  {#if children}
    <TableInner {...spreadProps} data={loaded} componentId={logger.id} {children} />
  {:else}
    <TableInner {...spreadProps} data={loaded} componentId={logger.id} />
  {/if}
{/snippet}

<div class="table-component" data-component-id={logger.id} data-component-title={componentTitle} data-chart-title={componentTitle}>
  <QueryLoad {data} children={tableContent} componentId={logger.id} />
</div>
