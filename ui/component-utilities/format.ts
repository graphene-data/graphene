import type {Field} from './types.ts'

const supportedCurrencyCodes = new Set(Intl.supportedValuesOf('currency'))
const percent = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0})
const currencyCompact = new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1})
const monthYearFormatter = new Intl.DateTimeFormat('en-US', {month: 'long', year: 'numeric'})
const monthDayYearFormatter = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric'})
const sundayWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const mondayWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const yearMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const titleCaseAcronyms = ['id', 'gdp']
const titleCaseLowerWords = ['of', 'the', 'and', 'in', 'on']

type ValueFormatterOptions = {unitStyle?: 'label' | 'axis'}

// Formats a raw column name into a readable title.
export function formatTitle(column: string) {
  let cleaned = column.replace(/"/g, '').replace(/_/g, ' ')
  return cleaned.replace(/\S*/g, token => {
    if (titleCaseAcronyms.includes(token)) return token.toUpperCase()
    if (titleCaseLowerWords.includes(token)) return token.toLowerCase()
    return token.charAt(0).toUpperCase() + token.substr(1).toLowerCase()
  })
}

// ECharts valueFormatter will take different arguments depending on the chart type.
// For bar/line/area it's just a number
// for scatter, it's [x,y], for candlestick [open, close, low, high], etc
export function makeValueFormatter(fields: Field[] = [], options: ValueFormatterOptions = {}) {
  return (value: unknown) => {
    if (Array.isArray(value)) return value.map((entry, index) => formatSingleValue(entry, fields[index] || fields[0], options)).join(', ')
    return formatSingleValue(value, fields[0], options)
  }
}

// Formats one numeric value with field metadata (currency, ratio/pct, compact notation).
export function formatSingleValue(value: any, field?: Field, options: ValueFormatterOptions = {}) {
  let amount = Number(value)
  if (!Number.isFinite(amount)) return String(value ?? '')

  if (field?.metadata?.ratio) return `${percent.format(amount * 100)}%`
  if (field?.metadata?.pct) return `${percent.format(amount)}%`

  let currency = field?.metadata?.currency?.toUpperCase()
  if (currency && supportedCurrencyCodes.has(currency)) {
    let sign = amount < 0 ? '-' : ''
    let formatted = currencyCompact.format(Math.abs(amount)).replace('K', 'k').replace('M', 'm').replace('B', 'b')
    return `${sign}${formatCurrencySymbol(currency)}${formatted}`
  }

  if (amount === 0) return addUnit('0', field, options)
  let sign = amount < 0 ? '-' : ''
  let absolute = Math.abs(amount)
  let formatted = ''

  if (absolute >= 1e12) formatted = `${compactValue(absolute / 1e12)}T`
  else if (absolute >= 1e9) formatted = `${compactValue(absolute / 1e9)}B`
  else if (absolute >= 1e6) formatted = `${compactValue(absolute / 1e6)}M`
  else if (absolute >= 1e3) formatted = `${compactValue(absolute / 1e3)}k`
  else if (absolute >= 1) formatted = compactValue(absolute)
  else if (absolute >= 1e-3) formatted = compactValue(absolute)
  else if (absolute >= 1e-6) formatted = `${compactValue(absolute * 1e3)}m`
  else if (absolute >= 1e-9) formatted = `${compactValue(absolute * 1e6)}u`
  else if (absolute >= 1e-12) formatted = `${compactValue(absolute * 1e9)}n`
  else formatted = compactValue(absolute)

  return addUnit(`${sign}${formatted}`, field, options)
}

function formatCurrencySymbol(currency: string) {
  let parts = new Intl.NumberFormat('en-US', {style: 'currency', currency, currencyDisplay: 'symbol', maximumFractionDigits: 0}).formatToParts(0)
  return parts.find(part => part.type === 'currency')?.value || currency
}

function addUnit(value: string, field: Field | undefined, options: ValueFormatterOptions) {
  let unit = field?.metadata?.unit?.trim()
  if (!unit) return value
  return options.unitStyle === 'axis' ? `${value} (${unit})` : `${value} ${unit}`
}

// Creates a formatter function that renders date/timestamp values based on field metadata.timeGrain.
export function makeTimeFormatter(field?: Field) {
  let timeGrain = String(field?.metadata?.timeGrain || '').toLowerCase()

  return (input: unknown) => {
    let value = input
    if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>).value
    }

    let date = value instanceof Date ? value : new Date(Number(value))
    if (!Number.isFinite(date.getTime())) return String(value ?? '')

    let y = date.getFullYear()
    let m = pad2(date.getMonth() + 1)
    let d = pad2(date.getDate())
    let h = pad2(date.getHours())
    let min = pad2(date.getMinutes())
    let s = pad2(date.getSeconds())

    if (timeGrain === 'year') return String(y)
    if (timeGrain === 'quarter') return `Q${Math.floor(date.getMonth() / 3) + 1} ${y}`
    if (timeGrain === 'month') return monthYearFormatter.format(date)
    if (timeGrain === 'week' || timeGrain === 'day') return monthDayYearFormatter.format(date)
    if (timeGrain === 'hour') return `${y}-${m}-${d} ${h}:00`
    if (timeGrain === 'minute') return `${y}-${m}-${d} ${h}:${min}`
    if (timeGrain === 'second') return `${y}-${m}-${d} ${h}:${min}:${s}`

    return monthDayYearFormatter.format(date)
  }
}

