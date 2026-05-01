<script lang="ts">
  import {onDestroy, onMount, untrack, type Snippet} from 'svelte'
  import type {GrapheneError} from '../../lang/index.d.ts'
  import ErrorDisplay from '../internal/ErrorDisplay.svelte'
  import type {QueryResult} from '../component-utilities/types.ts'
  import {componentLogger} from '../internal/telemetry.ts'
  import Skeleton from './Skeleton.svelte'

  interface Props {
    data: string | QueryResult
    height?: number
    fields?: Record<string, string | string[]>
    inline?: boolean
    componentId?: string
    children?: Snippet<[QueryResult]>
  }

  let {data, height = 200, fields = {}, inline = false, componentId = undefined, children}: Props = $props()
  let logger = untrack(() => componentLogger(componentId || 'QueryLoad', componentId ? {} : {data: typeof data == 'string' ? data : undefined, ...fields}))

  let error: GrapheneError | null = $state(null)
  let loaded: QueryResult | null = $state(null)
  let tooltipId = `query-error-${Math.random().toString(36).slice(2)}`

  let handleResults = (result: QueryResult) => {
    error = result?.error || null
    loaded = {rows: result?.rows ?? [], fields: result?.fields ?? [], error: result?.error, sql: result?.sql}
    if (result?.error) logger.error(result.error, {...result.error, componentId: logger.id})
  }

  onMount(() => {
    if (typeof data !== 'string') {
      error = data.error || null
      loaded = {rows: data.rows ?? [], fields: data.fields ?? [], error: data.error, sql: data.sql}
    } else {
      let usedFields = Object.fromEntries(Object.entries(fields).filter(e => !!e[1]))
      window.$GRAPHENE.query(data, usedFields, handleResults, logger.id)
    }
  })

  onDestroy(() => {
    window.$GRAPHENE.unsubscribe(handleResults)
  })
</script>

{#if error}
  {#if inline}
    <span class="inline-error">
      <button class="inline-error__icon" type="button" aria-label="Query failed" aria-describedby={tooltipId}>!</button>
      <span class="inline-error__tooltip" id={tooltipId} role="tooltip">
        <ErrorDisplay {error} />
      </span>
    </span>
  {:else}
    <div style="min-height:{height}px;width:100%;display:grid;align-content:center;padding:8px;box-sizing:border-box">
      <ErrorDisplay {error} />
    </div>
  {/if}
{:else if !loaded}
  <Skeleton />
{:else if loaded.rows.length == 0}
  <div class="empty-chart" role="note">Dataset is empty - query ran successfully, but no data was returned from the database</div>
{:else}
  {@render children?.(loaded)}
{/if}

<style>
  .empty-chart {
    width: 100%;
    padding: 12px;
    margin: 8px 0;
    border: 1px dashed rgba(107, 114, 128, 0.6);
    border-radius: 4px;
    font-size: 12px;
    color: rgba(75, 85, 99, 0.9);
    text-align: center;
    background: rgba(243, 244, 246, 0.6);
  }

  .inline-error {
    position: relative;
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
  }

  .inline-error__icon {
    width: 1.05em;
    height: 1.05em;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--graphene-error-border, #ef4444);
    border-radius: 999px;
    background: var(--graphene-error-background, #fef2f2);
    color: var(--graphene-error-content-strong, #b91c1c);
    cursor: help;
    font: inherit;
    font-size: 0.75em;
    font-weight: 700;
    line-height: 1;
  }

  .inline-error__tooltip {
    display: none;
    position: absolute;
    z-index: 1000;
    top: calc(100% + 8px);
    left: 0;
    width: min(420px, 80vw);
    text-align: left;
    filter: drop-shadow(0 8px 18px rgba(15, 23, 42, 0.18));
  }

  .inline-error:hover .inline-error__tooltip,
  .inline-error:focus-within .inline-error__tooltip {
    display: block;
  }
</style>
