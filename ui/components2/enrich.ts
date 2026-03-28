import {colorPalette} from './theme.ts'
import {applyDefaultSorting, applyMissingPointDefaults, applyStackPercentage} from './dataShaping.ts'
import type {EChartsConfig2, Field, NormalConfig, SeriesWithGroupingHint} from './types.ts'

// Enrichment is the process through which we take an echarts config and add in some defaults to make it really nice.
// A lot of defaulting happens in themes but there are some defaults themes can't handle, like when it depends on the shape of data being charted.
// Each enrichment function is a small, ideally single-purpose manipulation of the config.
// As a rule, if the provided config sets something, enrichments will not change it.

// Each enrichment must have a comment above it describing what it does, and perhaps why it's needed if it isn't obvious.
// Enrichments should also have comments inside explaining how they work if the logic is non-trivial

// Run enrichment in a fixed order so defaults stay predictable.
export function enrich(config: EChartsConfig2, rows: Record<string, any>[], fields: Field[]) {
  let normalized = normalize(config)

  // Mutate row/field data before dataset creation so synthesized fields are reflected in dataset dimensions.
  applyMissingPointDefaults(normalized, rows)
  applyStackPercentage(normalized, rows, fields)
  applyDefaultSorting(normalized, rows, fields)

  let baseDatasetId = ensureDataset(normalized, rows, fields)

  // generates the required number of `series` objects for this data
  expandSeriesTransforms(normalized, rows, baseDatasetId)

  // stylistic rules to provide great defaults
  inferAxisTypesFromEncodedFields(normalized, fields)
  horizontalBarGuard(normalized, fields)
  computeTitleLegendAndGridPadding(normalized)
  valueAxisFormatting(normalized, fields)
  styleSecondaryAxisForSimpleBarLineLayout(normalized)
  applyIntegerYAxisTicks(normalized, rows)
  barLabelPositioning(normalized)
  labelsUseYAxisFormat(normalized)
  stackedBarCornerRadius(normalized)
  return normalized
}

// Normalize options we read in enrichments so later rules can always iterate arrays.
function normalize(config: EChartsConfig2): NormalConfig {
  let target = config as NormalConfig
  target.series = normalizeArray<SeriesWithGroupingHint>(config.series)
  target.xAxis = normalizeArray<NormalConfig['xAxis'][number]>(config.xAxis)
  target.yAxis = normalizeArray<NormalConfig['yAxis'][number]>(config.yAxis)
  target.dataset = normalizeArray<NormalConfig['dataset'][number]>(config.dataset)
  target.grid = normalizeArray<NormalConfig['grid'][number]>(config.grid)
  if (target.grid.length === 0) target.grid.push({} as NormalConfig['grid'][number])
  target.legend = normalizeArray<NormalConfig['legend'][number]>(config.legend)
  target.title = normalizeArray<NormalConfig['title'][number]>(config.title)
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

// Expand series templates that use `encode.group` or `encode.stack` into one concrete series per distinct field value.
// We do this with ECharts dataset filter transforms so wrappers stay small and users don't need to duplicate series configs.
function expandSeriesTransforms(config: NormalConfig, rows: Record<string, any>[], baseDatasetId: string) {
  let templates = config.series
  let expanded: SeriesWithGroupingHint[] = []

  templates.forEach((entry, templateIndex) => {
    let groupField = typeof entry?.encode?.group === 'string' ? entry.encode.group : undefined
    let stackField = typeof entry?.encode?.stack === 'string' ? entry.encode.stack : undefined

    if (groupField && stackField) throw new Error('Series encode.group and encode.stack cannot both be set')

    let splitField = groupField ?? stackField
    if (!splitField) {
      let next = {...entry}
      if (shouldBindSeriesToDataset(next) && next.datasetId == null) next.datasetId = baseDatasetId
      expanded.push(next)
      return
    }

    let seriesValues = distinctValues(rows, splitField)
    if (seriesValues.length === 0) return

    let sourceDatasetId = entry.datasetId ?? baseDatasetId
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
        delete next.encode.group
        delete next.encode.stack
      }
      expanded.push(next)
    })
  })

  config.series = expanded
}

