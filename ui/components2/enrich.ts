import {colorPalette} from './theme.ts'
import {applyDefaultSorting, applyMissingPointDefaults, applyStackPercentage} from './dataShaping.ts'
import type {EChartsConfig2, Field, SeriesWithGroupingHint} from './types.ts'

// Enrichment is the process through which we take an echarts config and add in some defaults to make it really nice.
// A lot of defaulting happens in themes but there are some defaults themes can't handle, like when it depends on the shape of data being charted.
// Each enrichment function is a small, ideally single-purpose manipulation of the config.
// As a rule, if the provided config sets something, enrichments will not change it.

// Each enrichment must have a comment above it describing what it does, and perhaps why it's needed if it isn't obvious.
// Enrichments should also have comments inside explaining how they work if the logic is non-trivial

// Run enrichment in a fixed order so defaults stay predictable.
export function enrich(config: EChartsConfig2, rows: Record<string, any>[], fields: Field[]) {
  normalize(config)

  // Mutate row/field data before dataset creation so synthesized fields are reflected in dataset dimensions.
  applyMissingPointDefaults(config, rows)
  applyStackPercentage(config, rows, fields)
  applyDefaultSorting(config, rows, fields)

  let baseDatasetId = ensureDataset(config, rows, fields)

  // generates the required number of `series` objects for this data
  expandSeriesTransforms(config, rows, baseDatasetId)

  // stylistic rules to provide great defaults
  inferAxisTypesFromEncodedFields(config, fields)
  horizontalBarGuard(config, fields)
  computeTitleLegendAndGridPadding(config)
  currencyValueAxisFormatting(config, fields)
  styleSecondaryAxisForSimpleBarLineLayout(config)
  applyIntegerYAxisTicks(config, rows)
  barLabelPositioning(config)
  labelsUseYAxisFormat(config)
  stackedBarCornerRadius(config)
  return config
}

// Normalize options we read in enrichments so later rules can always iterate arrays.
function normalize(config: EChartsConfig2) {
  let target = config as any
  target.series = normalizeArray(target.series)
  target.xAxis = normalizeArray(target.xAxis)
  target.yAxis = normalizeArray(target.yAxis)
  target.dataset = normalizeArray(target.dataset)
  target.grid = normalizeArray(target.grid)
  if (target.grid.length === 0) target.grid.push({})
  target.legend = normalizeArray(target.legend)
  target.title = normalizeArray(target.title)
}

// Every chart gets a base dataset sourced from rows.
// If callers already provided a dataset, we preserve it and make sure we can reference one source dataset by id.
function ensureDataset(config: EChartsConfig2, rows: Record<string, any>[], fields: Field[]) {
  let dimensions = fields.length > 0 ? fields.map(field => field.name) : inferDimensions(rows)
  let datasets: any[] = (config as any).dataset
  let baseId = '__graphene_base'

  if (datasets.length === 0) {
    datasets.push({id: baseId, source: rows, dimensions})
    return baseId
  }

  let base = datasets.find(entry => entry?.source != null)
  if (!base) {
    datasets.unshift({id: baseId, source: rows, dimensions})
    return baseId
  }

  if (!base.id) base.id = baseId
  if (base.dimensions == null && dimensions.length > 0) base.dimensions = dimensions
  return base.id
}

