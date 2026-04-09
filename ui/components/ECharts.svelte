<script lang="ts">
  import {init} from 'echarts'
  import {onDestroy, onMount} from 'svelte'
  import ErrorDisplay from '../internal/ErrorDisplay.svelte'
  import * as chartWindowDebug from '../component-utilities/chartWindowDebug.js'
  import {logError} from '../internal/telemetry.ts'
  import {enrich} from '../component-utilities/enrich.ts'
  import type {EChartsConfig, QueryResult} from '../component-utilities/types.ts'
  import '../component-utilities/theme.ts'
  import Skeleton from './Skeleton.svelte'

  interface Props {
    config: EChartsConfig
    data: string | QueryResult
    height?: string | number
    width?: string | number
    renderer?: 'canvas' | 'svg'
  }

  let {
    config,
    data,
    height = '320px',
    width = '100%',
    renderer = 'svg',
  }: Props = $props()

  // not state, because we don't want `$effect` to run when they change
  let node: HTMLDivElement | null = null
  let chart: any
  let resizeObserver: ResizeObserver | null = null

  // Use `raw` because data can be big, and there's little upside to making it reactive
  let loaded = $state.raw<QueryResult | null>(null)
  let chartError: Error | null = $state(null)
  let queryId: string | null = $state(null)

  function handleResults (res: QueryResult) {
    chartError = null
    loaded = res
  }

  // If `data` is just a string, kick off a query to fetch the data.
  // This maybe could be an effect, but we'd have to ensure we don't double-subscribe.
  onMount(() => {
    resizeObserver = new ResizeObserver(() => chart?.resize())
    if (node) resizeObserver.observe(node)

    if (typeof data == 'string') {
      try {
        queryId = window.$GRAPHENE.query(data, queryFields(config), handleResults)
      } catch (error) {
        chartError = error instanceof Error ? error : new Error(String(error))
      }
    } else {
      loaded = data
    }
  })

  onDestroy(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
    window.$GRAPHENE.unsubscribe(handleResults)
    destroyChart()
  })

  $effect(() => {
    if (chartError) return
    if (!loaded || loaded.error || loaded.rows.length == 0) {
      destroyChart()
      return
    }

    chart ||= init(node, 'graphene-theme', {renderer})
    let chartId = chart.id

    try {
      chartWindowDebug.set(String(chart.id), chart)
      window.$GRAPHENE?.renderStart?.(`chart:${chartId}`)

      // clone config, since enriching mutates the config, and mutating a prop is weird
      // structuredClone doesn't like proxies, so use state.snapshot
      let cloned = structuredClone($state.snapshot(config)) as EChartsConfig
      enrich(cloned, loaded.rows, loaded.fields || [])

      chart.setOption({...cloned, animation: false, animationDuration: 0, animationDurationUpdate: 0}, true)
      chartError = null
    } catch (error) {
      console.error('Chart failed to render', error)
      chartError = error instanceof Error ? error : new Error(String(error))
      logError(chartError, queryId ? {queryId} : undefined)
      destroyChart()
    } finally {
      window.$GRAPHENE?.renderComplete?.(`chart:${chartId}`)
    }
  })

  function destroyChart() {
    if (!chart) return
    chartWindowDebug.unset(String(chart.id))
    chart.dispose()
    chart = null
  }

  function queryFields(config: EChartsConfig) {
    let fields: Record<string, string[]> = {}
    let series = Array.isArray(config.series) ? config.series : [config.series]
    let entries = series.flatMap(s => Object.entries(s?.encode || {}))
    for (let [attr, col] of entries) {
      fields[attr] ||= []
      fields[attr].push(col)
    }
    return fields
  }

  let style = $derived.by(() => {
    let s = ''
    let toDim = (dim: string | number) => {
      let t = typeof dim
      if (t == 'number' || (t == 'string' && (dim as string).match(/^\d+$/))) return `${dim}px`
      return dim
    }
    if (height) s += `height:${toDim(height)};`
    if (width) s += `width:${toDim(width)};`
    return s
  })

  let title = $derived(config?.title?.text)
</script>

<div class="echarts" bind:this={node} style={style} data-query-id={queryId} data-chart-title={title}>
  {#if loaded?.error || chartError}
    <ErrorDisplay error={loaded?.error || chartError} />
  {:else if !loaded}
    <Skeleton />
  {:else if loaded.rows.length == 0}
    <div class="empty-chart" role="note">Dataset is empty - query ran successfully, but no data was returned from the database</div>
  {/if}
</div>

<style>
  .echarts {
    position: relative;
  }

  .empty-chart {
    width: 100%;
    height: 100%;
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
