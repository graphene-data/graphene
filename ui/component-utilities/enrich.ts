import type {EChartsConfig, Field, NormalConfig, SeriesWithGroupingHint} from './types.ts'

import {applyMissingPointDefaults, applySorting, applyStackPercentage, inlineDataIntoSeries} from './dataShaping.ts'
import {formatTimeOrdinal, makeTimeFormatter, makeValueFormatter} from './format.ts'
import {paletteForPath} from './theme.ts'

// Enrichment is the process through which we take an echarts config and add in some defaults to make it really nice.
// A lot of defaulting happens in themes but there are some defaults themes can't handle, like when it depends on the shape of data being charted.
// Each enrichment function is a small, ideally single-purpose manipulation of the config.
// As a rule, if the provided config sets something, enrichments will not change it.

// Each enrichment must have a comment above it describing what it does, and perhaps why it's needed if it isn't obvious.
// Enrichments must also have comments inside explaining how they work if the logic is non-trivial
// Avoid creating new helpers unless the logic is used in several places.

// Run enrichment in a fixed order so defaults stay predictable.
export function enrich(config: EChartsConfig, rows: Record<string, any>[], fields: Field[]) {
  let normalized = normalize(config)
  ensureAxes(normalized)
  ensureTooltip(normalized)
  ensureColors(normalized)

  // Resolve axis metadata up front so row shaping (like explicit sorting) can use it.
  inferAxesFromEncodedFields(normalized, fields, rows)
  extendValueAxisDomainsForBars(normalized)

  // Mutate row/field data before dataset creation so synthesized fields are reflected in dataset dimensions.
  applyMissingPointDefaults(normalized, rows)
  applyStackPercentage(normalized, rows, fields)
  applySorting(normalized, rows, fields)

  let baseDatasetId = ensureDataset(normalized, rows, fields)
  expandSeriesSplitBy(normalized, rows, fields, baseDatasetId)
  expandTreeMapData(normalized, rows, fields)
  expandNodeLinkData(normalized, rows, fields)
  expandThemeRiverData(normalized, rows, fields)

  // stylistic rules to provide great defaults
  lineSeriesMarkerVisibility(normalized, rows, fields)
  horizontalBarGuard(normalized, fields)
  computeTitleLegendAndGridPadding(normalized)
  applyLegendSelection(normalized)
  hideStackPercentageValueAxis(normalized, fields)
  removeHiddenValueAxisPadding(normalized)
  valueFormatting(normalized, fields)
  timeFormatting(normalized)
  styleSecondaryAxisForSimpleBarLineLayout(normalized, fields)
  applyIntegerYAxisTicks(normalized, rows, fields)
  barLabelPositioning(normalized)
  labelsUseYAxisFormat(normalized, fields)
  addPieTooltips(normalized, fields)
  inlineDataIntoSeries(normalized, rows)
  stackedBarCornerRadius(normalized)
  return normalized
}

// For horizontal bars, count distinct category values so wrappers can size containers.
export function horizontalBarCount(config: NormalConfig, rows: Record<string, any>[], fields: Field[]) {
  if (!isHorizontalBar(config)) return 0

  let categoryFields = config.series
    .filter(series => series?.type === 'bar')
    .map(series => getEncodeField(series, fields, 'y'))
    .filter((f): f is Field => !!f)

  if (categoryFields.length === 0) return 0
  return Math.max(...categoryFields.map(field => distinctValues(rows, field.name).length))
}

// Normalize options we read in enrichments so later rules can always iterate arrays.
function normalize(config: EChartsConfig): NormalConfig {
  let target = config as NormalConfig
  target.series = normalizeArray<SeriesWithGroupingHint>(config.series)
  target.xAxis = normalizeArray<NormalConfig['xAxis'][number]>(config.xAxis)
  target.yAxis = normalizeArray<NormalConfig['yAxis'][number]>(config.yAxis)
  target.dataset = normalizeArray<NormalConfig['dataset'][number]>(config.dataset)
  target.grid = normalizeArray<NormalConfig['grid'][number]>(config.grid)
  if (target.grid.length === 0) target.grid.push({} as NormalConfig['grid'][number])
  target.legend = normalizeArray<NormalConfig['legend'][number]>(config.legend)
  target.title = normalizeArray<NormalConfig['title'][number]>(config.title)

  target.tooltip = normalizeArray<NormalConfig['tooltip'][number]>(config.tooltip).filter(tooltip => tooltip && typeof tooltip === 'object')
  return target
}

