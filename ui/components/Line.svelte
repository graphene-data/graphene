<script lang="ts">
  import {getContext} from 'svelte'
  import type {Writable} from 'svelte/store'
  import {propKey, configKey} from '../component-utilities/chartContext.js'
  import getSeriesConfig from '../component-utilities/getSeriesConfig.js'
  import formatTitle from '../component-utilities/formatTitle.js'
  import getCompletedData from '../component-utilities/getCompletedData.js'
  import getYAxisIndex from '../component-utilities/getYAxisIndex.js'
  import {formatValue, getFormatObjectFromString} from '../component-utilities/formatting.js'
  import {getThemeStores} from '../component-utilities/themeStores'
  import {toBoolean} from '../component-utilities/convert'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'

  interface Props {
    y?: any, y2?: any, series?: any, options?: any, name?: any, lineColor?: any, lineWidth?: number
    lineType?: string, lineOpacity?: any, markers?: boolean | string, markerShape?: string
    markerSize?: number, labels?: boolean | string, labelSize?: number, labelPosition?: string
    labelColor?: any, labelFmt?: any, yLabelFmt?: any, y2LabelFmt?: any, showAllLabels?: boolean | string
    y2SeriesType?: any, handleMissing?: string, step?: boolean | string, stepPosition?: string
    seriesOrder?: any, seriesLabelFmt?: any
  }

  const {resolveColor} = getThemeStores()
  const chartProps: Writable<any> = getContext(propKey)
  const config: Writable<any> = getContext(configKey)

  let {
    y = undefined, y2 = undefined, series = undefined, options = undefined, name = undefined,
    lineColor = undefined, lineWidth = 2, lineType = 'solid', lineOpacity = undefined, markers = false,
    markerShape = 'circle', markerSize = 8, labels = false, labelSize = 11, labelPosition = 'top',
    labelColor = undefined, labelFmt = undefined, yLabelFmt = undefined, y2LabelFmt = undefined,
    showAllLabels = false, y2SeriesType = undefined, handleMissing = 'gap', step = false,
    stepPosition = 'end', seriesOrder = undefined, seriesLabelFmt = undefined,
  }: Props = $props()

  // Use $derived for values that depend on props
  let ySet = $derived(y ? true : false)
  let y2Set = $derived(y2 ? true : false)
  let seriesSet = $derived(series ? true : false)

  let lineColorStore = $derived(resolveColor(lineColor))
  let labelColorStore = $derived(resolveColor(labelColor))
  let markersBool = $derived(toBoolean(markers))
  let labelsBool = $derived(toBoolean(labels))
  let showAllLabelsBool = $derived(toBoolean(showAllLabels))
  let stepBool = $derived(toBoolean(step))

  // Format objects derived from props
  let labelFormat = $derived(labelFmt ? getFormatObjectFromString(labelFmt) : undefined)
  let yLabelFormat = $derived(yLabelFmt ? getFormatObjectFromString(yLabelFmt) : undefined)
  let y2LabelFormat = $derived(y2LabelFmt ? getFormatObjectFromString(y2LabelFmt) : undefined)

  const labelPositions = {above: 'top', below: 'bottom', middle: 'inside'}
  const swapXYLabelPositions = {above: 'right', below: 'left', middle: 'inside'}

  // Derive values from chartProps store instead of using $effect to assign
  let data = $derived($chartProps.data)
  let x = $derived($chartProps.x)
  let swapXY = $derived($chartProps.swapXY)
  let yFormat = $derived($chartProps.yFormat)
  let y2Format = $derived($chartProps.y2Format)
  let yCount = $derived($chartProps.yCount)
  let y2Count = $derived($chartProps.y2Count)
  let xType = $derived($chartProps.xType)
  let xMismatch = $derived($chartProps.xMismatch)
  let columnSummary = $derived($chartProps.columnSummary)
  let resolvedSeries = $derived(seriesSet ? series : $chartProps.series)
  let resolvedY = $derived(ySet ? parseCommaList(y) : $chartProps.y)
  let resolvedY2 = $derived(y2Set ? parseCommaList(y2) : $chartProps.y2)
  let resolvedSeriesOrder = $derived(parseCommaList(seriesOrder))

  // Compute all the derived state in one $derived.by block to avoid read/write conflicts
  let computedState = $derived.by(() => {
    let isSingleSeries = !resolvedSeries && (!Array.isArray(resolvedY) || resolvedY.length === 1)
    let computedData = data
    let computedName = name
    let computedDefaultLabelPosition = swapXY ? 'right' : 'top'

    if (!data || !columnSummary) {
      return {
        data: computedData,
        name: computedName,
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
      try {
        computedData = getCompletedData(computedData, x, resolvedY, resolvedSeries)
      } catch (error) {
        globalThis.console?.warn('Failed to complete data', {error})
        computedData = []
      }
    }

    // Handle missing values
    if (handleMissing === 'zero') {
      try {
        computedData = getCompletedData(computedData, x, resolvedY, resolvedSeries, true)
      } catch (error) {
        globalThis.console?.warn('Failed to complete data', {error})
        computedData = []
      }
    }

    return {
      data: computedData,
      name: computedName,
      defaultLabelPosition: computedDefaultLabelPosition,
    }
  })

  // Extract computed values for use in template and other derived values
  let processedData = $derived(computedState.data)
  let resolvedName = $derived(computedState.name)
  let defaultLabelPosition = $derived(computedState.defaultLabelPosition)

  let resolvedLabelPosition = $derived(
    (swapXY ? swapXYLabelPositions[labelPosition] : labelPositions[labelPosition]) ?? defaultLabelPosition,
  )

  let chartOverrides = $derived({
    yAxis: {boundaryGap: ['0%', '1%']},
    xAxis: {boundaryGap: [xType === 'time' ? '2%' : '0%', '2%']},
  })

  $effect(() => {
    // Don't run until we have data
    if (!processedData || !columnSummary) return

    let baseConfig = {
      type: 'line',
      label: {
        show: labelsBool,
        formatter: (params: any) =>
          params.value[swapXY ? 0 : 1] === 0
            ? ''
            : formatValue(
              params.value[swapXY ? 0 : 1],
              [yLabelFormat ?? labelFormat ?? yFormat, y2LabelFormat ?? labelFormat ?? y2Format][
                getYAxisIndex(params.componentIndex, yCount, y2Count)
              ],
            ),
        fontSize: labelSize,
        color: $labelColorStore,
        position: resolvedLabelPosition,
        padding: 3,
      },
      labelLayout: {hideOverlap: showAllLabelsBool ? false : true},
      connectNulls: handleMissing === 'connect',
      emphasis: {
        focus: 'series',
        endLabel: {show: false},
        lineStyle: {opacity: 1, width: 3},
      },
      lineStyle: {width: parseInt(lineWidth as string), type: lineType, opacity: lineOpacity},
      itemStyle: {color: $lineColorStore, opacity: lineOpacity},
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
      resolvedY2,
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

    if (!chartOverrides) return
    config.update((d: any) => {
      if (!d.yAxis || !Array.isArray(d.yAxis)) return d
      if (swapXY) {
        d.yAxis = {...d.yAxis, ...chartOverrides.xAxis}
        d.xAxis = {...d.xAxis, ...chartOverrides.yAxis}
        if (labelsBool) d.axisPointer = {triggerEmphasis: false}
        return d
      }
      if (d.yAxis[0]) d.yAxis[0] = {...d.yAxis[0], ...chartOverrides.yAxis}
      d.xAxis = {...d.xAxis, ...chartOverrides.xAxis}
      if (y2Count > 0 && d.yAxis[1]) {
        d.yAxis[1] = {...d.yAxis[1], show: true}
        let shouldSetY2Type = y2SeriesType && ['line', 'bar', 'scatter'].includes(y2SeriesType) && d.series
        for (let i = 0; shouldSetY2Type && i < y2Count; i++) {
          if (d.series[yCount + i]) d.series[yCount + i].type = y2SeriesType
        }
      }
      if (labelsBool) d.axisPointer = {triggerEmphasis: false}
      return d
    })
  })
</script>
