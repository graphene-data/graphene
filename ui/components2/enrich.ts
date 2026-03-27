import type {EChartsConfig2, Field, SeriesWithColumnRefs} from './types.ts'
import {extractSeries} from './extract.ts'

// Enrichment is the process through which we take an echarts config and add in some defaults to make it really nice.
// A lot of defaulting happens in themes but there are some defaults themes can't handle, like when it depends on the shape of data being charted.
// Each enrichment function is a small, ideally single-purpose manipulation of the config.
// The most important one is `resolveDataReferences` which takes column nmes from the config and turns them into data arrays echarts expects.

// Run enrichment in a fixed order so defaults stay predictable.
export function enrich(config: EChartsConfig2, rows: Record<string, any>[], fields: Field[]) {
  config.series = normalizeSeries(config.series)

  let fieldInfo = getFieldInfo(config, fields)
  inferXAxisType(config, fieldInfo)
  horizontalBarGuard(config, fieldInfo)
  currencyValueAxisFormatting(config, fields)
  resolveDataReferences(config, rows)
  applyIntegerYAxisTicks(config)
  stackedBarCornerRadius(config)
  return config
}

// Resolve string column references into concrete ECharts data arrays.
//
// Mental model:
// 1) detect whether each series is already concrete or still references columns
// 2) choose the shaping path (value vector, non-cartesian item mapping, cartesian extraction)
// 3) write back a final `config.series` with only concrete arrays
//
// This keeps all "row -> chart-ready data" work in one readable place so custom components
// can rely on the same behavior without duplicating mapping logic.
function resolveDataReferences(config: EChartsConfig2, rows: Record<string, any>[]) {
  let xAxis = firstAxis(config.xAxis)
  let xField = typeof xAxis?.data === 'string' ? xAxis.data : undefined
  let xAxisType = xAxis?.type ?? 'category'

  let templates = normalizeSeries(config.series)
  let resolved: any[] = []
  let categoryDomain: any[] | undefined

  for (let template of templates) {
    // Case 1: series already contains concrete data arrays/objects.
    if (typeof template.data !== 'string') {
      resolved.push(template)
      continue
    }

    let yField = template.data
    let seriesField = typeof template.series === 'string' ? template.series : undefined

    // Case 2: non-cartesian series map rows into item objects/tuples.
    // If callers did not provide xAxis.data, infer a reasonable dimension column.
    if (!isCartesianSeries(template.type)) {
      let next: any = {...template}
      let nameField = xField ?? inferDimensionField(rows, yField, seriesField)
      delete next.series

      if (template.type === 'themeRiver') {
        next.data = rows.map(row => [nameField ? row[nameField] : undefined, toNumericOrNull(row[yField]), seriesField ? row[seriesField] : ''])
      } else if (['pie', 'funnel', 'treemap', 'sunburst'].includes(String(template.type ?? ''))) {
        next.data = rows.map(row => ({name: nameField ? row[nameField] : '', value: toNumericOrNull(row[yField])}))
      } else {
        next.data = rows.map(row => toNumericOrNull(row[yField]))
      }

      resolved.push(next)
      continue
    }

    // Case 3: cartesian series without x reference become plain numeric vectors.
    if (!xField) {
      let next: any = {...template}
      delete next.series
      next.data = rows.map(row => toNumericOrNull(row[yField]))
      resolved.push(next)
      continue
    }

    // Case 4: cartesian series delegate to shared extraction for grouping/alignment.
    let splitField = typeof template.series === 'string' ? template.series : undefined
    let extracted = extractSeries(rows, {
      x: xField,
      y: yField,
      series: splitField,
      xAxisType,
      buildSeries(seriesName, points) {
        let next: any = {...template}
        delete next.series
        next.data = shouldUseXYPairs(next.type, xAxisType) ? points.map(point => [point.x, point.y]) : points.map(point => point.y)
        if (splitField && next.name == null) next.name = seriesName
        return next
      },
    })

    resolved.push(...extracted.series)
    if (!categoryDomain && extracted.categories.length > 0) categoryDomain = extracted.categories
  }

  config.series = resolved
  if (xAxis && xAxisType === 'category' && typeof xAxis.data === 'string' && categoryDomain) xAxis.data = categoryDomain
}

// Infer x-axis type from field metadata when callers do not set it explicitly.
function inferXAxisType(config: EChartsConfig2, fieldInfo: FieldInfo) {
  let xAxis = firstAxis(config.xAxis)
  if (!xAxis || xAxis.type != null) return

  let xFieldType = getFieldType(fieldInfo.xField)
  if (xFieldType === 'date') xAxis.type = 'time'
  else if (xFieldType === 'number') xAxis.type = 'value'
  else xAxis.type = 'category'
}