// Every chart gets a base dataset sourced from rows.
// If callers already provided a dataset, we preserve it and make sure we can reference one source dataset by id.
function ensureDataset(config: NormalConfig, rows: Record<string, any>[], fields: Field[]) {
  let dimensions = fields.length > 0 ? fields.map(field => field.name) : inferDimensions(rows)
  let baseId = '__graphene_base'

  if (config.dataset.length === 0) {
    config.dataset.push({id: baseId, source: rows, dimensions})
    return baseId
  }

  let base = config.dataset.find(entry => entry?.source != null)
  if (!base) {
    config.dataset.unshift({id: baseId, source: rows, dimensions})
    return baseId
  }

  if (!base.id) base.id = baseId
  if (base.dimensions == null && dimensions.length > 0) base.dimensions = dimensions
  return String(base.id)
}

// We've added `encode.splitBy` as a way to concisely configure a chart whose data should be split into many series.
// This enrichment takes care of generating both a dataset and a series pointing at that dataset for each distinct value in splitBy.
// We do this with ECharts dataset filter transforms so wrappers stay small and users don't need to duplicate series configs.
function expandSeriesSplitBy(config: NormalConfig, rows: Record<string, any>[], fields: Field[], baseDatasetId: string) {
  let expanded: SeriesWithGroupingHint[] = []

  config.series.forEach((series, templateIndex) => {
    let splitFields = getEncodeFields(series, fields, 'splitBy')

    // Non-split series pass through unchanged. ECharts will read from the base dataset (index 0) by default.
    if (splitFields.length === 0) {
      expanded.push(series)
      return
    }

    if (splitFields.length > 2) throw new Error('encode.splitBy supports at most two fields')

    let sourceDatasetId = series.datasetId ?? baseDatasetId

    if (splitFields.length === 2) {
      if (series?.type !== 'bar') throw new Error('encode.splitBy with two fields is only supported for bar series')

      let [groupField, stackField] = splitFields
      let groupValues = distinctValues(rows, groupField.name)
      let stackValues = distinctValues(rows, stackField.name)
      if (groupValues.length === 0 || stackValues.length === 0) return

      groupValues.forEach((groupValue, groupIndex) => {
        let groupedDatasetId = `__graphene_series_${templateIndex}_${groupIndex}`
        config.dataset.push({
          id: groupedDatasetId,
          fromDatasetId: sourceDatasetId,
          transform: {type: 'filter', config: {dimension: groupField.name, '=': groupValue}},
        })

        stackValues.forEach((stackValue, stackIndex) => {
          let datasetId = `__graphene_series_${templateIndex}_${groupIndex}_${stackIndex}`
          config.dataset.push({
            id: datasetId,
            fromDatasetId: groupedDatasetId,
            transform: {type: 'filter', config: {dimension: stackField.name, '=': stackValue}},
          })

          expanded.push(buildSplitSeries(series, datasetId, `${String(groupValue ?? '')} · ${String(stackValue ?? '')}`, String(groupValue ?? '')))
        })
      })

      return
    }

    let splitField = splitFields[0]
    let seriesValues = distinctValues(rows, splitField.name)
    if (seriesValues.length === 0) return

    seriesValues.forEach((seriesValue, valueIndex) => {
      let datasetId = `__graphene_series_${templateIndex}_${valueIndex}`
      config.dataset.push({
        id: datasetId,
        fromDatasetId: sourceDatasetId,
        transform: {type: 'filter', config: {dimension: splitField.name, '=': seriesValue}},
      })

      expanded.push(buildSplitSeries(series, datasetId, String(seriesValue ?? '')))
    })
  })

  config.series = expanded
}

// ECharts themeRiver doesn't consume our base dataset shape - it expects rows as [date, value, seriesName] tuples.
// themeRiver handles its own grouping by seriesName, so we translate `encode.single/value/seriesName` into explicit `data`.
function expandThemeRiverData(config: NormalConfig, rows: Record<string, any>[], fields: Field[]) {
  for (let series of config.series) {
    if (series?.type !== 'themeRiver' || series.data != null) continue

    let singleField = getEncodeField(series, fields, 'single')
    let valueField = getEncodeField(series, fields, 'value')
    let nameField = getEncodeField(series, fields, 'seriesName')
    if (!singleField || !valueField || !nameField) continue

    series.data = rows.map(row => [row[singleField.name], row[valueField.name], row[nameField.name]])
    delete series.datasetId
  }
}

