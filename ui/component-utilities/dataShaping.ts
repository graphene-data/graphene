import type {Field, NormalConfig, SeriesWithGroupingHint} from './types.ts'

import {scalarType} from '../../lang/types.ts'

// Fill sparse grouped data so each split series has a value for each x bucket.
//
// This only applies to grouped templates (`encode.group` or `encode.stack`).
// We do not attempt to fabricate x values here; we only ensure a full Cartesian
// product of existing x values and split values.
//
// Missing-value behavior by chart type (Evidence defaults):
// - line (no area): null  -> visible line gaps
// - area (line + areaStyle):
//   - stacked area: 0 -> continuous stacked area baseline
//   - unstacked area: null -> visible gaps like line charts
// - bar: 0 -> missing category bars render as zero-height bars
export function applyMissingPointDefaults(config: NormalConfig, rows: Record<string, any>[]) {
  let series = config.series
  if (series.length === 0 || rows.length === 0) return

  let groups = new Map<string, {xField: string; splitField: string; fills: Map<string, any>}>()

  for (let entry of series) {
    let splitField = getSplitField(entry)
    let xField = getSeriesXField(entry)
    let yField = getSeriesYField(entry)
    if (!splitField || !xField || !yField) continue

    let key = `${xField}::${splitField}`
    if (!groups.has(key)) groups.set(key, {xField, splitField, fills: new Map()})

    // This line is where chart-specific missing-value behavior is chosen.
    // See getMissingFillValueForSeries() below for the type mapping.
    let fillValue = getMissingFillValueForSeries(entry)
    let fills = groups.get(key)!.fills

    // If multiple templates target the same y field, prefer zero over null.
    // (bar/area should win over plain line when mixed configs exist.)
    if (!fills.has(yField) || fillValue === 0) fills.set(yField, fillValue)
  }

  for (let group of groups.values()) {
    let xValues = distinctValues(rows, group.xField)
    let splitValues = distinctValues(rows, group.splitField)
    if (xValues.length === 0 || splitValues.length === 0) continue

    let existing = new Set<string>()
    for (let row of rows) {
      existing.add(pairKey(row?.[group.xField], row?.[group.splitField]))
    }

    for (let xValue of xValues) {
      for (let splitValue of splitValues) {
        if (existing.has(pairKey(xValue, splitValue))) continue

        let row: Record<string, any> = {[group.xField]: xValue, [group.splitField]: splitValue}
        for (let [yField, fillValue] of group.fills.entries()) row[yField] = fillValue
        rows.push(row)
      }
    }
  }
}

// Evidence stacked100 behavior: compute percentages per x-domain and rewrite series to synthetic pct fields.
export function applyStackPercentage(config: NormalConfig, rows: Record<string, any>[], fields: Field[]) {
  let series = config.series
  if (series.length === 0 || rows.length === 0) return

  let groupIndex = 0

  for (let entry of series) {
    let xField = getSeriesXField(entry)
    let yField = getSeriesYField(entry)
    if (entry?.stackPercentage !== true || !entry?.stack || !xField || !yField || entry?.datasetId != null) continue

    let stackGroup = series.filter(candidate => {
      return candidate?.stack === entry.stack && getSeriesXField(candidate) === xField && getSeriesYField(candidate)
    })
    if (stackGroup[0] !== entry) continue

    let yFields = Array.from(new Set(stackGroup.map(candidate => getSeriesYField(candidate)).filter(Boolean))) as string[]
    let pctFieldByY = Object.fromEntries(yFields.map((y, index) => [y, `__graphene_stack_pct_${groupIndex}_${index}`])) as Record<string, string>

    let totalsByX = new Map<string, number>()
    for (let row of rows) {
      let xKey = valueKey(row?.[xField])
      let rowTotal = yFields.reduce((sum, y) => sum + (Number(row?.[y]) || 0), 0)
      totalsByX.set(xKey, (totalsByX.get(xKey) ?? 0) + rowTotal)
    }

    for (let row of rows) {
      let xKey = valueKey(row?.[xField])
      let total = totalsByX.get(xKey) ?? 0
      for (let y of yFields) row[pctFieldByY[y]] = total <= 0 ? 0 : (Number(row?.[y]) || 0) / total
    }

    for (let y of yFields) ensureField(fields, pctFieldByY[y], {metadata: {pct: true}})

    for (let candidate of stackGroup) {
      let y = getSeriesYField(candidate)
      if (!y) continue
      candidate.encode = {...candidate.encode, y: pctFieldByY[y]}
      delete candidate.stackPercentage
    }

    groupIndex++
  }
}