// Expand series templates that use `encode.group` or `encode.stack` into one concrete series per distinct field value.
// We do this with ECharts dataset filter transforms so wrappers stay small and users don't need to duplicate series configs.
function expandSeriesTransforms(config: EChartsConfig2, rows: Record<string, any>[], baseDatasetId: string) {
  let templates = config.series as SeriesWithGroupingHint[]
  let expanded: any[] = []
  let datasets: any[] = (config as any).dataset

  templates.forEach((template, templateIndex) => {
    let entry: any = template
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
      datasets.push({
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
function inferAxisTypesFromEncodedFields(config: EChartsConfig2, fields: Field[]) {
  let xAxes = config.xAxis as any[]
  let yAxes = config.yAxis as any[]
  let series = config.series as any[]

  xAxes.forEach((axis: any, axisIndex: number) => {
    if (!axis || axis.type != null) return
    let encodedFields = series
      .filter((entry: any) => Number(entry?.xAxisIndex ?? 0) === axisIndex)
      .map(entry => getSeriesXField(entry))
      .filter(Boolean) as string[]

    axis.type = inferAxisTypeFromFields(fields, encodedFields)
  })

  yAxes.forEach((axis: any, axisIndex: number) => {
    if (!axis || axis.type != null) return
    let encodedFields = series
      .filter((entry: any) => Number(entry?.yAxisIndex ?? 0) === axisIndex)
      .map(entry => getSeriesYField(entry))
      .filter(Boolean) as string[]

    axis.type = inferAxisTypeFromFields(fields, encodedFields)
  })
}

// ECharts just does a bad job of this, and the title, legend, and chart can often overlap
// This computes the proper offsets depending on what's visible
function computeTitleLegendAndGridPadding(config: EChartsConfig2) {
  // you're doing crazy stuff, and on your own
  if (config.legend.length > 1 || config.title.length > 1 || config.grid.length > 1) return

  let legend = config.legend[0] || {}
  let title = config.title[0] || {}
  let grid = config.grid[0] || {}

  title.top ??= 2
  legend.top ??= 6
  grid.top ??= 12

  if (title?.text) {
    legend.top += 18
    grid.top += 28
  }

  if (legend?.show) {
    grid.top += 24
  }
}

// Apply compact currency formatting to value axes when the backing field declares currency units.
function currencyValueAxisFormatting(config: EChartsConfig2, fields: Field[]) {
  let yAxes = config.yAxis as any[]
  if (yAxes.length === 0) return

  let symbols = {usd: '$', eur: '€', gbp: '£', cad: 'C$', aud: 'A$', jpy: '¥'} as const
  let formatter = new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1})

  let axisCurrency = new Map<number, keyof typeof symbols>()
  for (let series of config.series as any[]) {
    let yField = getSeriesYField(series)
    if (!yField) continue

    let field = findField(fields, yField)
    let unit = field?.metadata?.units?.toLowerCase() as keyof typeof symbols | undefined
    if (!unit || !(unit in symbols)) continue

    let axisIndex = Number((series as any).yAxisIndex ?? 0)
    if (!axisCurrency.has(axisIndex)) axisCurrency.set(axisIndex, unit)
  }

  for (let [axisIndex, unit] of axisCurrency.entries()) {
    let axis = yAxes[axisIndex] as any
    if (!axis || axis.type !== 'value' || axis.axisLabel?.formatter != null) continue

    axis.axisLabel = {
      ...axis.axisLabel,
      formatter: (value: any) => {
        let amount = Number(value)
        if (!Number.isFinite(amount)) return String(value ?? '')
        let sign = amount < 0 ? '-' : ''
        let compact = formatter.format(Math.abs(amount)).replace('K', 'k').replace('M', 'm').replace('B', 'b')
        return `${sign}${symbols[unit]}${compact}`
      },
    }
  }
}

// For the simple bar+line mixed-chart case, keep axis styling consistent with assigned series:
// - axis labels/values on the second axis match primary axis formatting
// - first axis uses bar series color (when there is only one bar series shape)
// - second axis uses line series color
// In anything more complex, we bail to avoid surprising defaults.
function styleSecondaryAxisForSimpleBarLineLayout(config: EChartsConfig2) {
  let yAxes = config.yAxis as any[]
  if (yAxes.length < 2) return

  let series = config.series as any[]

  let bars = series.filter(entry => Number(entry?.yAxisIndex ?? 0) === 0 && entry?.type === 'bar')
  if (bars.length === 0) return

  let secondary = series.filter(entry => Number(entry?.yAxisIndex ?? 0) === 1)
  if (secondary.length !== 1 || secondary[0]?.type !== 'line') return

  if (series.some(entry => Number(entry?.yAxisIndex ?? 0) === 0 && entry?.type !== 'bar')) return
  if (series.some(entry => Number(entry?.yAxisIndex ?? 0) > 1)) return

  let barYFields = Array.from(new Set(bars.map(entry => getSeriesYField(entry)).filter(Boolean))) as string[]
  if (barYFields.length !== 1) return

  let primaryAxis = yAxes[0]
  let secondaryAxis = yAxes[1]
  if (!primaryAxis || !secondaryAxis) return

  let palette = getThemeColorPalette(config)
  let barSeriesColor = seriesColorForIndex(series, bars[0], palette)
  let lineSeriesColor = seriesColorForIndex(series, secondary[0], palette)

  if (barSeriesColor) applyAxisColor(primaryAxis, barSeriesColor)
  if (lineSeriesColor) applyAxisColor(secondaryAxis, lineSeriesColor)

  let primaryFormatter = primaryAxis.axisLabel?.formatter
  if (typeof primaryFormatter === 'function' && secondaryAxis.axisLabel?.formatter == null) {
    secondaryAxis.axisLabel = {...secondaryAxis.axisLabel, formatter: primaryFormatter}
  }
}

// This is trying to fix an issue with charts where every value is either 0 or 1.
// TODO: just make this a test, and see if we still need it
function applyIntegerYAxisTicks(config: EChartsConfig2, rows: Record<string, any>[]) {
  let yAxis = (config.yAxis as any[])[0]
  if (!yAxis || yAxis.type !== 'value' || yAxis.minInterval != null) return

  let yFields = Array.from(new Set((config.series as any[]).map(series => getSeriesYField(series)).filter(Boolean))) as string[]
  let values = rows.flatMap(row => yFields.map(field => Number(row?.[field]))).filter(value => Number.isFinite(value))

  if (values.length === 0) return
  if (values.every(value => Number.isInteger(value))) yAxis.minInterval = 1
}

// Keep bar labels readable by default: place them outside bars and avoid overlap when possible.
function barLabelPositioning(config: EChartsConfig2) {
  let horizontal = isHorizontalBar(config)

  for (let series of config.series as any[]) {
    if (series?.type !== 'bar' || !series.label || series.label.show !== true) continue

    if (series.label.position == null) series.label.position = horizontal ? 'right' : 'top'
    if (series.label.distance == null) series.label.distance = 4
    if (series.labelLayout == null) series.labelLayout = {}
    if (series.labelLayout.hideOverlap == null) series.labelLayout.hideOverlap = true
  }
}

// Match series data labels to the assigned y-axis formatter when labels are enabled.
// This keeps label formatting in sync with the y-axis without asking callers to repeat it.
// labelsUseYAxisFormat depends on currencyValueAxisFormatting running first so labels inherit axis formatting.
function labelsUseYAxisFormat(config: EChartsConfig2) {
  let yAxes = config.yAxis as any[]

  for (let series of config.series as any[]) {
    // No-op when labels are off or already explicitly formatted.
    if (!series?.label || series.label.show !== true || series.label.formatter != null) continue

    let yField = getSeriesYField(series)
    let axisIndex = Number(series.yAxisIndex ?? 0)
    let axisFormatter = yAxes[axisIndex]?.axisLabel?.formatter
    if (typeof axisFormatter !== 'function') continue

    // ECharts can pass different value shapes depending on series/transform shape.
    // We resolve the numeric value in a few fallback steps so labels always use the
    // same value the y-axis is formatting.
    series.label.formatter = (params: any) => {
      let value = params?.value

      if (yField) {
        if (params?.data && typeof params.data === 'object' && yField in params.data) value = params.data[yField]
        if (params?.value && typeof params.value === 'object' && !Array.isArray(params.value) && yField in params.value) {
          value = params.value[yField]
        }
      }

      return axisFormatter(value)
    }
  }
}

// Add rounded corners only to the visible outer edge of each stack.
function stackedBarCornerRadius(config: EChartsConfig2) {
  let seriesList = config.series as any[]
  let grouped = new Map<string, any[]>()

  for (let series of seriesList) {
    let entry: any = series
    if (entry?.type !== 'bar' || !entry?.stack) continue
    let stackKey = String(entry.stack)
    if (!grouped.has(stackKey)) grouped.set(stackKey, [])
    grouped.get(stackKey)?.push(entry)
  }

  let horizontal = isHorizontalBar(config)
  for (let group of grouped.values()) {
    let lastSeries = group[group.length - 1]
    if (!lastSeries || lastSeries.itemStyle?.borderRadius != null) continue
    lastSeries.itemStyle = {...lastSeries.itemStyle, borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
  }
}

function normalizeArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function getThemeColorPalette(config: EChartsConfig2) {
  let configColor = (config as any).color
  if (Array.isArray(configColor) && configColor.length > 0) return configColor
  return colorPalette
}

function seriesColorForIndex(seriesList: any[], targetSeries: any, palette: any[]) {
  let index = seriesList.indexOf(targetSeries)
  if (index < 0) return undefined

  let explicit = targetSeries?.itemStyle?.color || targetSeries?.lineStyle?.color || targetSeries?.areaStyle?.color || targetSeries?.color
  if (typeof explicit === 'string') return explicit

  return palette[index % palette.length]
}

function applyAxisColor(axis: any, color: string) {
  if (!axis) return

  axis.axisLine = {
    ...(axis.axisLine || {}),
    lineStyle: {
      ...(axis.axisLine?.lineStyle || {}),
      color,
    },
  }

  axis.axisTick = {
    ...(axis.axisTick || {}),
    lineStyle: {
      ...(axis.axisTick?.lineStyle || {}),
      color,
    },
  }

  axis.nameTextStyle = {
    ...(axis.nameTextStyle || {}),
    color,
  }

  axis.axisLabel = {
    ...(axis.axisLabel || {}),
    color,
  }
}

function isHorizontalBar(config: EChartsConfig2) {
  let xAxis = (config.xAxis as any[])[0]
  let yAxis = (config.yAxis as any[])[0]
  let hasBarSeries = (config.series as any[]).some((series: any) => series?.type === 'bar')
  return Boolean(hasBarSeries && xAxis?.type === 'value' && yAxis?.type === 'category')
}

function horizontalBarGuard(config: EChartsConfig2, fields: Field[]) {
  if (!isHorizontalBar(config)) return

  let hasInvalidCategoryField = (config.series as any[])
    .filter((series: any) => series?.type === 'bar')
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

function getSeriesXField(series: any) {
  return getEncodeField(series?.encode?.x)
}

function getSeriesYField(series: any) {
  return getEncodeField(series?.encode?.y) ?? getEncodeField(series?.encode?.value)
}

function getSeriesCategoryFieldForHorizontal(series: any) {
  return getEncodeField(series?.encode?.y)
}

function getEncodeField(value: any): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.find(entry => typeof entry === 'string')
  return undefined
}

function shouldBindSeriesToDataset(series: any) {
  return series?.encode != null && series?.data == null
}

function inferDimensions(rows: Record<string, any>[]) {
  let sample = rows.find(row => row && typeof row === 'object')
  if (!sample) return []
  return Object.keys(sample)
}

function distinctValues(rows: Record<string, any>[], field: string) {
  let values: any[] = []
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