// Sankey and chord both ignore datasets and want explicit `data` (nodes) and `links` (edges).
// We build nodes from the distinct source+target names and map each row to a link.
function expandNodeLinkData(config: NormalConfig, rows: Record<string, any>[], fields: Field[]) {
  for (let series of config.series) {
    if (series?.type !== 'sankey' && series?.type !== 'chord') continue
    if (series.data != null || series.links != null) continue

    let sourceField = getEncodeField(series, fields, 'source')
    let targetField = getEncodeField(series, fields, 'target')
    let valueField = getEncodeField(series, fields, 'value')
    if (!sourceField || !targetField || !valueField) continue

    let nodeNames = new Set<string>()
    for (let row of rows) {
      nodeNames.add(String(row[sourceField.name]))
      nodeNames.add(String(row[targetField.name]))
    }
    series.data = Array.from(nodeNames, name => ({name}))
    series.links = rows.map(row => ({source: String(row[sourceField.name]), target: String(row[targetField.name]), value: row[valueField.name]}))
    delete series.datasetId
  }
}

// ECharts treemap doesn't read from a dataset - it requires an explicit hierarchical `series.data`.
// We turn our tabular rows into a flat list of leaves keyed by the encoded itemName/value fields.
// Nested hierarchies could be supported later by accepting a list of itemName fields.
function expandTreeMapData(config: NormalConfig, rows: Record<string, any>[], fields: Field[]) {
  for (let series of config.series) {
    if (series?.type !== 'treemap' || series.data != null) continue

    let nameField = getEncodeField(series, fields, 'itemName')
    let valueField = getEncodeField(series, fields, 'value')
    if (!nameField || !valueField) continue

    series.data = rows.map(row => ({name: row[nameField.name], value: row[valueField.name]}))
    delete series.datasetId
  }
}

// Produce a concrete series derived from a splitBy template, bound to a filtered dataset.
function buildSplitSeries(template: SeriesWithGroupingHint, datasetId: string, name: string, stack?: string): SeriesWithGroupingHint {
  let next: SeriesWithGroupingHint = {...template, datasetId}
  if (stack != null) next.stack = stack
  if (next.name == null) next.name = name
  if (next.encode) {
    next.encode = {...next.encode}
    delete next.encode.splitBy
  }
  return next
}

// Ensure cartesian series always have at least one x/y axis object.
// This gives later enrichments an axis target to infer into, and avoids
// ECharts runtime errors like `xAxis "0" not found`.
function ensureAxes(config: NormalConfig) {
  let cartesianSeriesTypes = new Set(['line', 'bar', 'scatter', 'candlestick', 'heatmap', 'boxplot', 'effectScatter'])
  let needsCartesianAxes = config.series.some(series => series?.type != null && cartesianSeriesTypes.has(series.type))
  if (!needsCartesianAxes) return

  if (!config.xAxis[0]) config.xAxis[0] = {}
  if (!config.yAxis[0]) config.yAxis[0] = {}
}

// Ensure we always have exactly one top-level tooltip object in normalized config.
function ensureTooltip(config: NormalConfig) {
  if (config.tooltip.length > 0) return
  config.tooltip.push({trigger: 'axis'})
}

// Ensure we have a color palette set for the chart.
// This rotates by default.
function ensureColors(config: NormalConfig) {
  config.color ||= paletteForPath()
}

// Infer axis config from encoded field metadata.
function inferAxesFromEncodedFields(config: NormalConfig, fields: Field[], rows: Record<string, any>[]) {
  for (let [axisIndex, axis] of config.xAxis.entries()) {
    if (!axis) continue
    let seriesOnAxis = config.series.filter(entry => Number(entry?.xAxisIndex ?? 0) === axisIndex)
    let field = seriesOnAxis.map(entry => getEncodeField(entry, fields, 'x')).find(Boolean)
    let inferred = inferAxisFromField(field, rows)

    config.xAxis[axisIndex] = {...inferred, ...axis, axisLabel: {...inferred.axisLabel, ...axis.axisLabel}, axisPointer: {...inferred.axisPointer, ...axis.axisPointer}}
  }

  for (let [axisIndex, axis] of config.yAxis.entries()) {
    if (!axis) continue
    let seriesOnAxis = config.series.filter(entry => Number(entry?.yAxisIndex ?? 0) === axisIndex)
    let field = seriesOnAxis.map(entry => getSeriesValueField(entry, fields)).find(Boolean)
    let inferred = inferAxisFromField(field, rows)

    config.yAxis[axisIndex] = {...inferred, ...axis, axisLabel: {...inferred.axisLabel, ...axis.axisLabel}, axisPointer: {...inferred.axisPointer, ...axis.axisPointer}}
  }
}