// Infer axis types from encoded field metadata.
function inferAxisTypesFromEncodedFields(config: NormalConfig, fields: Field[]) {
  let series = config.series

  config.xAxis.forEach((axis, axisIndex) => {
    if (!axis || axis.type != null) return
    let encodedFields = series
      .filter(entry => Number(entry?.xAxisIndex ?? 0) === axisIndex)
      .map(entry => getSeriesXField(entry))
      .filter(Boolean) as string[]

    axis.type = inferAxisTypeFromFields(fields, encodedFields)
  })

  config.yAxis.forEach((axis, axisIndex) => {
    if (!axis || axis.type != null) return
    let encodedFields = series
      .filter(entry => Number(entry?.yAxisIndex ?? 0) === axisIndex)
      .map(entry => getSeriesYField(entry))
      .filter(Boolean) as string[]

    axis.type = inferAxisTypeFromFields(fields, encodedFields)
  })
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

// Set default formatting for inferred value axes.
// We pick one field per axis (the first bound series) and derive formatter behavior from that field metadata.
function valueAxisFormatting(config: NormalConfig, fields: Field[]) {
  let currencySymbols = {usd: '$', eur: '€', gbp: '£', cad: 'C$', aud: 'A$', jpy: '¥'} as const
  let currencyCompact = new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1})

  // Keep numeric labels short while preserving rough magnitude and sign.
  let compact = (num: number) => {
    let exponent = Math.floor(Math.log10(Math.abs(num)))
    let scale = Math.pow(10, exponent - 2)
    let rounded = Math.round(num / scale) * scale
    if (!Number.isFinite(rounded)) return String(num)
    let magnitude = Math.floor(Math.log10(rounded))
    let decimals = Math.max(0, 2 - magnitude)
    return rounded.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.[0-9]*[1-9])0+$/, '$1').replace(/\.$/, '')
  }

  // Number formatter for non-currency value axes (k/M/B/T + m/u/n for very small values).
  let formatNumber = (amount: number) => {
    if (amount === 0) return '0'
    let sign = amount < 0 ? '-' : ''
    let absolute = Math.abs(amount)

    if (absolute >= 1e12) return `${sign}${compact(absolute / 1e12)}T`
    if (absolute >= 1e9) return `${sign}${compact(absolute / 1e9)}B`
    if (absolute >= 1e6) return `${sign}${compact(absolute / 1e6)}M`
    if (absolute >= 1e3) return `${sign}${compact(absolute / 1e3)}k`
    if (absolute >= 1) return `${sign}${compact(absolute)}`
    if (absolute >= 1e-3) return `${sign}${compact(absolute)}`
    if (absolute >= 1e-6) return `${sign}${compact(absolute * 1e3)}m`
    if (absolute >= 1e-9) return `${sign}${compact(absolute * 1e6)}u`
    if (absolute >= 1e-12) return `${sign}${compact(absolute * 1e9)}n`
    return `${sign}${compact(absolute)}`
  }

  // Apply one formatter per value axis unless the user already provided one.
  let applyAxisFormatter = (axis: NormalConfig['xAxis'][number] | NormalConfig['yAxis'][number], fieldName?: string) => {
    if (!axis || axis.type !== 'value' || axis.axisLabel?.formatter != null || !fieldName) return

    let field = findField(fields, fieldName)
    if (getFieldTypeFromMetadata(field) !== 'number') return

    let unit = field?.metadata?.units?.toLowerCase() as keyof typeof currencySymbols | undefined
    let currencyUnit = unit != null && unit in currencySymbols ? unit : undefined

    axis.axisLabel = {
      ...axis.axisLabel,
      formatter: (value: unknown) => {
        let amount = Number(value)
        if (!Number.isFinite(amount)) return String(value ?? '')

        if (currencyUnit) {
          let sign = amount < 0 ? '-' : ''
          let formatted = currencyCompact.format(Math.abs(amount)).replace('K', 'k').replace('M', 'm').replace('B', 'b')
          return `${sign}${currencySymbols[currencyUnit]}${formatted}`
        }

        return formatNumber(amount)
      },
    }
  }

  // Horizontal bar charts can have value x-axes, so format x and y axes symmetrically.
  for (let [axisIndex, axis] of config.xAxis.entries()) {
    // By design we use the first series on the axis as the metadata source.
    let firstSeries = config.series.find(entry => Number(entry?.xAxisIndex ?? 0) === axisIndex)
    applyAxisFormatter(axis, getSeriesXField(firstSeries))
  }

  for (let [axisIndex, axis] of config.yAxis.entries()) {
    // By design we use the first series on the axis as the metadata source.
    let firstSeries = config.series.find(entry => Number(entry?.yAxisIndex ?? 0) === axisIndex)
    applyAxisFormatter(axis, getSeriesYField(firstSeries))
  }
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

  let barYFields = Array.from(new Set(bars.map(entry => getSeriesYField(entry)).filter(Boolean))) as string[]
  if (barYFields.length !== 1) return

  let primaryAxis = config.yAxis[0]
  let secondaryAxis = config.yAxis[1]
  if (!primaryAxis || !secondaryAxis) return

  let palette = getThemeColorPalette(config)
  let barSeriesColor = seriesColorForIndex(series, bars[0], palette)
  let lineSeriesColor = seriesColorForIndex(series, secondary[0], palette)

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

  let yFields = Array.from(new Set(config.series.map(series => getSeriesYField(series)).filter(Boolean))) as string[]
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

    let yField = getSeriesYField(series)
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

