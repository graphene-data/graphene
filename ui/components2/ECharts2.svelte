<script lang="ts">
  import {init} from 'echarts6/dist/echarts.esm.js'
  import {onDestroy} from 'svelte'
  import ErrorDisplay from '../internal/ErrorDisplay.svelte'
  import * as chartWindowDebug from '../component-utilities/chartWindowDebug.js'
  import {enrich} from './enrich.ts'
  import type {EChartsConfig2, Field} from './types.ts'

  interface Props {
    config: EChartsConfig2
    rows: any[]
    fields?: Field[]
    height?: string | number
    width?: string | number
    queryID?: any
    chartTitle?: string
    renderer?: 'canvas' | 'svg'
  }

  let {
    config,
    rows,
    fields = [],
    height = '240px',
    width = '100%',
    queryID = undefined,
    chartTitle = undefined,
    renderer = 'svg',
  }: Props = $props()

  let node: HTMLDivElement | null = $state(null)
  let chart: any = $state(null)

  let chartState = $derived.by(() => {
    try {
      let cloned = structuredClone(config)
      enrich(cloned, rows, fields)
      return {config: cloned, error: null as Error | null}
    } catch (error: any) {
      return {config: null, error: error instanceof Error ? error : new Error(String(error))}
    }
  })

  $effect(() => {
    if (!node) return
    if (chartState.error || !chartState.config) {
      destroyChart()
      return
    }

    chart ||= init(node, undefined, {renderer})
    chartWindowDebug.set(String(chart.id), chart)

    let chartId = chart.id
    window.$GRAPHENE?.renderStart?.(`chart:${chartId}`)
    try {
      chart.setOption({...chartState.config, animation: false, animationDuration: 0, animationDurationUpdate: 0}, true)
    } finally {
      window.$GRAPHENE?.renderComplete?.(`chart:${chartId}`)
    }
  })

  onDestroy(() => destroyChart())

  function destroyChart() {
    if (!chart) return
    chartWindowDebug.unset(String(chart.id))
    chart.dispose()
    chart = null
  }

  function toDimension(dimension: string | number | undefined, fallback: string) {
    if (typeof dimension === 'number') return `${dimension}px`
    if (!dimension) return fallback
    return dimension
  }
</script>

{#if chartState?.error}
  <ErrorDisplay error={chartState.error} />
{:else}
  <div class="echarts2-container">
    <div
      class="echarts2-chart"
      data-chart-title={chartTitle ?? undefined}
      data-query-id={queryID}
      style={`height:${toDimension(height, '240px')};width:${toDimension(width, '100%')}`}
      bind:this={node}
    ></div>
  </div>
{/if}

<style>
  .echarts2-container {
    position: relative;
    margin: 8px 0;
  }

  .echarts2-chart {
    width: 100%;
    overflow: visible;
    user-select: none;
  }
</style>