// Value-axis bars are centered on their x/y value, so explicit min/max domains clip edge bars.
// Expand only already-set value domains to give bars half a bucket of breathing room.
function extendValueAxisDomainsForBars(config: NormalConfig) {
  for (let [dimension, axes] of [
    ['x', config.xAxis],
    ['y', config.yAxis],
  ] as const) {
    for (let [axisIndex, axis] of axes.entries()) {
      let mutable = axis as Record<string, any>
      if (mutable?.type !== 'value' || mutable.min == null || mutable.max == null) continue

      let hasBarSeries = config.series.some(series => series?.type === 'bar' && Number(series?.[`${dimension}AxisIndex`] ?? 0) === axisIndex)
      if (!hasBarSeries) continue

      mutable.min -= 0.5
      mutable.max += 0.5
    }
  }
}

// Ensure that times looks nice. Unlike base echarts, we have metadata about the time value we can use.
function timeFormatting(config: NormalConfig) {
  let tooltip = config.tooltip[0] as Record<string, any> | undefined
  if (tooltip?.axisPointer?.label?.formatter) return

  for (let axis of config.xAxis) {
    if (!axis || axis.type !== 'time') continue
    if (axis.axisPointer?.label?.formatter != null) continue

    let timeGrain = String(axis.field?.metadata?.timeGrain || '').toLowerCase()
    if (!timeGrain) continue

    // axisPointer affects the formatting of the tooltip, but not the axis labels themselves
    axis.axisPointer ||= {}
    axis.axisPointer.label ||= {}
    axis.axisPointer.label.formatter = makeTimeFormatter(axis.field)
  }
}

// Keep line/area markers readable by default.
// - Respect explicit `showSymbol` from users.
// - Category/time/ordinal axes: show markers for small series (< 30 points).
// - Other value axes: hide markers by default.
function lineSeriesMarkerVisibility(config: NormalConfig, rows: Record<string, any>[], fields: Field[]) {
  for (let series of config.series) {
    if (series?.type !== 'line' || series.showSymbol != null) continue

    let axisIndex = Number(series.xAxisIndex ?? 0)
    let axis = config.xAxis[axisIndex]
    if (axis?.type === 'value' && !axis.field?.metadata?.timeOrdinal) {
      series.showSymbol = false
      continue
    }

    if (axis?.type !== 'category' && axis?.type !== 'time' && axis?.type !== 'value') {
      series.showSymbol = false
      continue
    }

    let xField = getEncodeField(series, fields, 'x')
    if (!xField) {
      series.showSymbol = false
      continue
    }

    series.showSymbol = distinctValues(rows, xField.name).length < 30
  }
}

// ECharts just does a bad job of this, and the title, legend, and chart can often overlap
// This computes the proper offsets depending on what's visible
function computeTitleLegendAndGridPadding(config: NormalConfig) {
  // you're doing crazy stuff, and on your own
  if (config.legend.length > 1 || config.title.length > 1 || config.grid.length > 1) return

  let legend = config.legend[0] || {}
  let title = config.title[0] || {}
  let grid = config.grid[0] || {}

  title.top = numericOffset(title.top, 2)
  legend.top = numericOffset(legend.top, 6)
  grid.top = numericOffset(grid.top, 12)

  if (title?.text) {
    legend.top = numericOffset(legend.top, 18)
    grid.top = numericOffset(grid.top, 28)
  }

  if (legend?.show) {
    grid.top = numericOffset(grid.top, 24)
  }
}

// When you toggle a series in the legend, we re-render the chart.
// This preserves the users selection, but also means that the currently selected series are available to enrichments.
function applyLegendSelection(config: NormalConfig) {
  if (!config.legendSelection) return
  config.legend[0] = {...config.legend[0], selected: config.legendSelection as any}
}

