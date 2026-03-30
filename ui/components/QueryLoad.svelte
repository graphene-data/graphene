<script lang="ts">
  import {onDestroy, onMount, type Snippet} from 'svelte'
  import type {GrapheneError} from '../../lang/types.ts'
  import ErrorDisplay from '../internal/ErrorDisplay.svelte'
  import Skeleton from './Skeleton.svelte'

  interface Props {
    data: string | {rows?: any[]}
    height?: number
    fields?: Record<string, string | string[]>
    children?: Snippet<[any[]]>
  }

  let {data, height = 200, fields = {}, children}: Props = $props()

  let error: GrapheneError | null = $state(null)
  let loaded: any[] | null = $state(null)

  let handleResults = (result: any) => {
    error = result?.error || null
    loaded = result?.rows
  }

  onMount(() => {
    if (typeof data !== 'string') {
      loaded = data.rows ?? null
    } else {
      let usedFields = Object.fromEntries(Object.entries(fields).filter(e => !!e[1]))
      window.$GRAPHENE.query(data, usedFields, handleResults)
    }
  })

  onDestroy(() => {
    window.$GRAPHENE.unsubscribe(handleResults)
  })
</script>

{#if error}
  <div style="min-height:{height}px;width:100%;display:grid;align-content:center;padding:8px;box-sizing:border-box">
    <ErrorDisplay {error} />
  </div>
{:else if !loaded}
  <Skeleton />
{:else if loaded.length == 0}
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
</style>
