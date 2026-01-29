<script lang="ts">
  import {getContext} from 'svelte'
  import type {Writable} from 'svelte/store'
  import {propKey, configKey} from '../component-utilities/chartContext.js'
  import getSeriesConfig from '../component-utilities/getSeriesConfig.js'
  import formatTitle from '../component-utilities/formatTitle.js'
  import replaceNulls from '../component-utilities/replaceNulls.js'
  import getCompletedData from '../component-utilities/getCompletedData.js'
  import {formatValue, getFormatObjectFromString} from '../component-utilities/formatting.js'
  import {getThemeStores} from '../component-utilities/themeStores'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'

  interface Props {
    y?: any, series?: any, options?: any, name?: any, type?: string, fillColor?: any, lineColor?: any
    fillOpacity?: any, line?: boolean | string, markers?: boolean | string, markerShape?: string
    markerSize?: number, handleMissing?: string, step?: boolean | string, stepPosition?: string
    labels?: boolean | string, labelSize?: number, labelPosition?: string, labelColor?: any
    labelFmt?: any, showAllLabels?: boolean | string, seriesOrder?: any, seriesLabelFmt?: any
  }

  const {resolveColor} = getThemeStores()
  const chartProps: Writable<any> = getContext(propKey)
  const config: Writable<any> = getContext(configKey)

  let {
    y = undefined, series = undefined, options = undefined, name = undefined, type = 'stacked',
    fillColor = undefined, lineColor = undefined, fillOpacity = undefined, line = true, markers = false,
    markerShape = 'circle', markerSize = 8, handleMissing = 'gap', step = false, stepPosition = 'end',
    labels = false, labelSize = 11, labelPosition = 'top', labelColor = undefined, labelFmt = undefined,
    showAllLabels = false, seriesOrder = undefined, seriesLabelFmt = undefined,
  }: Props = $props()

  // Use $derived for values that depend on props
  let ySet = $derived(y ? true : false)
  let seriesSet = $derived(series ? true : false)

  let fillColorStore = $derived(resolveColor(fillColor))
  let lineColorStore = $derived(resolveColor(lineColor))
  let lineBool = $derived(line === 'true' || line === true)
  let markersBool = $derived(markers === 'true' || markers === true)
  let stepBool = $derived(step === 'true' || step === true)
  let labelsBool = $derived(labels === 'true' || labels === true)
  let labelColorStore = $derived(resolveColor(labelColor))

  // Format objects derived from props
  let labelFormat = $derived(labelFmt ? getFormatObjectFromString(labelFmt) : undefined)

  const labelPositions = {above: 'top', below: 'bottom', middle: 'inside'}
  const swapXYLabelPositions = {above: 'right', below: 'left', middle: 'inside'}

  // Derive values from chartProps store instead of using $effect to assign
  let data = $derived($chartProps.data)
  let x = $derived($chartProps.x)
  let swapXY = $derived($chartProps.swapXY)
  let yFormat = $derived($chartProps.yFormat)
  let baseXType = $derived($chartProps.xType)
  let xMismatch = $derived($chartProps.xMismatch)
  let columnSummary = $derived($chartProps.columnSummary)
  let resolvedSeries = $derived(seriesSet ? series : $chartProps.series)
  let resolvedY = $derived(ySet ? parseCommaList(y) : $chartProps.y)
  let resolvedSeriesOrder = $derived(parseCommaList(seriesOrder))

  // Compute all the derived state in one $derived.by block to avoid read/write conflicts
  let computedState = $derived.by(() => {
    let isSingleSeries = !resolvedSeries && (!Array.isArray(resolvedY) || resolvedY.length === 1)
    let computedData = data
    let computedXType = baseXType
    let computedName = name
    let computedStackName: string | undefined = undefined
    let computedDefaultLabelPosition = swapXY ? 'right' : 'top'

    if (!data || !columnSummary) {
      return {
        data: computedData,
        xType: computedXType,
        name: computedName,
        stackName: computedStackName,
        defaultLabelPosition: computedDefaultLabelPosition,
      }
    }

    if (isSingleSeries) {
      // Single Series
      let col = Array.isArray(resolvedY) ? resolvedY[0] : resolvedY
      if (col && columnSummary[col]) {
        computedName = computedName ?? formatTitle(col, columnSummary[col].title)
      }
    } else {
      // Multi Series
      computedStackName = 'area'
      computedData = getCompletedData(computedData, x, resolvedY, resolvedSeries, false, computedXType === 'value')
      computedData = replaceNulls(computedData, resolvedY)
      computedXType = computedXType === 'value' ? 'category' : computedXType
    }

    // Handle missing values
    if (handleMissing === 'zero') {
      computedData = replaceNulls(computedData, resolvedY)
    }

    return {
      data: computedData,
      xType: computedXType,
      name: computedName,
      stackName: computedStackName,
      defaultLabelPosition: computedDefaultLabelPosition,
    }
  })

  // Extract computed values for use in template and other derived values
  let processedData = $derived(computedState.data)
  let xType = $derived(computedState.xType)
  let resolvedName = $derived(computedState.name)
  let resolvedStackName = $derived(computedState.stackName)
  let defaultLabelPosition = $derived(computedState.defaultLabelPosition)

  let resolvedLabelPosition = $derived(
    (swapXY ? swapXYLabelPositions[labelPosition] : labelPositions[labelPosition]) ?? defaultLabelPosition,
  )

  let chartOverrides = $derived({
    yAxis: {boundaryGap: ['0%', '1%']},
    xAxis: {boundaryGap: ['4%', '4%'], type: xType},
  })

  $effect(() => {
    // Don't run until we have data
    if (!processedData || !columnSummary) return

    let baseConfig = {
      type: 'line',
      stack: resolvedStackName,
      areaStyle: {color: $fillColorStore, opacity: fillOpacity},
      connectNulls: handleMissing === 'connect',
      lineStyle: {width: lineBool ? 1 : 0, color: $lineColorStore},
      label: {
        show: labelsBool,
        formatter: (params: any) =>
          params.value[swapXY ? 0 : 1] === 0
            ? ''
            : formatValue(params.value[swapXY ? 0 : 1], labelFormat ?? yFormat),
        fontSize: labelSize,
        color: $labelColorStore,
        position: resolvedLabelPosition,
        padding: 3,
      },
      labelLayout: {hideOverlap: showAllLabels ? false : true},
      emphasis: {focus: 'series'},
      showSymbol: labelsBool || markersBool,
      symbol: markerShape,
      symbolSize: labelsBool && !markersBool ? 0 : markerSize,
      step: stepBool ? stepPosition : false,
    }

    let seriesConfig = getSeriesConfig(
      processedData,
      x,
      resolvedY,
      resolvedSeries,
      swapXY,
      baseConfig,
      resolvedName,
      xMismatch,
      columnSummary,
      resolvedSeriesOrder,
      undefined,
      undefined,
      undefined,
      seriesLabelFmt,
    )

    config.update((d: any) => {
      // Guard against incomplete config state
      if (!d.series) d.series = []
      if (!d.legend) d.legend = {data: []}
      if (!d.legend.data) d.legend.data = []

      d.series.push(...seriesConfig)
      d.legend.data.push(...seriesConfig.map((entry: any) => entry.name.toString()))
      return d
    })
  })

  // Use $effect.pre() instead of beforeUpdate for runes mode
  $effect.pre(() => {
    if (options) {
      config.update((d: any) => ({...d, ...options}))
    }

    if (chartOverrides) {
      config.update((d: any) => {
        // Guard against incomplete config state
        if (!d.yAxis || !Array.isArray(d.yAxis)) return d

        d.tooltip = {...d.tooltip, order: 'seriesDesc'}
        if (swapXY) {
          d.yAxis = {...d.yAxis, ...chartOverrides.xAxis}
          d.xAxis = {...d.xAxis, ...chartOverrides.yAxis}
        } else {
          if (d.yAxis[0]) {
            d.yAxis[0] = {...d.yAxis[0], ...chartOverrides.yAxis}
          }
          d.xAxis = {...d.xAxis, ...chartOverrides.xAxis}
        }
        if (type === 'stacked100') {
          if (swapXY) d.xAxis = {...d.xAxis, max: 1}
          else if (d.yAxis[0]) d.yAxis[0] = {...d.yAxis[0], max: 1}
        }
        if (labelsBool) d.axisPointer = {triggerEmphasis: false}
        return d
      })
    }
  })
</script>
