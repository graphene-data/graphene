<script lang="ts">
  import {setContext, type Snippet} from 'svelte'
  import {type Writable, writable, get} from 'svelte/store'
  import {propKey, configKey} from '../component-utilities/chartContext.js'
  import ECharts from './ECharts.svelte'
  import getColumnSummary from '../component-utilities/getColumnSummary.js'
  import getDistinctValues from '../component-utilities/getDistinctValues.js'
  import getDistinctCount from '../component-utilities/getDistinctCount.js'
  import getStackPercentages from '../component-utilities/getStackPercentages.js'
  import getSortedData from '../component-utilities/getSortedData.js'
  import getYAxisIndex from '../component-utilities/getYAxisIndex.js'
  import {standardizeDateColumn} from '../component-utilities/dateParsing.js'
  import {formatAxisValue, formatValue, getFormatObjectFromString} from '../component-utilities/formatting.js'
  import formatTitle from '../component-utilities/formatTitle.js'
  import ErrorChart from './ErrorChart.svelte'
  import checkInputs from '../component-utilities/checkInputs.js'
  import {getThemeStores} from '../component-utilities/themeStores'
  import {toBoolean} from '../component-utilities/convert'
  import {parseCommaList} from '../component-utilities/inputUtils.ts'
  import {logError} from '../internal/telemetry.ts'

  interface Props {
    data?: any, chartContext?: any, queryID?: any, x?: any, y?: any, y2?: any, series?: any, size?: any
    tooltipTitle?: any, showAllXAxisLabels?: any, swapXY?: boolean | string, title?: string, subtitle?: string
    chartType?: string, bubble?: boolean, hist?: boolean, boxplot?: boolean, xType?: string
    xAxisTitle?: string, xBaseline?: boolean | string, xTickMarks?: boolean | string
    xGridlines?: boolean | string, xAxisLabels?: boolean | string, sort?: boolean | string, xFmt?: any
    xMin?: any, xMax?: any, yLog?: boolean | string, yType?: string, yLogBase?: number, yAxisTitle?: string
    yBaseline?: boolean | string, yTickMarks?: boolean | string, yGridlines?: boolean | string
    yAxisLabels?: boolean | string, yMin?: any, yMax?: any, yScale?: boolean | string, yFmt?: any
    yAxisColor?: string, y2AxisTitle?: string, y2Baseline?: boolean | string, y2TickMarks?: boolean | string
    y2Gridlines?: boolean | string, y2AxisLabels?: boolean | string, y2Min?: any, y2Max?: any
    y2Scale?: boolean | string, y2Fmt?: any, y2AxisColor?: string, sizeFmt?: any, colorPalette?: string
    legend?: any, echartsOptions?: any, seriesOptions?: any, seriesColors?: any, stackType?: string
    stacked100?: boolean, chartAreaHeight?: any, connectGroup?: string, leftPadding?: any, rightPadding?: any
    xLabelWrap?: boolean | string, children?: Snippet
  }

  // Note: renamed from 'props' to 'chartProps' to avoid conflict with $props() rune
  let chartProps = writable({})
  let config: Writable<any> = writable({})

  setContext(propKey, chartProps)
  setContext(configKey, config)

  const {theme, resolveColor, resolveColorsObject, resolveColorPalette} = getThemeStores()

  let {
    data = undefined, chartContext = undefined, queryID = undefined, x = undefined, y = undefined,
    y2 = undefined, series = undefined, size = undefined, tooltipTitle = undefined,
    showAllXAxisLabels = undefined, swapXY = false, title = undefined, subtitle = undefined,
    chartType = 'Chart', bubble = false, hist = false, boxplot = false, xType = undefined,
    xAxisTitle = 'false', xBaseline = true, xTickMarks = false, xGridlines = false, xAxisLabels = true,
    sort = true, xFmt = undefined, xMin = undefined, xMax = undefined, yLog = false, yType = undefined,
    yLogBase = 10, yAxisTitle = 'false', yBaseline = false, yTickMarks = false, yGridlines = true,
    yAxisLabels = true, yMin = undefined, yMax = undefined, yScale = false, yFmt = undefined,
    yAxisColor = 'true', y2AxisTitle = 'false', y2Baseline = false, y2TickMarks = false,
    y2Gridlines = true, y2AxisLabels = true, y2Min = undefined, y2Max = undefined, y2Scale = false,
    y2Fmt = undefined, y2AxisColor = 'true', sizeFmt = undefined, colorPalette = 'default',
    legend = undefined, echartsOptions = undefined, seriesOptions = undefined, seriesColors = undefined,
    stackType = undefined, stacked100 = false, chartAreaHeight = undefined, connectGroup = undefined,
    leftPadding = undefined, rightPadding = undefined, xLabelWrap = false, children,
  }: Props = $props()

  // This should be reworked to fit better with svelte's reactivity.

  // We rewrite the x and y values with fallbacks if they aren't present
  // the fallback logic *depends* on the values of x and y
  // when x and y are replaced by the fallbacks, the fallback logic doesn't reset.
  // if the y value isn't set, var y gets populated with a fall back from the data.
  // if the data changes, we are now acting as if the fallback from above was entered by the user, and
  // then we throw if the fallback column is now missing.

  // This is a hack to get around the above
  // Track whether x/y were initially set (not using fallbacks)
  // These capture the initial values intentionally - they're set once on mount
  // and updated in the effect. Using closure pattern to silence state_referenced_locally warning.
  let ySet = $state((() => y ? true : false)())
  // const y2Set = y2 ? true : false;
  let xSet = $state((() => x ? true : false)())

  // Convert boolean string props to actual booleans
  let swapXY_bool = $derived(toBoolean(swapXY))
  let xBaseline_bool = $derived(toBoolean(xBaseline))
  let xTickMarks_bool = $derived(toBoolean(xTickMarks))
  let xGridlines_bool = $derived(toBoolean(xGridlines))
  let xAxisLabels_bool = $derived(toBoolean(xAxisLabels))
  let sort_bool = $derived(toBoolean(sort))
  let yLog_bool = $derived(toBoolean(yLog))
  let yBaseline_bool = $derived(toBoolean(yBaseline))
  let yTickMarks_bool = $derived(toBoolean(yTickMarks))
  let yGridlines_bool = $derived(toBoolean(yGridlines))
  let yAxisLabels_bool = $derived(toBoolean(yAxisLabels))
  let yScale_bool = $derived(toBoolean(yScale))
  let y2Baseline_bool = $derived(toBoolean(y2Baseline))
  let y2TickMarks_bool = $derived(toBoolean(y2TickMarks))
  let y2Gridlines_bool = $derived(toBoolean(y2Gridlines))
  let y2AxisLabels_bool = $derived(toBoolean(y2AxisLabels))
  let y2Scale_bool = $derived(toBoolean(y2Scale))
  let xLabelWrap_bool = $derived(toBoolean(xLabelWrap))

  let yAxisColorStore = $derived(resolveColor(yAxisColor))
  let y2AxisColorStore = $derived(resolveColor(y2AxisColor))
  let colorPaletteResolved = $derived(resolveColorPalette(colorPalette))
  let seriesColorsResolved = $derived(resolveColorsObject(seriesColors))

  let reqCols

  let xAxisLabelOverflow = $derived(xLabelWrap_bool ? 'break' : 'truncate')

  // ---------------------------------------------------------------------------------------
  // Variable Declaration
  // ---------------------------------------------------------------------------------------
  // Column Summary:
  let columnSummary
  let columnNames
  let uColNames = []
  let unusedColumns = []
  let uColType
  let uColName
  let xDataType
  let xMismatch
  let xFormat
  let yFormat
  let y2Format
  let sizeFormat
  let xUnitSummary
  let yUnitSummary
  let y2UnitSummary
  let xDistinct

  // Individual Config Sections:
  let horizAxisConfig
  let verticalAxisConfig
  let horizAxisTitleConfig
  let chartConfig

  // Chart area sizing:
  let hasTitle
  let hasSubtitle
  let hasLegend
  let hasTopAxisTitle
  let hasBottomAxisTitle
  let titleFontSize
  let subtitleFontSize
  let titleBoxPadding
  let titleBoxHeight
  let chartAreaPaddingTop
  let chartAreaPaddingBottom
  let bottomAxisTitleSize
  let topAxisTitleSize
  let legendHeight
  let legendPaddingTop
  let legendTop
  let chartTop
  let chartBottom
  let chartContainerHeight
  let topAxisTitleTop

  let horizAxisTitle

  // Adjustment to avoid small bars on horizontal bar chart (extend chart height to accomodate):
  let maxBars
  let barCount
  let heightMultiplier

  // Set final chart height:
  // Using a separate writable store for dimensions so they're reactive in the template
  // without causing infinite effect loops (which $state would cause since the effect reads+writes them).
  let dimensions = writable<{height?: string, width?: string}>({})

  let missingCols = []

  let originalRun = true

  // Error Handling:

  let inputCols = []
  let optCols = []
  let i

  // svelte-ignore non_reactive_update
  let error

  // Date String Handling:
  let columnSummaryArray
  let dateCols

  $effect(() => {
    try {
      error = undefined
      missingCols = []
      unusedColumns = []
      // Error Handling:
      inputCols = []
      optCols = []
      uColName = []
      // Normalize list-like inputs first - use local variables instead of reassigning props
      let yLocal = parseCommaList(y)
      let y2Local = parseCommaList(y2)
      ySet = yLocal.length > 0
      xSet = x ? true : false

      checkInputs(data) // check that dataset exists

      // ---------------------------------------------------------------------------------------
      // Get column information
      // ---------------------------------------------------------------------------------------
      // Get column summary:
      columnSummary = getColumnSummary(data)

      // Get column names:
      columnNames = Object.keys(columnSummary)

      // ---------------------------------------------------------------------------------------
      // Make assumptions to complete required props
      // ---------------------------------------------------------------------------------------
      // If no x column was supplied, assume first column in dataset is x
      let xLocal = x
      if (!xSet) {
        xLocal = columnNames[0]
      }

      // If no y column(s) supplied, assume all number columns other than x are the y columns:
      if (!ySet) {
        uColNames = columnNames.filter(function (col) {
          return ![xLocal, series, size].includes(col)
        })

        for (let i = 0; i < uColNames.length; i++) {
          uColName = uColNames[i]
          uColType = columnSummary[uColName].type
          if (uColType === 'number') {
            unusedColumns.push(uColName)
          }
        }

        yLocal = unusedColumns // always array; empty handled by required prop checks
      }
      // Establish required columns based on chart type:
      if (bubble) {
        reqCols = {
          x: xLocal,
          y: yLocal,
          size: size,
        }
      } else if (hist) {
        reqCols = {
          x: xLocal,
        }
      } else if (boxplot) {
        reqCols = {}
      } else {
        reqCols = {
          x: xLocal,
          y: yLocal,
        }
      }

      // Check which columns were not supplied to the chart:
      for (let property in reqCols) {
        if (reqCols[property] == null) {
          missingCols.push(property)
        }
      }

      if (missingCols.length === 1) {
        throw Error(new Intl.ListFormat().format(missingCols) + ' is required')
      } else if (missingCols.length > 1) {
        throw Error(new Intl.ListFormat().format(missingCols) + ' are required')
      }

      // Fix for stacked100 overwriting y variable. Bandaid fix - not a long-term solution:
      if (stacked100 === true && Array.isArray(yLocal) && yLocal.some(col => col.includes('_pct')) && originalRun === false) {
        yLocal = yLocal.map(col => col.replace('_pct', ''))
        originalRun = false
      }

      // Check the inputs supplied to the chart:
      if (xLocal) {
        inputCols.push(xLocal)
      }
      if (Array.isArray(yLocal)) for (i = 0; i < yLocal.length; i++) inputCols.push(yLocal[i])
      if (Array.isArray(y2Local)) for (i = 0; i < y2Local.length; i++) inputCols.push(y2Local[i])
      if (size) {
        inputCols.push(size)
      }
      if (series) {
        optCols.push(series)
      }
      if (tooltipTitle) {
        optCols.push(tooltipTitle)
      }

      checkInputs(data, inputCols, optCols)

      // ---------------------------------------------------------------------------------------
      // Aggregate Data if Required
      // ---------------------------------------------------------------------------------------
      let dataLocal = data
      if (stacked100 === true) {
        dataLocal = getStackPercentages(dataLocal, xLocal, yLocal)
        yLocal = yLocal.map(col => col + '_pct')
        originalRun = false
        columnSummary = getColumnSummary(dataLocal)
      }

      // ---------------------------------------------------------------------------------------
      // Define x axis type
      // ---------------------------------------------------------------------------------------
      xDataType = columnSummary[xLocal].type

      // Get xDataType into ECharts default types:
      switch (xDataType) {
        case 'number':
          xDataType = 'value'
          break
        case 'string':
          xDataType = 'category'
          break
        case 'date':
          xDataType = 'time'
          break
        default:
          break
      }

      let xTypeLocal = xType === 'category' ? 'category' : xDataType

      // Set xAxisLabel overflow behaviour based on column type
      let showAllXAxisLabelsLocal = showAllXAxisLabels
      if (!showAllXAxisLabelsLocal) {
        // if user has not set showXAxisLabels
        showAllXAxisLabelsLocal = xTypeLocal === 'category'
      } else {
        // if user has set showXAxisLabels, convert to boolean
        showAllXAxisLabelsLocal = showAllXAxisLabelsLocal === 'true' || showAllXAxisLabelsLocal === true
      }

      // Throw error if attempting to plot value or time on horizontal x-axis:
      if (swapXY_bool && xTypeLocal !== 'category') {
        throw Error(
          'Horizontal charts do not support a value or time-based x-axis. You can either change your SQL query to output string values or set swapXY=false.',
        )
      }

      // Throw error if attempting to plot secondary y-axis on horizontal chart:
      if (swapXY_bool && y2Local.length) {
        throw Error(
          'Horizontal charts do not support a secondary y-axis. You can either set swapXY=false or remove the y2 prop from your chart.',
        )
      }

      // Override xType if axes are swapped - only category enabled on horizontal axis
      if (swapXY_bool) {
        xTypeLocal = 'category'
      }

      // Check for x mismatch:
      xMismatch = xDataType === 'value' && xTypeLocal === 'category'

      // ---------------------------------------------------------------------------------------
      // Sort data based on xType
      // ---------------------------------------------------------------------------------------
      if (sort_bool) {
        let sortColumn = xLocal
        if (xDataType === 'category') {
          sortColumn = Array.isArray(yLocal) ? (yLocal[0] ?? xLocal) : xLocal
        }
        let sortAscending = xDataType !== 'category'
        dataLocal = getSortedData(dataLocal, sortColumn, sortAscending)
      }

      // Always sort time axes by x - this prevents the lines from being drawn out of order
      if (xDataType === 'time') {
        dataLocal = getSortedData(dataLocal, xLocal, true)
      }

      // ---------------------------------------------------------------------------------------
      // Standardize date columns
      // ---------------------------------------------------------------------------------------

      columnSummaryArray = getColumnSummary(dataLocal, 'array')
      dateCols = columnSummaryArray.filter((d) => d.type === 'date')
      dateCols = dateCols.map((d) => d.id)

      if (dateCols.length > 0) {
        for (let i = 0; i < dateCols.length; i++) {
          dataLocal = standardizeDateColumn(dataLocal, dateCols[i])
        }
      }

      // ---------------------------------------------------------------------------------------
      // Get format codes for axes
      // ---------------------------------------------------------------------------------------
      if (xFmt) {
        xFormat = getFormatObjectFromString(xFmt, columnSummary[xLocal].format?.valueType)
      } else {
        xFormat = columnSummary[xLocal].format
      }

      if (yLocal.length === 0) {
        yFormat = 'str'
      } else {
        if (yFmt) yFormat = getFormatObjectFromString(yFmt, columnSummary[yLocal[0]].format?.valueType)
        else yFormat = columnSummary[yLocal[0]].format
      }

      if (y2Local.length) {
        if (y2Fmt) y2Format = getFormatObjectFromString(y2Fmt, columnSummary[y2Local[0]].format?.valueType)
        else y2Format = columnSummary[y2Local[0]].format
      }

      if (size) {
        if (sizeFmt) {
          sizeFormat = getFormatObjectFromString(sizeFmt, columnSummary[size].format?.valueType)
        } else {
          sizeFormat = columnSummary[size].format
        }
      }

      xUnitSummary = columnSummary[xLocal].columnUnitSummary

      if (yLocal.length) yUnitSummary = columnSummary[yLocal[0]].columnUnitSummary

      if (y2Local.length) y2UnitSummary = columnSummary[y2Local[0]].columnUnitSummary

      let xAxisTitleLocal = xAxisTitle
      if (xAxisTitleLocal === 'true') {
        xAxisTitleLocal = formatTitle(xLocal, xFormat)
      } else if (xAxisTitleLocal === 'false') {
        xAxisTitleLocal = ''
      }

      let yAxisTitleLocal = yAxisTitle
      if (yAxisTitleLocal === 'true') {
        if (yLocal.length === 1) {
          yAxisTitleLocal = formatTitle(yLocal[0], yFormat)
        } else {
          yAxisTitleLocal = ''
        }
      } else if (yAxisTitleLocal === 'false') {
        yAxisTitleLocal = ''
      }

      let y2AxisTitleLocal = y2AxisTitle
      if (y2AxisTitleLocal === 'true') {
        if (y2Local.length === 1) {
          y2AxisTitleLocal = formatTitle(y2Local[0], y2Format)
        } else {
          y2AxisTitleLocal = ''
        }
      } else if (y2AxisTitleLocal === 'false') {
        y2AxisTitleLocal = ''
      }

      // ---------------------------------------------------------------------------------------
      // Get total series count
      // ---------------------------------------------------------------------------------------
      let yCount = yLocal.length
      let seriesCount = series ? getDistinctCount(dataLocal, series) : 1
      let ySeriesCount = yCount * seriesCount

      // y2Count may need to be adjusted to also factor in the series column. For now, we really
      // only need to know that it's multi-series, so > 1 is sufficient
      let y2Count = y2Local.length
      let totalSeriesCount = ySeriesCount + y2Count

      // ---------------------------------------------------------------------------------------
      // Set legend flag
      // ---------------------------------------------------------------------------------------
      let legendLocal = legend
      if (legendLocal !== undefined) {
        legendLocal = legendLocal === 'true' || legendLocal === true
      }

      legendLocal = legendLocal ?? totalSeriesCount > 1

      // ---------------------------------------------------------------------------------------
      // Handle errors for log axes (cannot be used with stacked charts)
      // ---------------------------------------------------------------------------------------

      if (stacked100 === true && yLog_bool === true) {
        throw Error('Log axis cannot be used in a 100% stacked chart')
      } else if (stackType === 'stacked' && totalSeriesCount > 1 && yLog_bool === true) {
        throw Error('Log axis cannot be used in a stacked chart')
      }

      let minYValue
      if (yLocal.length) {
        minYValue = columnSummary[yLocal[0]].columnUnitSummary.min
        for (let i = 0; i < yLocal.length; i++) {
          if (columnSummary[yLocal[i]].columnUnitSummary.min < minYValue) {
            minYValue = columnSummary[yLocal[i]].columnUnitSummary.min
          }
        }
      }

      if (yLog_bool === true && minYValue <= 0 && minYValue !== null) {
        throw Error('Log axis cannot display values less than or equal to zero')
      }

      // ---------------------------------------------------------------------------------------
      // Compute chartAreaHeight locally
      // ---------------------------------------------------------------------------------------
      let chartAreaHeightLocal = chartAreaHeight
      if (chartAreaHeightLocal) {
        // if chartAreaHeight was user-supplied
        chartAreaHeightLocal = Number(chartAreaHeightLocal)
        if (isNaN(chartAreaHeightLocal)) {
          // input must be a number
          throw Error('chartAreaHeight must be a number')
        } else if (chartAreaHeightLocal <= 0) {
          throw Error('chartAreaHeight must be a positive number')
        }
      } else {
        chartAreaHeightLocal = 220
      }

      // Compute yType locally
      let yTypeLocal = yLog_bool === true ? 'log' : (yType ?? 'value')

      // ---------------------------------------------------------------------------------------
      // Add props to store to let child components access them
      // ---------------------------------------------------------------------------------------
      chartProps.update((d) => {
        return {
          ...d,
          error: undefined,
          data: dataLocal,
          x: xLocal,
          y: yLocal,
          y2: y2Local,
          series,
          swapXY: swapXY_bool,
          sort: sort_bool,
          xType: xTypeLocal,
          xFormat,
          yFormat,
          y2Format,
          sizeFormat,
          xMismatch,
          size,
          yMin,
          y2Min,
          columnSummary,
          xAxisTitle: xAxisTitleLocal,
          yAxisTitle: yAxisTitleLocal,
          y2AxisTitle: y2AxisTitleLocal,
          tooltipTitle,
          chartAreaHeight: chartAreaHeightLocal,
          chartType,
          yCount,
          y2Count,
        }
      })

      // ---------------------------------------------------------------------------------------
      // Axis Configuration
      // ---------------------------------------------------------------------------------------
      xDistinct = getDistinctValues(dataLocal, xLocal)
      let secondaryAxis

      if (swapXY_bool) {
        horizAxisConfig = {
          type: yTypeLocal,
          logBase: yLogBase,
          position: 'top',
          axisLabel: {
            show: yAxisLabels_bool,
            hideOverlap: true,
            showMaxLabel: true,
            formatter: function (value) {
              return formatAxisValue(value, yFormat, yUnitSummary)
            },
            margin: 4,
          },
          min: yMin,
          max: yMax,
          minInterval: yUnitSummary?.maxDecimals === 0 ? 1 : undefined,
          scale: yScale_bool,
          splitLine: {
            show: yGridlines_bool,
          },
          axisLine: {
            show: yBaseline_bool,
            onZero: false,
          },
          axisTick: {
            show: yTickMarks_bool,
          },
          boundaryGap: false,
          z: 2,
        }
      } else {
        horizAxisConfig = {
          type: xTypeLocal,
          min: xMin,
          max: xMax,
          tooltip: {
            show: true,
            position: 'inside',
            formatter (p) {
              if (p.isTruncated()) {
                return p.name
              }
            },
          },
          splitLine: {
            show: xGridlines_bool,
          },
          axisLine: {
            show: xBaseline_bool,
          },
          axisTick: {
            show: xTickMarks_bool,
          },
          axisLabel: {
            show: xAxisLabels_bool,
            hideOverlap: true,
            showMaxLabel: xTypeLocal === 'category' || xTypeLocal === 'value', // max label for ECharts' time axis is a stub - default for that is false
            formatter:
              xTypeLocal === 'time' || xTypeLocal === 'category'
                ? false
                : function (value) {
                  return formatAxisValue(value, xFormat, xUnitSummary)
                },
            margin: 6,
          },
          scale: true,
          z: 2,
        }
      }

      if (swapXY_bool) {
        verticalAxisConfig = {
          type: xTypeLocal,
          inverse: 'true',
          splitLine: {
            show: xGridlines_bool,
          },
          axisLine: {
            show: xBaseline_bool,
          },
          axisTick: {
            show: xTickMarks_bool,
          },
          axisLabel: {
            show: xAxisLabels_bool,
            hideOverlap: true,
            // formatter:
            //     function(value){
            //         return formatAxisValue(value, xFormat, xUnitSummary)
            //     },
          },
          scale: true,
          min: xMin,
          max: xMax,
          z: 2,
        }
      } else {
        let primaryAxisColor = (() => {
          if (!(Array.isArray(y2Local) && y2Local.length)) return undefined
          let yColor = get(yAxisColorStore)
          if (yColor === 'true') return $colorPaletteResolved?.[0]
          if (yColor === 'false') return undefined
          return yColor
        })()
        let secondaryAxisColor = (() => {
          let y2Color = get(y2AxisColorStore)
          if (y2Color === 'true') return $colorPaletteResolved?.[ySeriesCount]
          if (y2Color === 'false') return undefined
          return y2Color
        })()

        verticalAxisConfig = {
          type: yTypeLocal,
          logBase: yLogBase,
          splitLine: {
            show: yGridlines_bool,
          },
          axisLine: {
            show: yBaseline_bool,
            onZero: false,
          },
          axisTick: {
            show: yTickMarks_bool,
          },
          axisLabel: {
            show: yAxisLabels_bool,
            hideOverlap: true,
            margin: 4,
            formatter: function (value) {
              return formatAxisValue(value, yFormat, yUnitSummary)
            },
            color: primaryAxisColor,
          },
          name: yAxisTitleLocal,
          nameLocation: 'end',
          nameTextStyle: {
            align: 'left',
            verticalAlign: 'top',
            padding: [0, 5, 0, 0],
            color: primaryAxisColor,
          },
          nameGap: 6,
          min: yMin,
          max: yMax,
          minInterval: yUnitSummary?.maxDecimals === 0 ? 1 : undefined,
          scale: yScale_bool,
          boundaryGap: yUnitSummary?.maxDecimals === 0 ? false : ['0%', '1%'],
          z: 2,
        }

        secondaryAxis = {
          type: 'value',
          show: y2Count > 0,
          alignTicks: true,
          splitLine: {
            show: y2Gridlines_bool,
          },
          axisLine: {
            show: y2Baseline_bool,
            onZero: false,
          },
          axisTick: {
            show: y2TickMarks_bool,
          },
          axisLabel: {
            show: y2AxisLabels_bool,
            hideOverlap: true,
            margin: 4,
            formatter: function (value) {
              return formatAxisValue(value, y2Format, y2UnitSummary)
            },
            color: secondaryAxisColor,
          },
          name: y2AxisTitleLocal,
          nameLocation: 'end',
          nameTextStyle: {
            align: 'right',
            verticalAlign: 'top',
            padding: [0, 0, 0, 5],
            color: secondaryAxisColor,
          },
          nameGap: 6,
          min: y2Min,
          max: y2Max,
          minInterval: y2UnitSummary?.maxDecimals === 0 ? 1 : undefined,
          scale: y2Scale_bool,
          boundaryGap: y2UnitSummary?.maxDecimals === 0 ? false : ['0%', '1%'],
          z: 2,
        }

        verticalAxisConfig = [verticalAxisConfig, secondaryAxis]
      }

      // ---------------------------------------------------------------------------------------
      // Set up chart area
      // ---------------------------------------------------------------------------------------

      hasTitle = title ? true : false
      hasSubtitle = subtitle ? true : false
      hasLegend = legendLocal * (series !== null || (yLocal.length > 1))
      hasTopAxisTitle = yAxisTitleLocal !== '' && swapXY_bool
      hasBottomAxisTitle = xAxisTitleLocal !== '' && !swapXY_bool

      titleFontSize = 15
      subtitleFontSize = 13
      titleBoxPadding = 6 * hasSubtitle

      titleBoxHeight =
        hasTitle * titleFontSize +
        hasSubtitle * subtitleFontSize +
        titleBoxPadding * Math.max(hasTitle, hasSubtitle)

      chartAreaPaddingTop = 10
      chartAreaPaddingBottom = 10

      bottomAxisTitleSize = 14
      topAxisTitleSize = 14 + 0 // font size + padding top

      legendHeight = 15
      legendHeight = legendHeight * hasLegend

      legendPaddingTop = 7
      legendPaddingTop = legendPaddingTop * Math.max(hasTitle, hasSubtitle)

      legendTop = titleBoxHeight + legendPaddingTop
      chartTop =
        legendTop + legendHeight + topAxisTitleSize * hasTopAxisTitle + chartAreaPaddingTop
      chartBottom = hasBottomAxisTitle * bottomAxisTitleSize + chartAreaPaddingBottom

      // Adjustment to avoid small bars on horizontal bar chart (extend chart height to accomodate)
      // Small bars are allowed on normal bar chart (e.g., time series bar chart)
      maxBars = 8
      heightMultiplier = 1
      if (swapXY_bool) {
        barCount = xDistinct.length
        heightMultiplier = Math.max(1, barCount / maxBars)
      }

      chartContainerHeight = chartAreaHeightLocal * heightMultiplier + chartTop + chartBottom

      topAxisTitleTop = legendTop + legendHeight + 7

      // Set final chart height:
      dimensions.set({height: chartContainerHeight + 'px', width: '100%'})

      // ---------------------------------------------------------------------------------------
      // Set up horizontal axis title (custom graphic)
      // ---------------------------------------------------------------------------------------
      horizAxisTitle = swapXY_bool ? yAxisTitleLocal : xAxisTitleLocal
      if (horizAxisTitle !== '') {
        horizAxisTitle = horizAxisTitle + ' →' // u2192 is js escaped version of &rarr;
      }

      horizAxisTitleConfig = {
        id: 'horiz-axis-title',
        type: 'text',
        style: {
          text: horizAxisTitle,
          textAlign: 'right',
          fill: $theme.colors['base-content-muted'],
        },
        cursor: 'auto',
        // Positioning (if swapXY, top right; otherwise bottom right)
        right: swapXY_bool ? '2%' : '3%',
        top: swapXY_bool ? topAxisTitleTop : null,
        bottom: swapXY_bool ? null : '2%',
      }

      // ---------------------------------------------------------------------------------------
      // Build chart config and update config store so child components can access it
      // ---------------------------------------------------------------------------------------

      chartConfig = {
        title: {
          text: title,
          subtext: subtitle,
          subtextStyle: {
            width: '100%',
          },
        },
        tooltip: {
          trigger: 'axis',
          show: true,
          // formatter function is overridden in ScatterPlot, BubbleChart, and Histogram
          formatter: function (params) {
            let output
            let xVal
            let yVal
            let yCol
            if (totalSeriesCount > 1) {
              // If multi-series, add series name as title of tooltip
              xVal = params[0].value[swapXY_bool ? 1 : 0]
              output = `<span id="tooltip" style='font-weight: 600;'>${formatValue(
                xVal,
                xFormat,
              )}</span>`
              for (let i = params.length - 1; i >= 0; i--) {
                if (params[i].seriesName !== 'stackTotal') {
                  yVal = params[i].value[swapXY_bool ? 0 : 1]
                  output =
                    output +
                    `<br> <span style='font-size: 11px;'>${params[i].marker} ${
                      params[i].seriesName
                    }<span/><span style='float:right; margin-left: 10px; font-size: 12px;'>${formatValue(
                      yVal,
                      // Not sure if this will work. Need to check with multi series on both axes
                      // Check if echarts does the order in the same way - y first, then y2
                      getYAxisIndex(params[i].componentIndex, yCount, y2Count) === 0
                        ? yFormat
                        : y2Format,
                    )}</span>`
                }
              }
            } else if (xTypeLocal === 'value') {
              // If single-series and a numerical x-axis, include x column as a normal column rather than title (so as not to show a number as the title)
              xVal = params[0].value[swapXY_bool ? 1 : 0]
              yVal = params[0].value[swapXY_bool ? 0 : 1]
              yCol = params[0].seriesName
              output = `<span id="tooltip" style='font-weight: 600;'>${formatTitle(
                xLocal,
                xFormat,
              )}: </span><span style='float:right; margin-left: 10px;'>${formatValue(
                xVal,
                xFormat,
              )}</span><br/><span style='font-weight: 600;'>${formatTitle(
                yCol,
                yFormat,
              )}: </span><span style='float:right; margin-left: 10px;'>${formatValue(
                yVal,
                yFormat,
              )}</span>`
            } else {
              // If single series and categorical or date x-axis, use x value as title of tooltip
              xVal = params[0].value[swapXY_bool ? 1 : 0]
              yVal = params[0].value[swapXY_bool ? 0 : 1]
              yCol = params[0].seriesName
              output = `<span id="tooltip" style='font-weight: 600;'>${formatValue(
                xVal,
                xFormat,
              )}</span><br/><span>${formatTitle(
                yCol,
                yFormat,
              )}: </span><span style='float:right; margin-left: 10px;'>${formatValue(
                yVal,
                yFormat,
              )}</span>`
            }
            return output
          },
          confine: true,
          axisPointer: {
            // Use axis to trigger tooltip
            type: 'shadow', // 'shadow' as default; can also be 'line' or 'shadow'
          },
          extraCssText:
            'box-shadow: 0 3px 6px rgba(0,0,0,.15); box-shadow: 0 2px 4px rgba(0,0,0,.12); z-index: 1; font-feature-settings: "cv02", "tnum";',
          order: 'valueDesc',
        },
        legend: {
          show: legendLocal,
          type: 'scroll',
          top: legendTop,
          padding: [0, 0, 0, 0],
          data: [],
        },
        grid: {
          left: leftPadding ?? (swapXY_bool ? '1%' : '0.8%'),
          right: rightPadding ?? (swapXY_bool ? '4%' : '3%'),
          bottom: chartBottom,
          top: chartTop,
          containLabel: true,
        },
        xAxis: horizAxisConfig,
        yAxis: verticalAxisConfig,
        series: [],
        animation: true,
        graphic: horizAxisTitleConfig,
        color: $colorPaletteResolved,
      }

      config.update(() => {
        return chartConfig
      })
    } catch (e) {
      // svelte-ignore non_reactive_update
      error = e.message
      let setTextRed = '\x1b[31m%s\x1b[0m'
      console.error(setTextRed, `Error in ${chartType}: ${e.message}`)

      // Make an "id" for the chart so its clear to users/agents exactly which caused an error.
      let fieldStr = Object.entries(chartContext || {})
        .filter(([_, val]) => {
          if (Array.isArray(val)) return val.length > 0
          if (typeof val === 'string') return val.trim().length > 0
          return Boolean(val)
        })
        .map(([name, val]) => `${name}="${Array.isArray(val) ? val.join(', ') : val}"`)
      let id = `${title || chartType} (${fieldStr.join(' ')})`
      logError(e, {id})

      chartProps.update((d) => {
        return {...d, error}
      })
    }
  })
</script>

{#if !$chartProps.error}
  {@render children?.()}
  <ECharts
    config={$config}
    height={$dimensions.height}
    width={$dimensions.width}
    {data}
    {queryID}
    chartTitle={title}
    {echartsOptions}
    {seriesOptions}
    {connectGroup}
    {xAxisLabelOverflow}
    seriesColors={$seriesColorsResolved}
  />
{:else}
  <ErrorChart error={$chartProps.error} title={chartType} />
{/if}