// Formats one value by selecting the right formatter from the field type.
export function formatFromField(field: Field | undefined, value: unknown) {
  if (value === null || value === undefined) return '-'

  let type = String(field?.type || '').toLowerCase()
  if (type === 'number') return formatSingleValue(value, field)
  if (type === 'date' || type === 'timestamp') return makeTimeFormatter(field)(value)
  return String(value)
}

// Formats ordinal time buckets like hour_of_day and day_of_week variants.
export function formatTimeOrdinal(field: Field | undefined, input: unknown) {
  let value = extractFormatterValue(input)
  let ordinal = String(field?.metadata?.timeOrdinal || '').toLowerCase()
  if (!ordinal) return String(value ?? '')

  if (ordinal === 'hour_of_day') {
    let hour = Number(value)
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return String(value ?? '')
    let normalized = hour % 12 || 12
    return `${normalized}${hour < 12 ? 'am' : 'pm'}`
  }

  if (ordinal === 'dow_1s') {
    let day = Number(value)
    if (!Number.isInteger(day) || day < 1 || day > 7) return String(value ?? '')
    return sundayWeek[day - 1]
  }

  if (ordinal === 'dow_0s') {
    let day = Number(value)
    if (!Number.isInteger(day) || day < 0 || day > 6) return String(value ?? '')
    return sundayWeek[day]
  }

  if (ordinal === 'dow_1m') {
    let day = Number(value)
    if (!Number.isInteger(day) || day < 1 || day > 7) return String(value ?? '')
    return mondayWeek[day - 1]
  }

  if (ordinal === 'month_of_year') {
    let month = Number(value)
    if (!Number.isInteger(month) || month < 1 || month > 12) return String(value ?? '')
    return yearMonths[month - 1]
  }

  if (ordinal === 'quarter_of_year') {
    let quarter = Number(value)
    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) return String(value ?? '')
    return `Q${quarter}`
  }

  return String(value ?? '')
}

function extractFormatterValue(input: unknown) {
  if (input && typeof input === 'object' && 'value' in (input as Record<string, unknown>)) {
    return (input as Record<string, unknown>).value
  }
  return input
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function compactValue(num: number) {
  let exponent = Math.floor(Math.log10(Math.abs(num)))
  let scale = Math.pow(10, exponent - 1)
  let rounded = Math.round(num / scale) * scale
  if (!Number.isFinite(rounded)) return String(num)
  let magnitude = Math.floor(Math.log10(rounded))
  let decimals = Math.max(0, 1 - magnitude)
  return rounded
    .toFixed(decimals)
    .replace(/\.0+$/, '')
    .replace(/(\.[0-9]*[1-9])0+$/, '$1')
    .replace(/\.$/, '')
}