// Apply compact currency formatting to value axes when the backing field declares currency units.
function currencyValueAxisFormatting(config: EChartsConfig2, fields: Field[]) {
  let yAxes = normalizeAxis(config.yAxis)
  if (yAxes.length === 0) return

  let symbols = {usd: '$', eur: '€', gbp: '£', cad: 'C$', aud: 'A$', jpy: '¥'} as const
  let formatter = new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1})

  // Pass 1: inspect series templates and figure out which y-axis index should use which currency.
  // We do this before mutating axes so we can dedupe: multiple series on the same axis should still
  // result in only one formatter assignment for that axis.
  let axisCurrency = new Map<number, keyof typeof symbols>()
  for (let series of normalizeSeries(config.series)) {
    if (typeof series.data !== 'string') continue

    let field = findField(fields, series.data)
    let unit = field?.metadata?.units?.toLowerCase() as keyof typeof symbols | undefined
    if (!unit || !(unit in symbols)) continue

    let axisIndex = Number((series as any).yAxisIndex ?? 0)
    if (!axisCurrency.has(axisIndex)) axisCurrency.set(axisIndex, unit)
  }

  // Pass 2: apply one formatter per axis using the mapping from pass 1.
  // This keeps behavior stable when many series share an axis and avoids repeatedly overwriting
  // axisLabel.formatter inside the series loop.
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

// This is trying to fix an issue with charts where every value is either 0 or 1.
// TODO: just make this a test, and see if we still need it
function applyIntegerYAxisTicks(config: EChartsConfig2) {
  let yAxis = firstAxis(config.yAxis)
  if (!yAxis || yAxis.type !== 'value' || yAxis.minInterval != null) return

  let values = normalizeSeries(config.series)
    .flatMap(series => extractNumericValues(series.data))
    .filter(value => Number.isFinite(value))

  if (values.length === 0) return
  if (values.every(value => Number.isInteger(value))) yAxis.minInterval = 1
}

// Add rounded corners only to the visible outer edge of each stack.
function stackedBarCornerRadius(config: EChartsConfig2) {
  let seriesList = normalizeSeries(config.series)
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

function getFieldInfo(config: EChartsConfig2, fields: Field[]): FieldInfo {
  let xAxis = firstAxis(config.xAxis)
  let yAxis = firstAxis(config.yAxis)
  return {
    xField: typeof xAxis?.data === 'string' ? findField(fields, xAxis.data) : undefined,
    yField: typeof yAxis?.data === 'string' ? findField(fields, yAxis.data) : undefined,
  }
}

function isCartesianSeries(type: any) {
  return ['line', 'bar', 'scatter', 'effectScatter', 'pictorialBar'].includes(String(type ?? 'line'))
}

function shouldUseXYPairs(type: any, xAxisType: 'category' | 'value' | 'time') {
  if (['scatter', 'effectScatter'].includes(String(type ?? ''))) return true
  return xAxisType !== 'category'
}

function extractNumericValues(data: any) {
  if (!Array.isArray(data)) return []
  return data.map(item => {
    if (typeof item === 'number') return item
    if (Array.isArray(item)) return item.find(x => typeof x === 'number')
    if (item && typeof item === 'object' && typeof item.value === 'number') return item.value
    return undefined
  })
}

function normalizeSeries(series: EChartsConfig2['series']): SeriesWithColumnRefs[] {
  if (!series) return []
  return Array.isArray(series) ? series : [series]
}

function normalizeAxis(axis: any) {
  if (!axis) return []
  return Array.isArray(axis) ? axis : [axis]
}

function firstAxis(axis: any) {
  return Array.isArray(axis) ? axis[0] : axis
}

function toNumericOrNull(value: any) {
  return Number.isFinite(value) ? value : null
}

function inferDimensionField(rows: Record<string, any>[], yField: string, seriesField?: string) {
  let sample = rows.find(row => row && typeof row === 'object')
  if (!sample) return undefined
  return Object.keys(sample).find(field => field !== yField && field !== seriesField)
}

function isHorizontalBar(config: EChartsConfig2) {
  let xAxis = firstAxis(config.xAxis)
  let yAxis = firstAxis(config.yAxis)
  let hasBarSeries = normalizeSeries(config.series).some((series: any) => series?.type === 'bar')
  return Boolean(hasBarSeries && xAxis?.type === 'value' && yAxis?.type === 'category')
}

function horizontalBarGuard(config: EChartsConfig2, fieldInfo: FieldInfo) {
  if (!isHorizontalBar(config)) return
  let yFieldType = getFieldType(fieldInfo.yField)
  if (yFieldType !== 'date' && yFieldType !== 'number') return
  throw new Error('Horizontal charts do not support a value or time-based x-axis')
}

function findField(fields: Field[], fieldName?: string) {
  if (!fieldName) return undefined
  return fields.find(field => field.name === fieldName)
}

function getFieldType(field?: Field) {
  if (!field) return 'unknown'
  if (field.evidenceType === 'number' || field.type === 'number') return 'number'
  if (field.evidenceType === 'date' || field.type === 'date' || field.type === 'timestamp') return 'date'
  if (field.evidenceType === 'boolean' || field.type === 'boolean') return 'boolean'
  return 'string'
}

type FieldInfo = {
  xField?: Field
  yField?: Field
}
