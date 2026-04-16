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

  // Resolve axis types/fields up front so row shaping (like explicit sorting) can use axis metadata.
  inferAxisTypesFromEncodedFields(normalized, fields)

  // Mutate row/field data before dataset creation so synthesized fields are reflected in dataset dimensions.
  applyMissingPointDefaults(normalized, rows)
  applyStackPercentage(normalized, rows, fields)
  applySorting(normalized, rows, fields)

  let baseDatasetId = ensureDataset(normalized, rows, fields)
  expandSeriesTransforms(normalized, rows, baseDatasetId)

  // stylistic rules to provide great defaults
  lineSeriesMarkerVisibility(normalized, rows)
  horizontalBarGuard(normalized, fields)
  computeTitleLegendAndGridPadding(normalized)
  applyLegendSelection(normalized)
  hideStackPercentageValueAxis(normalized)
  removeHiddenValueAxisPadding(normalized)
  valueFormatting(normalized, fields)
  timeFormatting(normalized)
  ordinalFormatting(normalized)
  styleSecondaryAxisForSimpleBarLineLayout(normalized)
  applyIntegerYAxisTicks(normalized, rows)
  barLabelPositioning(normalized)
  labelsUseYAxisFormat(normalized)
  addPieTooltips(normalized)
  inlineDataIntoSeries(normalized, rows)
  stackedBarCornerRadius(normalized)
  return normalized
}

