<script lang="ts">
  import echarts from '../component-utilities/echarts.js'
  import {getThemeStores} from '../component-utilities/themeStores'

  interface Props {
    config: any
    height?: string | number
    width?: string | number
    data: any
    queryID?: any
    renderer?: 'canvas' | 'svg'
    echartsOptions?: any
    seriesOptions?: any
    seriesColors?: any
    connectGroup?: string
    xAxisLabelOverflow?: 'truncate' | 'break'
    showAllXAxisLabels?: boolean
    swapXY?: boolean
    chartTitle?: string
    onclick?: (params: any) => void
  }

  const {activeAppearance} = getThemeStores()

  let {
    config, height = '240px', width = '100%', data, queryID = undefined, renderer = undefined,
    echartsOptions = undefined, seriesOptions = undefined, seriesColors = undefined,
    connectGroup = undefined, xAxisLabelOverflow = undefined, showAllXAxisLabels = undefined,
    swapXY = undefined, chartTitle = undefined, onclick = undefined,
  }: Props = $props()

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
      data-chart-title={chartTitle ?? undefined}
      data-query-id={queryID}
      style={`height:${toDimension(height, '240px')};width:${toDimension(width, '100%')}`}
      use:echarts={{
        config,
        data,
        echartsOptions,
        seriesOptions,
        onclick,
        renderer,
        connectGroup,
        xAxisLabelOverflow,
        showAllXAxisLabels,
        swapXY,
        seriesColors,
        theme: $activeAppearance,
      }}
    ></div>
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
