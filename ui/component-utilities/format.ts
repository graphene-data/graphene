import type {Field} from './types.ts'

const currencySymbols = {usd: '$', eur: '€', gbp: '£', cad: 'C$', aud: 'A$', jpy: '¥'} as const
const percent = new Intl.NumberFormat('en-US', {maximumFractionDigits: 1})
const currencyCompact = new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1})
const monthYearFormatter = new Intl.DateTimeFormat('en-US', {month: 'long', year: 'numeric'})
const monthDayYearFormatter = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric'})
const titleCaseAcronyms = ['id', 'gdp']
const titleCaseLowerWords = ['of', 'the', 'and', 'in', 'on']

// Formats a raw column name into a readable title.
export function formatTitle(column: string) {
  let cleaned = column.replace(/"/g, '').replace(/_/g, ' ')
  return cleaned.replace(/\S*/g, token => {
    if (titleCaseAcronyms.includes(token)) return token.toUpperCase()
    if (titleCaseLowerWords.includes(token)) return token.toLowerCase()
    return token.charAt(0).toUpperCase() + token.substr(1).toLowerCase()
  })
}

// Creates a formatter function that takes a numeric value and type/metadata info about a field to determine how to format it.
export function makeValueFormatter(field?: Field) {
  let unit = field?.metadata?.units?.toLowerCase() as keyof typeof currencySymbols | undefined
  let currencyUnit = unit != null && unit in currencySymbols ? unit : undefined

  return (value: unknown) => {
    let amount = Number(value)
    if (!Number.isFinite(amount)) return String(value ?? '')

    if (field?.metadata?.ratio) return `${percent.format(amount * 100)}%`
    if (field?.metadata?.pct) return `${percent.format(amount)}%`

    if (currencyUnit) {
      let sign = amount < 0 ? '-' : ''
      let formatted = currencyCompact.format(Math.abs(amount)).replace('K', 'k').replace('M', 'm').replace('B', 'b')
      return `${sign}${currencySymbols[currencyUnit]}${formatted}`
    }

    if (amount === 0) return '0'
    let sign = amount < 0 ? '-' : ''
    let absolute = Math.abs(amount)

    if (absolute >= 1e12) return `${sign}${compactValue(absolute / 1e12)}T`
    if (absolute >= 1e9) return `${sign}${compactValue(absolute / 1e9)}B`
    if (absolute >= 1e6) return `${sign}${compactValue(absolute / 1e6)}M`
    if (absolute >= 1e3) return `${sign}${compactValue(absolute / 1e3)}k`
    if (absolute >= 1) return `${sign}${compactValue(absolute)}`
    if (absolute >= 1e-3) return `${sign}${compactValue(absolute)}`
    if (absolute >= 1e-6) return `${sign}${compactValue(absolute * 1e3)}m`
    if (absolute >= 1e-9) return `${sign}${compactValue(absolute * 1e6)}u`
    if (absolute >= 1e-12) return `${sign}${compactValue(absolute * 1e9)}n`
    return `${sign}${compactValue(absolute)}`
  }
}

// Creates a formatter function that renders date/timestamp values based on field metadata.timeGrain.
export function makeTimeFormatter(field?: Field) {
  let timeGrain = String(field?.metadata?.timeGrain || '').toLowerCase()

  return (input: unknown) => {
    let value = extractFormatterValue(input)
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
  if (type === 'number') return makeValueFormatter(field)(value)
  if (type === 'date' || type === 'timestamp') return makeTimeFormatter(field)(value)
  return String(value)
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
