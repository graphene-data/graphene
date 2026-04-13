<script lang="ts">
  import {init} from 'echarts'
  import {onDestroy, onMount} from 'svelte'
  import ErrorDisplay from '../internal/ErrorDisplay.svelte'
  import * as chartWindowDebug from '../component-utilities/chartWindowDebug.js'
  import {logError} from '../internal/telemetry.ts'
  import {enrich, horizontalBarCount} from '../component-utilities/enrich.ts'
  import type {EChartsConfig, NormalConfig, QueryResult} from '../component-utilities/types.ts'
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
    height = undefined,
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
  let chartSizeStyle: string = $state(calculateChartSize())

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

    if (!chart) {
      chart = init(node, 'graphene-theme', {renderer})
      chart.on('legendselectchanged', renderChart)
    }

    try {
      chartWindowDebug.set(String(chart.id), chart)
      window.$GRAPHENE?.renderStart?.(`chart:${chart.id}`)
      renderChart()
      chartError = null
      window.$GRAPHENE?.renderComplete?.(`chart:${chart.id}`)
    } catch (error) {
      console.error('Chart failed to render', error)
      chartError = error instanceof Error ? error : new Error(String(error))
      logError(chartError, queryId ? {queryId} : undefined)
      window.$GRAPHENE?.renderComplete?.(`chart:${chart.id}`)
      destroyChart()
    }
  })

  // Build a fresh enriched option each render so legend-driven stack rounding
  // always reflects the currently visible series.
  function renderChart() {
    if (!chart || !loaded) return

    // clone config, since enriching mutates the config, and mutating a prop is weird
    // structuredClone doesn't like proxies, so use state.snapshot
    let cloned = structuredClone($state.snapshot(config)) as EChartsConfig
    let rows = loaded.rows
    let fields = loaded.fields || []
    cloned.legendSelection = chart.getOption()?.legend?.[0]?.selected
    let enriched = enrich(cloned, rows, fields)

    chartSizeStyle = calculateChartSize(enriched, rows)
    chart.setOption({...enriched, animation: false, animationDuration: 0, animationDurationUpdate: 0}, true)
  }

  function destroyChart() {
    if (!chart) return
    chart.off('legendselectchanged', renderChart)
    chartWindowDebug.unset(String(chart.id))
    chart.dispose()
    chart = null
  }

  function queryFields(config: EChartsConfig) {
    let fields: Record<string, string[]> = {}
    let series = Array.isArray(config.series) ? config.series : [config.series]
    let entries = series.flatMap(s => Object.entries(s?.encode || {}))

    for (let [attr, col] of entries) {
      let value = queryableEncodeValue(attr, col)
      if (!value) continue
      fields[attr] ||= []
      fields[attr].push(value)
    }
    return fields
  }

  function queryableEncodeValue(attr: string, value: unknown) {
    if (typeof value !== 'string') return undefined
    let trimmed = value.trim()
    if (!trimmed) return undefined

    // sort supports "column" or "column asc|desc". We only need the field in SELECT.
    if (attr === 'sort') return trimmed.split(/\s+/)[0]
    return trimmed
  }

  function calculateChartSize(config?: NormalConfig, rows: Record<string, any>[] = []) {
    let threshold = 8 // over this many bars, start to grow
    let resolvedHeight: string | number = height ?? '320px'
    let barSeries = config?.series.find(s => s.type == 'bar')
    let categoricalY = config?.yAxis[0]?.type == 'category'

    if (config && barSeries && categoricalY) {
      let distinctX = horizontalBarCount(config, rows)
      if (distinctX > threshold) resolvedHeight = 320 * Math.max(1, distinctX / threshold)
    }

    return `height:${toDim(resolvedHeight)};width:${toDim(width ?? '100%')};`
  }

  function toDim(dim: string | number) {
    let t = typeof dim
    if (t == 'number' || (t == 'string' && (dim as string).match(/^\d+$/))) return `${dim}px`
    return dim
  }

  let title = $derived(config?.title?.text)
</script>

<div class="echarts" bind:this={node} style={chartSizeStyle} data-query-id={queryId} data-chart-title={title}>
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