// Set default value formatting for value axes and series tooltips.
// We derive one formatter per field so axis labels and hover values stay consistent.
function valueFormatting(config: NormalConfig, fields: Field[]) {
  let valueAxes = [...config.xAxis, ...config.yAxis].filter(axis => axis?.type === 'value' && !axis.field?.metadata?.timeOrdinal)
  for (let axis of valueAxes) {
    if (axis.axisLabel?.formatter != null) continue
    axis.axisLabel = {...axis.axisLabel, formatter: makeValueFormatter(axis.field ? [axis.field] : [])}
  }

  for (let series of config.series) {
    series.tooltip ||= {}
    if (series.tooltip?.formatter || series.tooltip.valueFormatter) continue
    series.tooltip.valueFormatter = makeValueFormatter(getSeriesValueFields(series, fields))
  }
}

// Hide value y-axes for stacked-100 charts, since values are percentages and labels are usually redundant.
function hideStackPercentageValueAxis(config: NormalConfig, fields: Field[]) {
  for (let [axisIndex, axis] of config.yAxis.entries()) {
    if (!axis || axis.type !== 'value' || axis.show != null) continue

    let seriesOnAxis = config.series.filter(entry => Number(entry?.yAxisIndex ?? 0) === axisIndex)
    if (seriesOnAxis.length === 0) continue

    let yFields = seriesOnAxis.map(entry => getSeriesValueField(entry, fields)).filter((f): f is Field => !!f)
    if (yFields.length === 0) continue

    if (yFields.every(field => field.name.startsWith('__graphene_stack_pct_'))) axis.show = false
  }
}

// When value axes are hidden (like stacked-100 charts), reclaim the default left gutter.
function removeHiddenValueAxisPadding(config: NormalConfig) {
  if (config.grid.length !== 1) return
  if (config.yAxis.length === 0) return
  if (config.yAxis.some(axis => axis?.show !== false)) return

  let grid = config.grid[0]
  if (!grid || grid.left != null) return
  grid.left = 16
}

// For the simple bar+line mixed-chart case, keep axis styling consistent with assigned series:
// - axis labels/values on the second axis match primary axis formatting
// - first axis uses bar series color (when there is only one bar series shape)
// - second axis uses line series color
// In anything more complex, we bail to avoid surprising defaults.
function styleSecondaryAxisForSimpleBarLineLayout(config: NormalConfig, fields: Field[]) {
  if (config.yAxis.length < 2) return

  let series = config.series

  let bars = series.filter(entry => Number(entry?.yAxisIndex ?? 0) === 0 && entry?.type === 'bar')
  if (bars.length === 0) return

  let secondary = series.filter(entry => Number(entry?.yAxisIndex ?? 0) === 1)
  if (secondary.length !== 1 || secondary[0]?.type !== 'line') return

  if (series.some(entry => Number(entry?.yAxisIndex ?? 0) === 0 && entry?.type !== 'bar')) return
  if (series.some(entry => Number(entry?.yAxisIndex ?? 0) > 1)) return

  let barYFields = new Set(bars.map(entry => getSeriesValueField(entry, fields)?.name).filter(Boolean))
  if (barYFields.size !== 1) return

  let primaryAxis = config.yAxis[0]
  let secondaryAxis = config.yAxis[1]
  if (!primaryAxis || !secondaryAxis) return

  let barSeriesColor = seriesColorForIndex(config, series, bars[0])
  let lineSeriesColor = seriesColorForIndex(config, series, secondary[0])

  if (barSeriesColor) applyAxisColor(primaryAxis, barSeriesColor)
  if (lineSeriesColor) applyAxisColor(secondaryAxis, lineSeriesColor)

  let primaryFormatter = primaryAxis.axisLabel?.formatter
  if (typeof primaryFormatter === 'function' && secondaryAxis.axisLabel?.formatter == null) {
    secondaryAxis.axisLabel = {...secondaryAxis.axisLabel, formatter: (value: unknown) => formatAxisValue(primaryFormatter, value)}
  }
}

// This is trying to fix an issue with charts where every value is either 0 or 1.
// TODO: just make this a test, and see if we still need it
function applyIntegerYAxisTicks(config: NormalConfig, rows: Record<string, any>[], fields: Field[]) {
  let yAxis = config.yAxis[0]
  if (!yAxis || yAxis.type !== 'value' || yAxis.minInterval != null) return

  let yFields = Array.from(new Set(config.series.map(series => getSeriesValueField(series, fields)?.name).filter(Boolean))) as string[]
  let values = rows.flatMap(row => yFields.map(field => Number(row?.[field]))).filter(value => Number.isFinite(value))

  if (values.length === 0) return
  if (values.every(value => Number.isInteger(value))) yAxis.minInterval = 1
}

