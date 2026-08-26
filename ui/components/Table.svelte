<script lang="ts">
  import {untrack, type Snippet} from 'svelte'
  import type {QueryResult} from '../component-utilities/types.ts'
  import {componentLogger} from '../internal/telemetry.ts'
  import CommentButton from './CommentButton.svelte'
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
  <div class="component-actions"><CommentButton componentId={logger.id} title={componentTitle} /></div>
  <QueryLoad {data} children={tableContent} componentId={logger.id} />
</div>

<style>
  .table-component { position: relative; }
  .component-actions { position: absolute; z-index: 2; top: -.25rem; right: 1rem; display: flex; align-items: center; }
</style>
