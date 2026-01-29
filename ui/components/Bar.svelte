<script lang="ts">
  import {getContext} from 'svelte'
  import {propKey, configKey} from '../component-utilities/chartContext.js'
  import type {Writable} from 'svelte/store'
  import getSeriesConfig from '../component-utilities/getSeriesConfig.js'
  import getStackedData from '../component-utilities/getStackedData.js'
  import getSortedData from '../component-utilities/getSortedData.js'
  import formatTitle from '../component-utilities/formatTitle.js'
  import getCompletedData from '../component-utilities/getCompletedData.js'
  import getYAxisIndex from '../component-utilities/getYAxisIndex.js'
  import {formatValue, getFormatObjectFromString} from '../component-utilities/formatting.js'
  import {getThemeStores} from '../component-utilities/themeStores'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'

  interface Props {
    y?: any, y2?: any, series?: any, options?: any, name?: any, type?: string, stackName?: any
    fillColor?: any, fillOpacity?: any, outlineColor?: any, outlineWidth?: any
    labels?: boolean | string, seriesLabels?: boolean | string, labelSize?: number
    labelPosition?: string, labelColor?: any, labelFmt?: any, yLabelFmt?: any, y2LabelFmt?: any
    y2SeriesType?: string, stackTotalLabel?: boolean | string, showAllLabels?: boolean | string
    seriesOrder?: any, seriesLabelFmt?: any
  }

  const chartProps: Writable<any> = getContext(propKey)
  const config: Writable<any> = getContext(configKey)
  const {resolveColor} = getThemeStores()

  let {
    y = undefined, y2 = undefined, series = undefined, options = undefined, name = undefined,
    type = 'stacked', stackName = undefined, fillColor = undefined, fillOpacity = undefined,
    outlineColor = undefined, outlineWidth = undefined, labels = false, seriesLabels = true,
    labelSize = 11, labelPosition = undefined, labelColor = undefined, labelFmt = undefined,
    yLabelFmt = undefined, y2LabelFmt = undefined, y2SeriesType = 'bar', stackTotalLabel = true,
    showAllLabels = false, seriesOrder = undefined, seriesLabelFmt = undefined,
  }: Props = $props()

  // Use $derived for values that depend on props
  let ySet = $derived(y ? true : false)
  let y2Set = $derived(y2 ? true : false)
  let seriesSet = $derived(series ? true : false)

  let fillColorStore = $derived(resolveColor(fillColor))
  let outlineColorStore = $derived(resolveColor(outlineColor))
  let labelColorStore = $derived(resolveColor(labelColor))
  let labelsBool = $derived(labels === 'true' || labels === true)
  let seriesLabelsBool = $derived(seriesLabels === 'true' || seriesLabels === true)
  let stackTotalLabelBool = $derived(stackTotalLabel === 'true' || stackTotalLabel === true)

  // Format objects derived from props
  let labelFormat = $derived(labelFmt ? getFormatObjectFromString(labelFmt) : undefined)
  let yLabelFormat = $derived(yLabelFmt ? getFormatObjectFromString(yLabelFmt) : undefined)
  let y2LabelFormat = $derived(y2LabelFmt ? getFormatObjectFromString(y2LabelFmt) : undefined)

  let barMaxWidth = 60

  // Derive values from chartProps store instead of using $effect to assign
  let data = $derived($chartProps.data)
  let x = $derived($chartProps.x)
  let resolvedY = $derived(ySet ? parseCommaList(y) : $chartProps.y)
  let resolvedY2 = $derived(y2Set ? parseCommaList(y2) : $chartProps.y2)
  let yFormat = $derived($chartProps.yFormat)
  let y2Format = $derived($chartProps.y2Format)
  let yCount = $derived($chartProps.yCount)
  let y2Count = $derived($chartProps.y2Count)
  let swapXY = $derived($chartProps.swapXY)
  let baseXType = $derived($chartProps.xType)
  let xMismatch = $derived($chartProps.xMismatch)
  let columnSummary = $derived($chartProps.columnSummary)
  let sort = $derived($chartProps.sort)
  let resolvedSeries = $derived(seriesSet ? series : $chartProps.series)
  let resolvedSeriesOrder = $derived(parseCommaList(seriesOrder))

  // Value label positions:
  const labelPositions = {
    outside: 'top',
    inside: 'inside',
  }

  const swapXYLabelPositions = {
    outside: 'right',
    inside: 'inside',
  }

  // Compute all the derived state in one $derived.by block to avoid read/write conflicts
  let computedState = $derived.by(() => {
    let isSingleSeries = !resolvedSeries && (!Array.isArray(resolvedY) || resolvedY.length === 1)
    let computedData = data
    let computedXType = baseXType
    let computedName = name
    let computedStackName = stackName
    let computedDefaultLabelPosition = swapXY ? 'right' : 'top'
    let computedStackTotalSeries: any[] = []

    if (!data || !columnSummary) {
      return {
        data: computedData,
        xType: computedXType,
        name: computedName,
        stackName: computedStackName,
        defaultLabelPosition: computedDefaultLabelPosition,
        stackTotalSeries: computedStackTotalSeries,
      }
    }

    if (isSingleSeries) {
      // Single Series
      let col = Array.isArray(resolvedY) ? resolvedY[0] : resolvedY
      if (col && columnSummary[col]) {
        computedName = computedName ?? formatTitle(col, columnSummary[col].title)
      }

      if (swapXY && computedXType !== 'category') {
        computedData = getCompletedData(computedData, x, resolvedY, resolvedSeries, true, computedXType !== 'time')
        computedXType = 'category'
      }

      computedStackName = 'stack1'
      computedDefaultLabelPosition = swapXY ? 'right' : 'top'
    } else {
      // Multi Series
      // Sort by stack total for category axis
      if (sort === true && computedXType === 'category') {
        let stackedData = getStackedData(computedData, x, resolvedY)

        if (Array.isArray(resolvedY) && resolvedY.length > 1) {
          stackedData = getSortedData(stackedData, 'stackTotal', false)
        } else {
          let col = Array.isArray(resolvedY) ? resolvedY[0] : resolvedY
          stackedData = getSortedData(stackedData, col, false)
        }

        let sortOrder = stackedData.map((d: any) => d[x])
        computedData = [...computedData].sort(function (a: any, b: any) {
          return sortOrder.indexOf(a[x]) - sortOrder.indexOf(b[x])
        })
      }

      // Run fill for missing series entries, only if it's a stacked bar
      if (swapXY || ((computedXType === 'value' || computedXType === 'category') && type.includes('stacked'))) {
        computedData = getCompletedData(computedData, x, resolvedY, resolvedSeries, true, computedXType === 'value')
        computedXType = 'category'
      } else if (computedXType === 'time' && type.includes('stacked')) {
        computedData = getCompletedData(computedData, x, resolvedY, resolvedSeries, true, true)
      }

      if (type.includes('stacked')) {
        computedStackName = computedStackName ?? 'stack1'
        computedDefaultLabelPosition = 'inside'
      } else {
        computedStackName = undefined
        computedDefaultLabelPosition = swapXY ? 'right' : 'top'
      }
    }

    // Compute stack total series for stacked charts
    if (type === 'stacked' && computedData) {
      computedStackTotalSeries = getStackedData(computedData, x, resolvedY)
    }

    return {
      data: computedData,
      xType: computedXType,
      name: computedName,
      stackName: computedStackName,
      defaultLabelPosition: computedDefaultLabelPosition,
      stackTotalSeries: computedStackTotalSeries,
    }
  })

  // Extract computed values for use in template and other derived values
  let processedData = $derived(computedState.data)
  let xType = $derived(computedState.xType)
  let resolvedName = $derived(computedState.name)
  let resolvedStackName = $derived(computedState.stackName)
  let defaultLabelPosition = $derived(computedState.defaultLabelPosition)
  let stackTotalSeries = $derived(computedState.stackTotalSeries)

  let resolvedLabelPosition = $derived(
    (swapXY ? swapXYLabelPositions[labelPosition] : labelPositions[labelPosition]) ?? defaultLabelPosition,
  )

  $effect(() => {
    // Don't run until we have data
    if (!processedData || !columnSummary) return

    let baseConfig = {
      type: 'bar',
      stack: resolvedStackName,
      label: {
        show: labelsBool && seriesLabelsBool,
        formatter: function (params: any) {
          return params.value[swapXY ? 0 : 1] === 0
            ? ''
            : formatValue(
              params.value[swapXY ? 0 : 1],
              [yLabelFormat ?? labelFormat ?? yFormat, y2LabelFormat ?? labelFormat ?? y2Format][
                getYAxisIndex(params.componentIndex, yCount, y2Count)
              ],
            )
        },
        position: resolvedLabelPosition,
        fontSize: labelSize,
        color: $labelColorStore,
      },
      labelLayout: {
        hideOverlap: showAllLabels ? false : true,
      },
      emphasis: {
        focus: 'series',
      },
      barMaxWidth: barMaxWidth,
      itemStyle: {
        color: $fillColorStore,
        opacity: fillOpacity,
        borderColor: $outlineColorStore,
        borderWidth: outlineWidth,
      },
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
      // Push series into legend:
      d.legend.data.push(...seriesConfig.map((s: any) => s.name.toString()))

      // Stacked chart total label:
      // series !== x is to avoid an issue where same column is used for both - stackTotalLabel can't handle that
      if (
        labelsBool === true &&
        type === 'stacked' &&
        ((Array.isArray(resolvedY) && resolvedY.length > 1) || (resolvedSeries !== undefined)) &&
        stackTotalLabelBool === true &&
        resolvedSeries !== x
      ) {
        // push stack total series for total label
        d.series.push({
          type: 'bar',
          stack: resolvedStackName,
          name: 'stackTotal',
          color: 'none',
          data: stackTotalSeries.map((row: any) => {
            let axisValue = xMismatch ? row[x].toString() : row[x]
            if (swapXY) return [0, axisValue]
            return [axisValue, 0]
          }),
          label: {
            show: true,
            position: swapXY ? 'right' : 'top',
            formatter: function (params: any) {
              let sum = 0
              seriesConfig.forEach((s: any) => {
                sum += s.data[params.dataIndex][swapXY ? 0 : 1]
              })
              return sum === 0 ? '' : formatValue(sum, labelFormat ?? yFormat)
            },
            fontWeight: 'bold',
            fontSize: labelSize,
            padding: swapXY ? [0, 0, 0, 5] : undefined,
          },
        })

        // disable legend selected mode when stackTotalLabel is displayed:
        d.legend.selectedMode = false
      }
      return d
    })
  })

  let chartOverrides = $derived({
    // Evidence definition of axes (yAxis = dependent, xAxis = independent)
    xAxis: {
      boundaryGap: ['1%', '2%'],
      type: xType,
    },
  })

  // Use $effect.pre() instead of beforeUpdate for runes mode
  $effect.pre(() => {
    // This ensures that these overrides always run before we render the chart.
    // otherwise, this block won't re-execute after a change to the data object, and
    // the chart will re-render using the base config from Chart.svelte

    if (options) {
      config.update((d: any) => {
        return {...d, ...options}
      })
    }

    if (chartOverrides) {
      config.update((d: any) => {
        // Guard against incomplete config state
        if (!d.yAxis || !Array.isArray(d.yAxis)) return d

        if (type.includes('stacked')) {
          d.tooltip = {...d.tooltip, order: 'seriesDesc'}
        } else {
          d.tooltip = {...d.tooltip, order: 'seriesAsc'}
        }
        if (type === 'stacked100') {
          if (swapXY) {
            d.xAxis = {...d.xAxis, max: 1}
          } else if (d.yAxis[0]) {
            d.yAxis[0] = {...d.yAxis[0], max: 1}
          }
        }
        if (swapXY) {
          d.yAxis = {...d.yAxis, ...chartOverrides.xAxis}
          d.xAxis = {...d.xAxis}
        } else {
          if (d.yAxis[0]) {
            d.yAxis[0] = {...d.yAxis[0]}
          }
          d.xAxis = {...d.xAxis, ...chartOverrides.xAxis}
          if (y2Count > 0 && d.yAxis[1]) {
            d.yAxis[1] = {...d.yAxis[1], show: true}
            if (['line', 'bar', 'scatter'].includes(y2SeriesType) && d.series) {
              for (let i = 0; i < y2Count; i++) {
                if (d.series[yCount + i]) {
                  d.series[yCount + i].type = y2SeriesType
                  d.series[yCount + i].stack = undefined
                }
              }
            }
          }
        }
        return d
      })
    }
  })
</script>