// Keep bar labels readable by default: place them outside bars and avoid overlap when possible.
function barLabelPositioning(config: NormalConfig) {
  let horizontal = isHorizontalBar(config)

  for (let series of config.series) {
    if (series?.type !== 'bar' || !series.label || series.label.show !== true) continue

    if (series.label.position == null) series.label.position = horizontal ? 'right' : 'top'
    if (series.label.distance == null) series.label.distance = 4
    if (series.labelLayout == null || typeof series.labelLayout === 'function') series.labelLayout = {}
    let labelLayout = series.labelLayout as Record<string, any>
    if (labelLayout.hideOverlap == null) labelLayout.hideOverlap = true
  }
}

// Match series data labels to the assigned y-axis formatter when labels are enabled.
// This keeps label formatting in sync with the y-axis without asking callers to repeat it.
// labelsUseYAxisFormat depends on valueAxisFormatting running first so labels inherit axis formatting.
function labelsUseYAxisFormat(config: NormalConfig, fields: Field[]) {
  for (let series of config.series) {
    // No-op when labels are off or already explicitly formatted.
    if (!series?.label || series.label.show !== true || series.label.formatter != null) continue

    let yField = getSeriesValueField(series, fields)?.name
    let axisIndex = Number(series.yAxisIndex ?? 0)
    let axisFormatter = config.yAxis[axisIndex]?.axisLabel?.formatter
    if (typeof axisFormatter !== 'function') continue

    // ECharts can pass different value shapes depending on series/transform shape.
    // We resolve the numeric value in a few fallback steps so labels always use the
    // same value the y-axis is formatting.
    series.label.formatter = (params: unknown) => {
      let typed = params as {value?: unknown; data?: Record<string, unknown>}
      let value = typed?.value

      if (yField) {
        if (typed?.data && typeof typed.data === 'object' && yField in typed.data) value = typed.data[yField]
        if (typed?.value && typeof typed.value === 'object' && !Array.isArray(typed.value) && yField in (typed.value as Record<string, unknown>)) {
          value = (typed.value as Record<string, unknown>)[yField]
        }
      }

      return formatAxisValue(axisFormatter, value)
    }
  }
}

// Add a pie-friendly default tooltip formatter when charts include pie series.
// Pie params can pass row objects as `params.value`, so we format from the encoded value field.
function addPieTooltips(config: NormalConfig, fields: Field[]) {
  if (!config.series.some(series => series?.type === 'pie')) return

  let tooltip = config.tooltip[0]
  if (!tooltip || tooltip.formatter != null) return

  tooltip.trigger = 'item'
  tooltip.formatter = (params: any) => {
    let value = params?.value
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      let series = config.series[Number(params?.seriesIndex ?? 0)]
      let yField = getSeriesValueField(series, fields)?.name
      value = yField && value[yField] != null ? value[yField] : value.value
    }
    return `${params?.name ?? ''}: ${value ?? ''} (${params?.percent ?? 0}%)`
  }
}