// Add rounded corners only to the visible outer edge of each stack.
function stackedBarCornerRadius(config: NormalConfig) {
  let grouped = new Map<string, SeriesWithGroupingHint[]>()

  for (let series of config.series) {
    if (series?.type !== 'bar' || !series?.stack) continue
    let stackKey = String(series.stack)
    if (!grouped.has(stackKey)) grouped.set(stackKey, [])
    grouped.get(stackKey)?.push(series)
  }

  let horizontal = isHorizontalBar(config)
  for (let group of grouped.values()) {
    let lastSeries = group[group.length - 1]
    if (!lastSeries || lastSeries.itemStyle?.borderRadius != null) continue
    lastSeries.itemStyle = {...lastSeries.itemStyle, borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
  }
}

function normalizeArray<T>(value: unknown): T[] {
  if (value == null) return []
  return Array.isArray(value) ? (value as T[]) : [value as T]
}

function numericOffset(value: unknown, delta: number) {
  return typeof value === 'number' ? value + delta : delta
}

function formatAxisValue(formatter: Function, value: unknown) {
  return String(formatter(value, 0))
}

function getThemeColorPalette(config: NormalConfig) {
  let configColor = config.color
  if (Array.isArray(configColor) && configColor.length > 0) return configColor
  return colorPalette
}

function seriesColorForIndex(seriesList: SeriesWithGroupingHint[], targetSeries: SeriesWithGroupingHint, palette: string[]) {
  let index = seriesList.indexOf(targetSeries)
  if (index < 0) return undefined

  let explicit = targetSeries?.itemStyle?.color || targetSeries?.lineStyle?.color || targetSeries?.areaStyle?.color || targetSeries?.color
  if (typeof explicit === 'string') return explicit

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
    .map(series => findField(fields, getSeriesCategoryFieldForHorizontal(series)))
    .map(field => getFieldTypeFromMetadata(field))
    .some(type => type === 'date' || type === 'number')

  if (hasInvalidCategoryField) throw new Error('Horizontal charts do not support a value or time-based x-axis')
}

function findField(fields: Field[], fieldName?: string) {
  if (!fieldName) return undefined
  return fields.find(field => field.name === fieldName)
}

function getFieldTypeFromMetadata(field?: Field) {
  if (!field) return 'unknown'
  if (field.evidenceType === 'number' || field.type === 'number') return 'number'
  if (field.evidenceType === 'date' || field.type === 'date' || field.type === 'timestamp') return 'date'
  if (field.evidenceType === 'boolean' || field.type === 'boolean') return 'boolean'
  return 'string'
}

function inferAxisTypeFromFields(fields: Field[], fieldNames: string[]) {
  let types = fieldNames
    .map(name => getFieldTypeFromMetadata(findField(fields, name)))
    .filter(type => type !== 'unknown')

  if (types.some(type => type === 'date')) return 'time'
  if (types.some(type => type === 'number')) return 'value'
  return 'category'
}

function getSeriesXField(series?: SeriesWithGroupingHint) {
  return getEncodeField(series?.encode?.x)
}

function getSeriesYField(series?: SeriesWithGroupingHint) {
  return getEncodeField(series?.encode?.y) ?? getEncodeField(series?.encode?.value)
}

function getSeriesCategoryFieldForHorizontal(series?: SeriesWithGroupingHint) {
  return getEncodeField(series?.encode?.y)
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