// For horizontal bars, count distinct category values so wrappers can size containers.
export function horizontalBarCount(config: NormalConfig, rows: Record<string, any>[]) {
  if (!isHorizontalBar(config)) return 0

  let categoryFields = config.series
    .filter(series => series?.type === 'bar')
    .map(series => getSeriesCategoryFieldForHorizontal(series))
    .filter(Boolean) as string[]

  if (categoryFields.length === 0) return 0
  return Math.max(...categoryFields.map(field => distinctValues(rows, field).length))
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

// Expand series templates that use `encode.splitBy` into one concrete series per distinct field value.
// We do this with ECharts dataset filter transforms so wrappers stay small and users don't need to duplicate series configs.
function expandSeriesTransforms(config: NormalConfig, rows: Record<string, any>[], baseDatasetId: string) {
  let templates = config.series
  let expanded: SeriesWithGroupingHint[] = []

  templates.forEach((entry, templateIndex) => {
    let splitFields = getSplitByFields(entry)
    if (splitFields.length === 0) {
      let next = {...entry}
      if (shouldBindSeriesToDataset(next) && next.datasetId == null) next.datasetId = baseDatasetId
      expanded.push(next)
      return
    }

    if (splitFields.length > 2) throw new Error('encode.splitBy supports at most two fields')

    let sourceDatasetId = entry.datasetId ?? baseDatasetId

    if (splitFields.length === 2) {
      if (entry?.type !== 'bar') throw new Error('encode.splitBy with two fields is only supported for bar series')

      let [groupField, stackField] = splitFields
      let groupValues = distinctValues(rows, groupField)
      let stackValues = distinctValues(rows, stackField)
      if (groupValues.length === 0 || stackValues.length === 0) return

      groupValues.forEach((groupValue, groupIndex) => {
        let groupedDatasetId = `__graphene_series_${templateIndex}_${groupIndex}`
        config.dataset.push({
          id: groupedDatasetId,
          fromDatasetId: sourceDatasetId,
          transform: {type: 'filter', config: {dimension: groupField, '=': groupValue}},
        })

        stackValues.forEach((stackValue, stackIndex) => {
          let datasetId = `__graphene_series_${templateIndex}_${groupIndex}_${stackIndex}`
          config.dataset.push({
            id: datasetId,
            fromDatasetId: groupedDatasetId,
            transform: {type: 'filter', config: {dimension: stackField, '=': stackValue}},
          })

          let next = {...entry, datasetId, stack: String(groupValue ?? '')}
          if (next.name == null) next.name = `${String(groupValue ?? '')} · ${String(stackValue ?? '')}`
          if (next.encode) {
            next.encode = {...next.encode}
            delete next.encode.splitBy
          }
          expanded.push(next)
        })
      })

      return
    }

    let splitField = splitFields[0]
    let seriesValues = distinctValues(rows, splitField)
    if (seriesValues.length === 0) return

    seriesValues.forEach((seriesValue, valueIndex) => {
      let datasetId = `__graphene_series_${templateIndex}_${valueIndex}`
      config.dataset.push({
        id: datasetId,
        fromDatasetId: sourceDatasetId,
        transform: {type: 'filter', config: {dimension: splitField, '=': seriesValue}},
      })

      let next = {...entry, datasetId}
      if (next.name == null) next.name = String(seriesValue ?? '')
      if (next.encode) {
        next.encode = {...next.encode}
        delete next.encode.splitBy
      }
      expanded.push(next)
    })
  })

  config.series = expanded
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

// Infer axis types from encoded field metadata.
function inferAxisTypesFromEncodedFields(config: NormalConfig, fields: Field[]) {
  for (let [axisIndex, axis] of config.xAxis.entries()) {
    if (!axis) continue
    let encodedFields = config.series
      .filter(entry => Number(entry?.xAxisIndex ?? 0) === axisIndex)
      .map(entry => getSeriesXField(entry))
      .filter(Boolean) as string[]

    axis.field ||= fields.find(field => field.name === encodedFields[0])
    axis.type ||= inferAxisTypeFromFields(fields, encodedFields)
  }

  for (let [axisIndex, axis] of config.yAxis.entries()) {
    if (!axis) continue
    let encodedFields = config.series
      .filter(entry => Number(entry?.yAxisIndex ?? 0) === axisIndex)
      .map(entry => getSeriesValueFieldName(entry))
      .filter(Boolean) as string[]

    axis.field ||= fields.find(field => field.name === encodedFields[0])
    axis.type ||= inferAxisTypeFromFields(fields, encodedFields)
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

// Format categorical time ordinals like hour_of_day and day_of_week using field metadata.
function ordinalFormatting(config: NormalConfig) {
  let axes = [...config.xAxis, ...config.yAxis]
  for (let axis of axes) {
    if (!axis || axis.type !== 'category') continue
    if (!axis.field?.metadata?.timeOrdinal) continue

    if (axis.axisLabel?.formatter == null) {
      axis.axisLabel = {...axis.axisLabel, formatter: (input: unknown) => formatTimeOrdinal(axis.field, input)}
    }

    if (axis.axisPointer?.label?.formatter == null) {
      axis.axisPointer ||= {}
      axis.axisPointer.label ||= {}
      axis.axisPointer.label.formatter = (input: unknown) => formatTimeOrdinal(axis.field, input)
    }
  }
}

// Keep line/area markers readable by default.
// - Respect explicit `showSymbol` from users.
// - Category/time axes: show markers for small series (< 30 points).
// - Value axes: hide markers by default.
function lineSeriesMarkerVisibility(config: NormalConfig, rows: Record<string, any>[]) {
  for (let series of config.series) {
    if (series?.type !== 'line' || series.showSymbol != null) continue

    let axisIndex = Number(series.xAxisIndex ?? 0)
    let axisType = config.xAxis[axisIndex]?.type
    if (axisType === 'value') {
      series.showSymbol = false
      continue
    }

    if (axisType !== 'category' && axisType !== 'time') {
      series.showSymbol = false
      continue
    }

    let xField = getSeriesXField(series)
    if (!xField) {
      series.showSymbol = false
      continue
    }

    series.showSymbol = distinctValues(rows, xField).length < 30
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
  let valueAxes = [...config.xAxis, ...config.yAxis].filter(axis => axis?.type === 'value')
  for (let axis of valueAxes) {
    if (axis.axisLabel?.formatter != null) continue
    axis.axisLabel = {...axis.axisLabel, formatter: makeValueFormatter(axis.field)}
  }

  for (let series of config.series) {
    series.tooltip ||= {}
    let tooltip = series.tooltip as Record<string, any>
    if (tooltip.formatter != null || tooltip.valueFormatter != null) continue

    let field = getSeriesValueField(series, fields)
    tooltip.valueFormatter = makeValueFormatter(field)
  }
}

// Hide value y-axes for stacked-100 charts, since values are percentages and labels are usually redundant.
function hideStackPercentageValueAxis(config: NormalConfig) {
  for (let [axisIndex, axis] of config.yAxis.entries()) {
    if (!axis || axis.type !== 'value' || axis.show != null) continue

    let seriesOnAxis = config.series.filter(entry => Number(entry?.yAxisIndex ?? 0) === axisIndex)
    if (seriesOnAxis.length === 0) continue

    let yFields = seriesOnAxis.map(entry => getSeriesValueFieldName(entry)).filter(Boolean) as string[]
    if (yFields.length === 0) continue

    if (yFields.every(name => name.startsWith('__graphene_stack_pct_'))) axis.show = false
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
function styleSecondaryAxisForSimpleBarLineLayout(config: NormalConfig) {
  if (config.yAxis.length < 2) return

  let series = config.series

  let bars = series.filter(entry => Number(entry?.yAxisIndex ?? 0) === 0 && entry?.type === 'bar')
  if (bars.length === 0) return

  let secondary = series.filter(entry => Number(entry?.yAxisIndex ?? 0) === 1)
  if (secondary.length !== 1 || secondary[0]?.type !== 'line') return

  if (series.some(entry => Number(entry?.yAxisIndex ?? 0) === 0 && entry?.type !== 'bar')) return
  if (series.some(entry => Number(entry?.yAxisIndex ?? 0) > 1)) return

  let barYFields = Array.from(new Set(bars.map(entry => getSeriesValueFieldName(entry)).filter(Boolean))) as string[]
  if (barYFields.length !== 1) return

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
function applyIntegerYAxisTicks(config: NormalConfig, rows: Record<string, any>[]) {
  let yAxis = config.yAxis[0]
  if (!yAxis || yAxis.type !== 'value' || yAxis.minInterval != null) return

  let yFields = Array.from(new Set(config.series.map(series => getSeriesValueFieldName(series)).filter(Boolean))) as string[]
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
function labelsUseYAxisFormat(config: NormalConfig) {
  for (let series of config.series) {
    // No-op when labels are off or already explicitly formatted.
    if (!series?.label || series.label.show !== true || series.label.formatter != null) continue

    let yField = getSeriesValueFieldName(series)
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
function addPieTooltips(config: NormalConfig) {
  if (!config.series.some(series => series?.type === 'pie')) return

  let tooltip = config.tooltip[0]
  if (!tooltip || tooltip.formatter != null) return

  tooltip.trigger = 'item'
  tooltip.formatter = (params: any) => {
    let value = params?.value
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      let series = config.series[Number(params?.seriesIndex ?? 0)]
      let yField = getSeriesValueFieldName(series)
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
    .map(series => fieldType(fields, getSeriesCategoryFieldForHorizontal(series)))
    .some(type => type === 'date' || type === 'timestamp' || type === 'number')

  if (hasInvalidCategoryField) throw new Error('Horizontal charts do not support a value or time-based x-axis')
}

function fieldType(fields: Field[], fieldName?: string): string {
  if (!fieldName) return 'unknown'

  let field = fields.find(entry => entry.name === fieldName)
  if (!field) return 'unknown'
  if (typeof field.type !== 'string') throw new Error(`Field ${fieldName} has unsupported non-scalar type: array`)
  return field.type
}

function inferAxisTypeFromFields(fields: Field[], fieldNames: string[]) {
  let resolved = fieldNames.map(name => fields.find(field => field.name === name)).filter(Boolean) as Field[]
  if (resolved.some(field => field?.metadata?.timeOrdinal)) return 'category'

  let types = resolved.map(field => {
    if (typeof field.type !== 'string') throw new Error(`Field ${field.name} has unsupported non-scalar type: array`)
    return field.type
  })

  if (types.some(type => type === 'date' || type === 'timestamp')) return 'time'
  if (types.some(type => type === 'number')) return 'value'
  return 'category'
}

function getSeriesXField(series?: SeriesWithGroupingHint) {
  return getEncodeField(series?.encode?.x)
}

function getSeriesValueFieldName(series?: SeriesWithGroupingHint) {
  return getEncodeField(series?.encode?.y) ?? getEncodeField(series?.encode?.value)
}

function getSeriesValueField(series: SeriesWithGroupingHint, fields: Field[]) {
  let fieldName = getSeriesValueFieldName(series)
  if (!fieldName) return undefined
  return fields.find(field => field.name === fieldName)
}

function getSeriesCategoryFieldForHorizontal(series?: SeriesWithGroupingHint) {
  return getEncodeField(series?.encode?.y)
}

function getSplitByFields(series?: SeriesWithGroupingHint) {
  let splitBy = series?.encode?.splitBy
  if (typeof splitBy === 'string') return [splitBy]
  if (!Array.isArray(splitBy)) return []
  return splitBy
    .filter(value => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean)
}

function getEncodeField(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.find(entry => typeof entry === 'string')
  return undefined
}

function shouldBindSeriesToDataset(series: SeriesWithGroupingHint) {
  return series?.encode != null && series?.data == null
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