// Round only the topmost (or rightmost for horizontal) visible non-zero bar in each stack slot.
function stackedBarCornerRadius(config: NormalConfig) {
  let horizontal = isHorizontalBar(config)
  let cornerRadius = horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]
  let valueIndex = horizontal ? 0 : 1
  let selected = config.legend[0]?.selected || {}
  let stacks = new Map<string, SeriesWithGroupingHint[]>()

  // Unstacked bars can use a single series-level radius.
  for (let series of config.series) {
    if (series?.type !== 'bar' || series?.stack || series?.itemStyle?.borderRadius != null) continue
    series.itemStyle = {...series.itemStyle, borderRadius: cornerRadius}
  }

  for (let [index, series] of config.series.entries()) {
    if (series?.type !== 'bar' || series?.itemStyle?.borderRadius != null || !Array.isArray(series.data)) continue

    let axisKey = `${Number(series.xAxisIndex ?? 0)}:${Number(series.yAxisIndex ?? 0)}`
    let stackKey = series.stack ?? `__  graphene_unstacked_${index}`
    let key = `${axisKey}::${stackKey}`
    let group = stacks.get(key) ?? []
    group.push(series)
    stacks.set(key, group)
  }

  // For each stack slot, scan top-down and round the first visible non-zero segment.
  for (let stackSeries of stacks.values()) {
    let maxPoints = Math.max(...stackSeries.map(series => (series.data as unknown[]).length), 0)

    for (let pointIndex = 0; pointIndex < maxPoints; pointIndex++) {
      for (let seriesIndex = stackSeries.length - 1; seriesIndex >= 0; seriesIndex--) {
        let series = stackSeries[seriesIndex]
        if (selected[series.name || ''] === false) continue

        let point = (series.data as unknown[])[pointIndex]
        if (!point || typeof point !== 'object') continue

        let value = Number((point as Record<string, any>)?.value?.[valueIndex])
        if (!Number.isFinite(value) || value === 0) continue

        let typed = point as Record<string, any>
        let existingItemStyle = typed.itemStyle && typeof typed.itemStyle === 'object' ? typed.itemStyle : {}
        ;(series.data as Record<string, any>[])[pointIndex] = {...typed, itemStyle: {...existingItemStyle, borderRadius: cornerRadius}}
        break
      }
    }
  }
}

function normalizeArray<T>(value: unknown): T[] {
  if (value == null) return []
  return Array.isArray(value) ? (value as T[]) : [value as T]
}

function numericOffset(value: unknown, delta: number) {
  return typeof value === 'number' ? value + delta : delta
}

function formatAxisValue(formatter: (...args: any[]) => unknown, value: unknown) {
  return String(formatter(value, 0))
}

function seriesColorForIndex(config: NormalConfig, seriesList: SeriesWithGroupingHint[], targetSeries: SeriesWithGroupingHint) {
  let index = seriesList.indexOf(targetSeries)
  if (index < 0) return undefined

  let explicit = targetSeries?.itemStyle?.color || targetSeries?.lineStyle?.color || targetSeries?.areaStyle?.color || targetSeries?.color
  if (typeof explicit === 'string') return explicit

  if (!Array.isArray(config.color)) return undefined
  let palette = config.color.filter(color => typeof color === 'string')
  if (palette.length === 0) return undefined
  return palette[index % palette.length]
}

function applyAxisColor(axis: NormalConfig['yAxis'][number], color: string) {
  if (!axis) return
  axis.axisLine = {...axis.axisLine, lineStyle: {...axis.axisLine?.lineStyle, color}}
  axis.axisTick = {...axis.axisTick, lineStyle: {...axis.axisTick?.lineStyle, color}}
  axis.nameTextStyle = {...axis.nameTextStyle, color}
  axis.axisLabel = {...axis.axisLabel, color}
}

function isHorizontalBar(config: NormalConfig) {
  let xAxis = config.xAxis[0]
  let yAxis = config.yAxis[0]
  let hasBarSeries = config.series.some(series => series?.type === 'bar')
  return Boolean(hasBarSeries && xAxis?.type === 'value' && yAxis?.type === 'category')
}

function horizontalBarGuard(config: NormalConfig, fields: Field[]) {
  if (!isHorizontalBar(config)) return

  let hasInvalidCategoryField = config.series
    .filter(series => series?.type === 'bar')
    .map(series => getEncodeField(series, fields, 'y')?.type)
    .some(type => type === 'date' || type === 'timestamp' || type === 'number')

  if (hasInvalidCategoryField) throw new Error('Horizontal charts do not support a value or time-based x-axis')
}

