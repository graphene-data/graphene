import type {EChartsConfig2, Field, SeriesWithGroupingHint} from './types.ts'

// Enrichment is the process through which we take an echarts config and add in some defaults to make it really nice.
// A lot of defaulting happens in themes but there are some defaults themes can't handle, like when it depends on the shape of data being charted.
// Each enrichment function is a small, ideally single-purpose manipulation of the config.
// As a rule, if the provided config sets something, enrichments will not change it.

// Run enrichment in a fixed order so defaults stay predictable.
export function enrich(config: EChartsConfig2, rows: Record<string, any>[], fields: Field[]) {
  config.series = normalizeSeries(config.series)

  let baseDatasetId = ensureDataset(config, rows, fields)
  expandSeriesTransforms(config, rows, baseDatasetId)

  inferAxisTypesFromEncodedFields(config, fields)
  horizontalBarGuard(config, fields)
  currencyValueAxisFormatting(config, fields)
  applyIntegerYAxisTicks(config, rows)
  stackedBarCornerRadius(config)
  return config
}

// Every chart gets a base dataset sourced from rows.
// If callers already provided a dataset, we preserve it and make sure we can reference one source dataset by id.
function ensureDataset(config: EChartsConfig2, rows: Record<string, any>[], fields: Field[]) {
  let dimensions = fields.length > 0 ? fields.map(field => field.name) : inferDimensions(rows)
  let dataset: any = (config as any).dataset
  let baseId = '__graphene_base'

  if (!dataset) {
    ;(config as any).dataset = {id: baseId, source: rows, dimensions}
    return baseId
  }

  if (Array.isArray(dataset)) {
    let base = dataset.find(entry => entry?.source != null)
    if (!base) {
      dataset.unshift({id: baseId, source: rows, dimensions})
      return baseId
    }
    if (!base.id) base.id = baseId
    if (base.dimensions == null && dimensions.length > 0) base.dimensions = dimensions
    return base.id
  }

  if (dataset.source == null) {
    ;(config as any).dataset = [{id: baseId, source: rows, dimensions}, dataset]
    return baseId
  }

  if (!dataset.id) dataset.id = baseId
  if (dataset.dimensions == null && dimensions.length > 0) dataset.dimensions = dimensions
  return dataset.id
}

// Expand series templates that use `series: 'fieldName'` into one concrete series per distinct field value.
// We do this with ECharts dataset filter transforms so wrappers stay small and users don't need to duplicate series configs.
function expandSeriesTransforms(config: EChartsConfig2, rows: Record<string, any>[], baseDatasetId: string) {
  let templates = normalizeSeries(config.series)
  let expanded: any[] = []
  let datasets = normalizeDataset((config as any).dataset)

  templates.forEach((template, templateIndex) => {
    let entry: any = template
    let splitField = typeof entry.series === 'string' ? entry.series : undefined

    if (!splitField) {
      let next = {...entry}
      delete next.series
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
      delete next.series
      if (next.name == null) next.name = String(seriesValue ?? '')
      expanded.push(next)
    })
  })

  config.series = expanded
  ;(config as any).dataset = datasets.length === 1 ? datasets[0] : datasets
}

// Infer axis types from encoded field metadata
function inferAxisTypesFromEncodedFields(config: EChartsConfig2, fields: Field[]) {
  let xAxes = normalizeAxis(config.xAxis)
  let yAxes = normalizeAxis(config.yAxis)
  let series = normalizeSeries(config.series)

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

// Apply compact currency formatting to value axes when the backing field declares currency units.
function currencyValueAxisFormatting(config: EChartsConfig2, fields: Field[]) {
  let yAxes = normalizeAxis(config.yAxis)
  if (yAxes.length === 0) return

  let symbols = {usd: '$', eur: '€', gbp: '£', cad: 'C$', aud: 'A$', jpy: '¥'} as const
  let formatter = new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1})

  let axisCurrency = new Map<number, keyof typeof symbols>()
  for (let series of normalizeSeries(config.series)) {
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

// This is trying to fix an issue with charts where every value is either 0 or 1.
// TODO: just make this a test, and see if we still need it
function applyIntegerYAxisTicks(config: EChartsConfig2, rows: Record<string, any>[]) {
  let yAxis = firstAxis(config.yAxis)
  if (!yAxis || yAxis.type !== 'value' || yAxis.minInterval != null) return

  let yFields = Array.from(new Set(normalizeSeries(config.series).map(series => getSeriesYField(series)).filter(Boolean))) as string[]
  let values = rows.flatMap(row => yFields.map(field => Number(row?.[field]))).filter(value => Number.isFinite(value))

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

function normalizeSeries(series: EChartsConfig2['series']): SeriesWithGroupingHint[] {
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

function isHorizontalBar(config: EChartsConfig2) {
  let xAxis = firstAxis(config.xAxis)
  let yAxis = firstAxis(config.yAxis)
  let hasBarSeries = normalizeSeries(config.series).some((series: any) => series?.type === 'bar')
  return Boolean(hasBarSeries && xAxis?.type === 'value' && yAxis?.type === 'category')
}

function horizontalBarGuard(config: EChartsConfig2, fields: Field[]) {
  if (!isHorizontalBar(config)) return

  let hasInvalidCategoryField = normalizeSeries(config.series)
    .filter((series: any) => series?.type === 'bar')
    .map(series => findField(fields, getSeriesCategoryFieldForHorizontal(series)))
    .map(field => getFieldType(field))
    .some(type => type === 'date' || type === 'number')

  if (hasInvalidCategoryField) throw new Error('Horizontal charts do not support a value or time-based x-axis')
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

function inferAxisTypeFromFields(fields: Field[], fieldNames: string[]) {
  let types = fieldNames.map(name => getFieldType(findField(fields, name))).filter(type => type !== 'unknown')
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

function normalizeDataset(dataset: any) {
  if (!dataset) return []
  return Array.isArray(dataset) ? dataset : [dataset]
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
