<!-- Load table data. Alert actions get a row above the headers; otherwise comments stay overlaid. -->
<script lang="ts">
  import {untrack, type Snippet} from 'svelte'
  import type {QueryResult} from '../component-utilities/types.ts'
  import {componentLogger} from '../internal/telemetry.ts'
  import {getAlertStore} from '../internal/alerts.ts'
  import AlertBell from './_AlertBell.svelte'
  import CommentButton from './CommentButton.svelte'
  import QueryLoad from './QueryLoad.svelte'
  import TableInner from './_Table.svelte'

  interface Props {
    id?: string
    data: string | QueryResult
    children?: Snippet
    [key: string]: unknown
  }

  let {id = undefined, data, children, ...restProps}: Props = $props()

  const alerts = getAlertStore()
  let logger = untrack(() => componentLogger('DataTable', {data: typeof data == 'string' ? data : undefined}))
  let componentId = $derived(id || logger.id)
  let componentTitle = $derived(restProps.title === undefined || restProps.title === null ? undefined : String(restProps.title))
  let spreadProps = $derived(Object.fromEntries(Object.entries(restProps).filter(([, value]) => value !== undefined)))
</script>

{#snippet tableContent(loaded: QueryResult)}
  {#if children}
    <TableInner {...spreadProps} data={loaded} {componentId} {children} />
  {:else}
    <TableInner {...spreadProps} data={loaded} {componentId} />
  {/if}
{/snippet}

<div class="table-component" data-component-id={componentId} data-component-title={componentTitle} data-chart-title={componentTitle}>
  <div class="component-actions" class:with-alerts={!!$alerts[componentId]?.length}><AlertBell {componentId} /><CommentButton {componentId} title={componentTitle} /></div>
  <QueryLoad {data} children={tableContent} {componentId} />
</div>

<style>
  .table-component { position: relative; }
  .component-actions { position: absolute; z-index: 2; top: -.25rem; right: 1rem; display: flex; align-items: center; justify-content: flex-end; }
  .component-actions.with-alerts { position: static; }
  /* Empty action rows must not interrupt the table's collapsing margins. */
  .component-actions:empty { display: none; }
</style>