// Build axis defaults from field metadata, including temporal domains and formatters.
function inferAxisFromField(field: Field | undefined, rows: Record<string, any>[]) {
  if (!field) return {type: 'category'}
  if (typeof field.type !== 'string') throw new Error(`Field ${field.name} has unsupported non-scalar type: array`)

  let type: 'time' | 'value' | 'category' = 'category'
  if (field.type === 'date' || field.type === 'timestamp') type = 'time'
  if (field.type === 'number') type = 'value'
  let axis: Record<string, any> = {field, type}

  if (type === 'value') {
    let domain = temporalValueDomain(field, rows)
    if (domain) {
      axis.min = domain[0]
      axis.max = domain[1]
    }

    if (field.metadata?.timeOrdinal) {
      axis.minInterval = 1
      if (field.metadata.timeOrdinal === 'dow_0s' || field.metadata.timeOrdinal === 'dow_1s' || field.metadata.timeOrdinal === 'dow_1m' || field.metadata.timeOrdinal === 'quarter_of_year') {
        axis.splitNumber = Math.max(1, domain ? domain[1] - domain[0] + 1 : 5)
      }
      axis.axisLabel = {formatter: (value: unknown) => (domain && (Number(value) < domain[0] || Number(value) > domain[1]) ? '' : formatTimeOrdinal(field, value))}
      axis.axisPointer = {label: {formatter: (value: unknown) => formatTimeOrdinal(field, value)}}
      return axis
    }

    if (field.metadata?.timePart === 'year') {
      axis.minInterval = 1
      axis.axisLabel = {formatter: (value: unknown) => (Number.isInteger(Number(value)) ? String(Number(value)) : '')}
    }
  }

  if (type === 'category' && field.metadata?.timeOrdinal) {
    axis.axisLabel = {formatter: (value: unknown) => formatTimeOrdinal(field, value)}
    axis.axisPointer = {label: {formatter: (value: unknown) => formatTimeOrdinal(field, value)}}
  }

  return axis
}

// Return the natural numeric domain for temporal values that are encoded as numbers.
function temporalValueDomain(field: Field, rows: Record<string, any>[]): [number, number] | undefined {
  let ordinal = field.metadata?.timeOrdinal
  if (ordinal === 'hour_of_day') return [0, 23]
  if (ordinal === 'day_of_month') return [1, 31]
  if (ordinal === 'day_of_year') return [1, 366]
  if (ordinal === 'week_of_year') return [1, 53]
  if (ordinal === 'month_of_year') return [1, 12]
  if (ordinal === 'quarter_of_year') return [1, 4]
  if (ordinal === 'dow_0s') return [0, 6]
  if (ordinal === 'dow_1s' || ordinal === 'dow_1m') return [1, 7]

  if (field.metadata?.timePart == 'year') {
    let values = rows.map(row => Number(row?.[field.name])).filter(value => Number.isFinite(value))
    if (values.length === 0) return undefined
    return [Math.min(...values), Math.max(...values)]
  }
}

// Series sometimes encode their value field as `y` and sometimes as `value` (pie, funnel, etc).
function getSeriesValueField(series: SeriesWithGroupingHint | undefined, fields: Field[]) {
  return getEncodeField(series, fields, 'y') ?? getEncodeField(series, fields, 'value')
}

// The field(s) to format in a series' tooltip. Depends on series type since scatter/bar put the numeric value in different encode props.
function getSeriesValueFields(series: SeriesWithGroupingHint, fields: Field[]) {
  switch (series.type) {
    case 'scatter':
    case 'effectScatter':
      return [getEncodeField(series, fields, 'x'), getEncodeField(series, fields, 'y')].filter((f): f is Field => !!f)
    case 'bar': {
      let xField = getEncodeField(series, fields, 'x')
      let yField = getEncodeField(series, fields, 'y')
      return xField?.type == 'number' ? [xField] : [yField].filter((f): f is Field => !!f)
    }
    default:
      return [getEncodeField(series, fields, 'y')].filter((f): f is Field => !!f)
  }
}

// The props on series.encode can either be a string, or an array.
// In all cases, this returns the corresponding fields for each item.
function getEncodeFields(series: SeriesWithGroupingHint | undefined, fields: Field[], encodeProp: string): Field[] {
  let raw = series?.encode?.[encodeProp]
  let names: string[] = []
  if (Array.isArray(raw)) names = raw.filter((v): v is string => typeof v === 'string')
  if (typeof raw === 'string') names = [raw]

  return names.map(name => fields.find(f => f.name === name)).filter((f): f is Field => !!f)
}

function getEncodeField(series: SeriesWithGroupingHint | undefined, fields: Field[], encodeProp: string): Field | undefined {
  return getEncodeFields(series, fields, encodeProp)[0]
}

function inferDimensions(rows: Record<string, any>[]) {
  let sample = rows.find(row => row && typeof row === 'object')
  if (!sample) return []
  return Object.keys(sample)
}

function distinctValues(rows: Record<string, any>[], field: string) {
  let values: unknown[] = []
  let seen = new Set<string>()
  for (let row of rows) {
    let value = row?.[field]
    let key = JSON.stringify(value ?? null)
    if (seen.has(key)) continue
    seen.add(key)
    values.push(value)
  }
  return values
}
