<script lang="ts">
  import echarts from '../component-utilities/echarts.js'
  import {createEventDispatcher} from 'svelte'
  import {getThemeStores} from './themeStores'

  const {activeAppearance} = getThemeStores()

  export let config: any
  export let height: string | number = '291px'
  export let width: string | number = '100%'
  export let data: any
  export let queryID: any = undefined
  export let renderer: 'canvas' | 'svg' | undefined = undefined
  export let echartsOptions: any
  export let seriesOptions: any
  export let seriesColors: any
  export let connectGroup: string | undefined = undefined
  export let xAxisLabelOverflow: 'truncate' | 'break' | undefined = undefined

  const dispatch = createEventDispatcher()
  const isBrowser = typeof window !== 'undefined'

  const toDimension = (dimension: string | number | undefined, fallback: string) => {
    if (typeof dimension === 'number') return `${dimension}px`
    if (!dimension) return fallback
    return dimension
  }
</script>

<div class="echarts-container">
  {#if !isBrowser}
    <div class="echarts-loading" style={`height:${toDimension(height, '240px')}`}>Loading…</div>
  {:else}
    <div
      class="echarts-chart"
      style={`height:${toDimension(height, '240px')};width:${toDimension(width, '100%')}`}
      use:echarts={{
        config,
        data,
        echartsOptions,
        seriesOptions,
        dispatch,
        renderer,
        connectGroup,
        xAxisLabelOverflow,
        seriesColors,
        theme: $activeAppearance,
      }}
    />
  {/if}
</div>

<style>
  .echarts-container {
    position: relative;
    margin: 8px 0;
  }

  .echarts-chart {
    width: 100%;
    overflow: visible;
    user-select: none;
  }

  .echarts-loading {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(209, 213, 219, 0.8);
    border-radius: 4px;
    background: rgba(249, 250, 251, 0.6);
    color: rgba(107, 114, 128, 0.95);
    font-size: 12px;
  }
</style>
