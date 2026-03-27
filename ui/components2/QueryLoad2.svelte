<script lang="ts">
  import {onDestroy, onMount, type Snippet} from 'svelte'
  import ErrorDisplay from '../internal/ErrorDisplay.svelte'
  import type {Field} from './types.ts'

  interface QueryLoadResult {
    rows: any[]
    fields: Field[]
  }

  interface Props {
    data: string | {rows?: any[]; fields?: Field[]}
    fields?: Record<string, string | string[]>
    height?: number
    children?: Snippet<[QueryLoadResult]>
  }

  let {data, fields = {}, height = 200, children}: Props = $props()

  let errors: Error[] | null = $state(null)
  let loaded: QueryLoadResult | null = $state(null)

  function handleResults(result: any) {
    errors = result.errors || null
    if (!result.rows) {
      loaded = null
      return
    }
    loaded = {
      rows: result.rows,
      fields: Array.isArray(result.fields) ? result.fields : inferFieldsFromRows(result.rows),
    }
  }

  onMount(() => {
    if (typeof data !== 'string') {
      loaded = {
        rows: data.rows ?? [],
        fields: Array.isArray(data.fields) ? data.fields : inferFieldsFromRows(data.rows ?? []),
      }
      return
    }

    let usedFields = Object.fromEntries(Object.entries(fields).filter(entry => !!entry[1]))
    window.$GRAPHENE.query(data, usedFields, handleResults)
  })

  onDestroy(() => {
    window.$GRAPHENE.unsubscribe(handleResults)
  })

  function inferFieldsFromRows(rows: any[]): Field[] {
    let sample = rows.find(row => row && typeof row === 'object')
    if (!sample) return []
    return Object.keys(sample).map(name => ({name, evidenceType: inferFieldType(rows, name)}))
  }

  function inferFieldType(rows: any[], field: string) {
    let sample = rows.find(row => row?.[field] != null)?.[field]
    if (sample instanceof Date) return 'date'
    if (typeof sample === 'number') return 'number'
    if (typeof sample === 'boolean') return 'boolean'
    if (typeof sample === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sample) && Number.isFinite(Date.parse(sample))) return 'date'
    return 'string'
  }
</script>

{#if errors}
  <div style="min-height:{height}px;width:100%;display:grid;align-content:center;padding:8px;box-sizing:border-box">
    <ErrorDisplay error={errors[0]} />
  </div>
{:else if !loaded}
  <div class='ql-skeleton' style={`height:${height}px`} role="status" aria-live="polite">
    <span class="ql-skeleton__pulse"></span>
  </div>
{:else if loaded.rows.length == 0}
  <div class="empty-chart" role="note">Dataset is empty - query ran successfully, but no data was returned from the database</div>
{:else}
  {@render children?.(loaded)}
{/if}

<style>
  .ql-skeleton {
    width: 100%;
    position: relative;
    overflow: hidden;
    background: var(--chart-skeleton-bg, #f3f4f6);
    border-radius: 4px;
  }

  .ql-skeleton__pulse {
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 50%, rgba(255, 255, 255, 0) 100%);
    animation: ql-pulse 1.4s ease-in-out infinite;
    content: '';
  }

  @keyframes ql-pulse {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

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
