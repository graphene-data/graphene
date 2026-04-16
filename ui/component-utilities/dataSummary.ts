import type {Field} from './types.ts'

export type SummaryMetric = 'min' | 'max' | 'median' | 'mean' | 'sum' | 'count' | 'countDistinct'

export type ColumnUnitSummary = Partial<Record<SummaryMetric, number>>

/**
 * Summarize a field using only the requested metrics.
 */
export function summarizeColumn(rows: Record<string, unknown>[], field: Field, metrics: SummaryMetric[] = []): ColumnUnitSummary {
  if (!Array.isArray(rows) || rows.length === 0 || metrics.length === 0 || !field?.name) return {}

  let requested = new Set(metrics)
  let result: ColumnUnitSummary = {}
  let values = rows.map(row => row?.[field.name])

  if (requested.has('count')) result.count = rows.length

  if (requested.has('countDistinct')) {
    let distinct = new Set(values.filter(value => value !== undefined && value !== null).map(value => String(value)))
    result.countDistinct = distinct.size
  }

  let needsNumeric = ['min', 'max', 'median', 'mean', 'sum'].some(metric => requested.has(metric as SummaryMetric))
  let isNumeric = String(field.type || '').toLowerCase() === 'number'
  if (!isNumeric || !needsNumeric) return result

  let numericValues = values.map(value => (typeof value === 'number' ? value : Number(value))).filter(value => Number.isFinite(value))
  if (!numericValues.length) return result

  if (requested.has('sum') || requested.has('mean')) {
    let total = 0
    for (let value of numericValues) total += value
    if (requested.has('sum')) result.sum = total
    if (requested.has('mean')) result.mean = total / numericValues.length
  }

  if (requested.has('min')) {
    let min = numericValues[0]
    for (let value of numericValues) if (value < min) min = value
    result.min = min
  }

  if (requested.has('max')) {
    let max = numericValues[0]
    for (let value of numericValues) if (value > max) max = value
    result.max = max
  }

  if (requested.has('median')) {
    let sorted = [...numericValues].sort((a, b) => a - b)
    let midpoint = Math.floor(sorted.length / 2)
    result.median = sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2
  }

  return result
}
