import {parseCommaList, toBoolean} from './inputUtils.ts'

type StaticAttrs = Record<string, string | undefined>

export const DEFAULT_DATE_PRESETS = [
  'Last 7 Days',
  'Last 30 Days',
  'Last 90 Days',
  'Last 365 Days',
  'Last Month',
  'Last Year',
  'Month to Date',
  'Month to Today',
  'Year to Date',
  'Year to Today',
  'All Time',
]

export function dropdownDefault(attrs: StaticAttrs) {
  if (toBoolean(attrs.noDefault)) return null
  let value = attrs.defaultValue
  if (value === undefined) return null
  if (toBoolean(attrs.multiple)) return parseCommaList(value)
  return value
}

export function dateRangeDefault(attrs: StaticAttrs) {
  let start = normalizeDateInput(attrs.start)
  let end = normalizeDateInput(attrs.end)
  let preset = attrs.defaultValue
  if (preset) {
    let computed = computeDatePresetStrings(preset, end ? new Date(end) : new Date())
    if (computed) return computed
  }
  return {start, end}
}

function computeDatePresetStrings(preset: string, baseEndInclusive: Date, options: {domainStart?: string | null; domainEnd?: string | null; today?: Date} = {}) {
  let range = computeDatePresetRange(preset, baseEndInclusive, options)
  if (!range) return null
  return {start: range.start ? formatDate(range.start) : null, end: range.end ? formatDate(range.end) : null}
}

export function computeDatePresetRange(
  preset: string,
  baseEndInclusive: Date,
  options: {domainStart?: string | null; domainEnd?: string | null; today?: Date} = {},
): {start: Date | null; end: Date | null} | null {
  let label = preset.trim()
  let today = options.today || new Date()
  let endExclusive = addDays(baseEndInclusive, 1)

  let lastDaysMatch = label.match(/^Last (\d+) Days$/i)
  if (lastDaysMatch) {
    let days = parseInt(lastDaysMatch[1], 10)
    return {start: addDays(endExclusive, -days), end: endExclusive}
  }

  let lastMonthsMatch = label.match(/^Last (\d+) Months$/i)
  if (lastMonthsMatch) {
    let months = parseInt(lastMonthsMatch[1], 10)
    let monthEnd = startOfMonth(endExclusive)
    return {start: addMonths(monthEnd, -months), end: monthEnd}
  }

  if (label === 'Last Month') {
    let monthEnd = startOfMonth(endExclusive)
    return {start: addMonths(monthEnd, -1), end: monthEnd}
  }

  if (label === 'Last Year') {
    let yearEnd = startOfYear(endExclusive)
    return {start: addYears(yearEnd, -1), end: yearEnd}
  }

  if (label === 'Last 365 Days') return {start: addDays(endExclusive, -365), end: endExclusive}
  if (label === 'Month to Date') return {start: startOfMonth(endExclusive), end: endExclusive}
  if (label === 'Month to Today') return {start: startOfMonth(today), end: addDays(today, 1)}
  if (label === 'Year to Date') return {start: startOfYear(endExclusive), end: endExclusive}
  if (label === 'Year to Today') return {start: startOfYear(today), end: addDays(today, 1)}
  if (label === 'All Time') {
    let start = options.domainStart ? new Date(options.domainStart) : null
    let end = options.domainEnd ? addDays(new Date(options.domainEnd), 1) : endExclusive
    return {start, end}
  }

  return null
}

export function normalizeDateInput(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return formatDate(value)
  let parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return formatDate(parsed)
}

export function formatDate(value: Date): string {
  let year = value.getFullYear()
  let month = String(value.getMonth() + 1).padStart(2, '0')
  let day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(value: Date, days: number): Date {
  let copy = new Date(value)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function addMonths(value: Date, months: number): Date {
  let copy = new Date(value)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

export function addYears(value: Date, years: number): Date {
  let copy = new Date(value)
  copy.setFullYear(copy.getFullYear() + years)
  return copy
}

export function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

export function startOfYear(value: Date): Date {
  return new Date(value.getFullYear(), 0, 1)
}
