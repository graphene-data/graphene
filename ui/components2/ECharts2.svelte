<script lang="ts">
  import {init} from 'echarts6/dist/echarts.esm.js'
  import {onDestroy, onMount} from 'svelte'
  import ErrorDisplay from '../internal/ErrorDisplay.svelte'
  import * as chartWindowDebug from '../component-utilities/chartWindowDebug.js'
  import {enrich} from './enrich.ts'
  import type {EChartsConfig2, QueryResult} from './types.ts'
  import './theme.ts'
  import Skeleton from './Skeleton.svelte'

  interface Props {
    config: EChartsConfig2
    data: string | QueryResult
    height?: string | number
    width?: string | number
    renderer?: 'canvas' | 'svg'
  }

  let {
    config,
    data,
    height = '240px',
    width = '100%',
    renderer = 'svg',
  }: Props = $props()

  // not state, because we don't want `$effect` to run when they change
  let node: HTMLDivElement | null = null
  let chart: any

  // Use `raw` because data can be big, and there's little upside to making it reactive
  let loaded = $state.raw<QueryResult | null>(null)
  let chartError: Error | null = $state(null)

  function handleResults (res: QueryResult) {
    loaded = res
  }

  // If `data` is just a string, kick off a query to fetch the data
  // This maybe could be an effect, but we'd have to ensure we don't double-subscribe
  onMount(() => {
    if (typeof data == 'string') {
      // compute the fields we need to query by looking at `config.series.encode` (for all series)
      let series = Array.isArray(config.series) ? config.series : [config.series]
      let fields = series.flatMap(s => Object.values(s?.encode || {}))
      window.$GRAPHENE.query(data, fields, handleResults)
    } else {
      loaded = data
    }
  })

  onDestroy(() => {
    window.$GRAPHENE.unsubscribe(handleResults)
    destroyChart()
  })

  $effect(() => {
    if (!loaded || loaded.error || loaded.rows.length == 0) {
      destroyChart()
      return
    }

    console.log('foo')
    chart ||= init(node, 'graphene-theme', {renderer})
    let chartId = chart.id

    try {
      chartWindowDebug.set(String(chart.id), chart)
      window.$GRAPHENE?.renderStart?.(`chart:${chartId}`)

      // clone config, since enriching mutates the config, and mutating a prop is weird
      // structuredClone doesn't like proxies, so use state.snapshot
      let cloned = structuredClone($state.snapshot(config)) as EChartsConfig2
      enrich(cloned, loaded.rows, loaded.fields || [])

      chart.setOption({...cloned, animation: false, animationDuration: 0, animationDurationUpdate: 0}, true)
    } catch (error) {
      console.error('Chart failed to render', error)
      chartError = error instanceof Error ? error : new Error(String(error))
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

  function toDimension(dimension: string | number | undefined, fallback: string) {
    return typeof dimension === 'number' ? `${dimension}px` : dimension || fallback
  }
</script>

<div class="echarts2" bind:this={node} style={`height:${toDimension(height, '240px')};width:${toDimension(width, '100%')}`}>
  {#if loaded?.error || chartError}
    <ErrorDisplay error={loaded?.error || chartError} />
  {:else if !loaded}
    <Skeleton />
  {:else if loaded.rows.length == 0}
    <div class="empty-chart" role="note">Dataset is empty - query ran successfully, but no data was returned from the database</div>
  {/if}
</div>
<!--       // data-chart-title={chartState.title}
// data-query-id={queryId}
 -->

<style>
  .echarts2 {
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