// Evidence default sort policy:
// - time/value x: sort by x asc
// - category x: sort by stack total desc for stacked bars, otherwise by first measure desc
export function applyDefaultSorting(config: NormalConfig, rows: Record<string, any>[], fields: Field[]) {
  let series = config.series
  if (series.length === 0 || rows.length === 0) return

  let xField = firstSeriesXField(series)
  if (!xField) return

  let xType = inferFieldType(fields, xField)
  let primarySeries = series.filter(entry => getSeriesXField(entry) === xField && getSeriesYField(entry))
  if (primarySeries.length === 0) return

  if (xType === 'date' || xType === 'number') {
    sortRowsByXAscending(rows, xField, xType)
    return
  }

  if (xType !== 'string') return

  let hasStackedBars = primarySeries.some(entry => entry?.type === 'bar' && !!entry?.stack)
  if (hasStackedBars) {
    let yFields = Array.from(new Set(primarySeries.map(entry => getSeriesYField(entry)).filter(Boolean))) as string[]
    sortRowsByCategoryMetric(rows, xField, row => yFields.reduce((sum, y) => sum + (Number(row?.[y]) || 0), 0))
    return
  }

  let firstY = getSeriesYField(primarySeries[0])
  if (!firstY) return
  sortRowsByCategoryMetric(rows, xField, row => Number(row?.[firstY]) || 0)
}

function sortRowsByXAscending(rows: Record<string, any>[], xField: string, xType: 'date' | 'number') {
  let indexed = rows.map((row, index) => ({row, index}))
  indexed.sort((a, b) => {
    let aValue = sortableValue(a.row?.[xField], xType)
    let bValue = sortableValue(b.row?.[xField], xType)
    if (aValue < bValue) return -1
    if (aValue > bValue) return 1
    return a.index - b.index
  })
  for (let i = 0; i < indexed.length; i++) rows[i] = indexed[i].row
}

function sortRowsByCategoryMetric(rows: Record<string, any>[], xField: string, metricForRow: (row: Record<string, any>) => number) {
  let metricByX = new Map<string, number>()
  let valueByKey = new Map<string, any>()

  for (let row of rows) {
    let xValue = row?.[xField]
    let key = valueKey(xValue)
    valueByKey.set(key, xValue)
    metricByX.set(key, (metricByX.get(key) ?? 0) + metricForRow(row))
  }

  let orderedKeys = Array.from(metricByX.keys())
  orderedKeys.sort((a, b) => {
    let aMetric = metricByX.get(a) ?? 0
    let bMetric = metricByX.get(b) ?? 0
    return bMetric - aMetric
  })

  let positionByX = new Map<string, number>(orderedKeys.map((key, index) => [key, index]))
  let indexed = rows.map((row, index) => ({row, index}))
  indexed.sort((a, b) => {
    let aPos = positionByX.get(valueKey(a.row?.[xField])) ?? Number.MAX_SAFE_INTEGER
    let bPos = positionByX.get(valueKey(b.row?.[xField])) ?? Number.MAX_SAFE_INTEGER
    if (aPos !== bPos) return aPos - bPos
    return a.index - b.index
  })

  for (let i = 0; i < indexed.length; i++) rows[i] = indexed[i].row
}

function ensureField(fields: Field[], name: string, options?: Partial<Field>) {
  if (fields.some(field => field.name === name)) return
  fields.push({name, type: scalarType('number'), ...options})
}

// Default missing datapoint handling differs by chart type.
// - bar: missing grouped points become 0
// - area: stacked -> 0, unstacked -> null (gap)
// - line: missing grouped points become null (shows a gap unless connectNulls is enabled)
function getMissingFillValueForSeries(series: SeriesWithGroupingHint) {
  if (series?.type === 'bar') return 0

  let isArea = series?.type === 'line' && series?.areaStyle != null
  if (isArea && series?.stack) return 0

  return null
}

function inferFieldType(fields: Field[], fieldName: string) {
  let field = fields.find(entry => entry.name === fieldName)
  if (!field) return 'string'
  if (field.type.kind === 'array') throw new Error(`Field ${fieldName} has unsupported non-scalar type: array`)
  if (field.type.kind === 'date' || field.type.kind === 'timestamp') return 'date'
  if (field.type.kind === 'number') return 'number'
  return 'string'
}

function firstSeriesXField(series: SeriesWithGroupingHint[]) {
  for (let entry of series) {
    let xField = getSeriesXField(entry)
    if (xField) return xField
  }
  return undefined
}

function getSplitField(series: SeriesWithGroupingHint) {
  if (typeof series?.encode?.group === 'string') return series.encode.group
  if (typeof series?.encode?.stack === 'string') return series.encode.stack
  return undefined
}

function getSeriesXField(series?: SeriesWithGroupingHint) {
  return getEncodeField(series?.encode?.x)
}

function getSeriesYField(series?: SeriesWithGroupingHint) {
  return getEncodeField(series?.encode?.y) ?? getEncodeField(series?.encode?.value)
}

function getEncodeField(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.find(entry => typeof entry === 'string')
  return undefined
}

function distinctValues(rows: Record<string, any>[], field: string) {
  let values: unknown[] = []
  let seen = new Set<string>()
  for (let row of rows) {
    let value = row?.[field]
    let key = valueKey(value)
    if (seen.has(key)) continue
    seen.add(key)
    values.push(value)
  }
  return values
}

function sortableValue(value: unknown, type: 'date' | 'number') {
  if (type === 'number') {
    let parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
  }
  let timestamp = value instanceof Date ? value.getTime() : Date.parse(String(value ?? ''))
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY
}

function pairKey(left: unknown, right: unknown) {
  return `${valueKey(left)}|${valueKey(right)}`
}

function valueKey(value: unknown) {
  return JSON.stringify(value ?? null)
}
