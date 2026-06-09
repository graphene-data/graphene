<script lang="ts">
  import {init} from 'echarts'
  import {onDestroy, onMount, untrack} from 'svelte'
  import {rowsToCsv} from '../../lang/csv.ts'
  import ErrorDisplay from '../internal/ErrorDisplay.svelte'
  import {componentLogger, logExtraProps} from '../internal/telemetry.ts'
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
    componentId?: string
  }

  let {
    config = {},
    data,
    height = undefined,
    width = '100%',
    renderer = 'svg',
    componentId = undefined,
    ...extraProps
  }: Props & Record<string, unknown> = $props()

  config ||= {}

  let queryFieldsForLogger = untrack(() => typeof data == 'string' ? queryFields(config) : {})
  let chartLogger = untrack(() => componentLogger(componentId || 'ECharts', componentId ? {} : {data: typeof data == 'string' ? data : undefined, ...queryFieldsForLogger}))
  let displayId = untrack(() => componentId || chartLogger.id)
  untrack(() => logExtraProps(chartLogger, 'ECharts', extraProps))

  // not state, because we don't want `$effect` to run when they change
  let node: HTMLDivElement | null = null
  let chart: any
  let resizeObserver: ResizeObserver | null = null

  // Use `raw` because data can be big, and there's little upside to making it reactive
  let loaded = $state.raw<QueryResult | null>(null)
  let chartError: Error | null = $state(null)
  let mountedComponentId: string | null = $state(displayId)
  let chartTitle: string | undefined = $state(undefined)
  let chartSizeStyle: string = $state(calculateChartSize())

  function handleResults (res: QueryResult) {
    chartError = null
    loaded = res
    registerChartExport()
    if (res?.error) chartLogger.error(res.error, {...res.error, componentId: displayId})
  }

  // If `data` is just a string, kick off a query to fetch the data.
  // This maybe could be an effect, but we'd have to ensure we don't double-subscribe.
  onMount(() => {
    resizeObserver = new ResizeObserver(() => chart?.resize())
    if (node) resizeObserver.observe(node)

    if (typeof data == 'string') {
      try {
        mountedComponentId = window.$GRAPHENE.query(data, queryFieldsForLogger, handleResults, displayId)
      } catch (error) {
        chartError = error instanceof Error ? error : new Error(String(error))
      }
    } else {
      loaded = data
      registerChartExport()
    }
  })

  onDestroy(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
    window.$GRAPHENE.unsubscribe(handleResults)
    delete window.$GRAPHENE.chartExports?.[displayId]
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
      window.$GRAPHENE?.renderStart?.(`chart:${chart.id}`)
      renderChart()
      chartError = null
      window.$GRAPHENE?.renderComplete?.(`chart:${chart.id}`)
    } catch (error) {
      console.error('Chart failed to render', error)
      chartError = error instanceof Error ? error : new Error(String(error))
      chartLogger.error(chartError, {componentId: displayId})
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
    let rows = structuredClone(loaded.rows || [])
    let fields = structuredClone(loaded.fields || [])
    cloned.legendSelection = chart.getOption()?.legend?.[0]?.selected
    let enriched = enrich(cloned, rows, fields)

    chartTitle = enriched.title.find(t => t?.text)?.text
    chartSizeStyle = calculateChartSize(enriched, rows, fields)
    chart.setOption({...enriched, animation: false, animationDuration: 0, animationDurationUpdate: 0}, true)
  }

  function destroyChart() {
    if (!chart) return
    chart.off('legendselectchanged', renderChart)
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
      if (!fields[attr].includes(value)) fields[attr].push(value)
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

  function calculateChartSize(config?: NormalConfig, rows: Record<string, any>[] = [], fields: any[] = []) {
    let threshold = 8 // over this many bars, start to grow
    let resolvedHeight: string | number = height ?? '320px'
    let barSeries = config?.series.find(s => s.type == 'bar')
    let categoricalY = config?.yAxis[0]?.type == 'category'

    if (config && barSeries && categoricalY) {
      let distinctX = horizontalBarCount(config, rows, fields)
      if (distinctX > threshold) resolvedHeight = 320 * Math.max(1, distinctX / threshold)
    }

    return `height:${toDim(resolvedHeight)};width:${toDim(width ?? '100%')};`
  }

  function toDim(dim: string | number) {
    let t = typeof dim
    if (t == 'number' || (t == 'string' && (dim as string).match(/^\d+$/))) return `${dim}px`
    return dim
  }

  function registerChartExport() {
    if (!loaded || loaded.error) return
    window.$GRAPHENE.chartExports ||= {}
    window.$GRAPHENE.chartExports[displayId] = {rows: loaded.rows || [], fields: loaded.fields || []}
  }

  function downloadCsv() {
    if (!loaded || loaded.error) return

    let csv = rowsToCsv(loaded.rows || [], loaded.fields || [])
    let blob = new Blob([csv], {type: 'text/csv;charset=utf-8'})
    let url = URL.createObjectURL(blob)
    let link = document.createElement('a')
    link.href = url
    link.download = `${csvFileName(chartTitle || displayId || 'graphene-chart')}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function csvFileName(value: string) {
    let normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return normalized || 'graphene-chart'
  }

</script>

<div class="echarts" bind:this={node} style={chartSizeStyle} data-component-id={mountedComponentId} data-chart-title={chartTitle}>
  {#if loaded && !loaded.error && !chartError}
    <button class="csv-download" type="button" aria-label="Download chart data as CSV" title="Download chart data as CSV" onclick={downloadCsv}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
    </button>
  {/if}
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

  .csv-download {
    position: absolute;
    top: -0.375rem;
    right: 1rem;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    color: #6b7280;
    background: transparent;
    border: 0;
    border-radius: 0.375rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease, color 120ms ease;
  }

  .echarts:hover .csv-download,
  .echarts:focus-within .csv-download,
  .csv-download:hover,
  .csv-download:focus-visible {
    opacity: 1;
  }

  .csv-download:hover,
  .csv-download:focus-visible {
    color: #111827;
  }

  .csv-download:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  .csv-download svg {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
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
