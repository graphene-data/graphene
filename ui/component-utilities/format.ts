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

type UnitDef = {name: string; abbr: string; factor: number}
type UnitScale = {composite?: boolean; units: UnitDef[]}
type ValueFormatterOptions = {unitStyle?: 'label' | 'axis'; scaleMax?: number}

// Recognized units, grouped into scales whose members we can convert between. Anything outside these tables keeps its raw string.
// Metric and imperial units live in separate scales because we never convert across systems: 1500 meters is 1.5km, never 0.93mi.
// Time is `composite` because it isn't decimal, so 1500 minutes should read as "1d 1h" rather than "1.5k minutes".
// `m` meaning both minutes and meters is fine - the scale is known from the declared unit, so they can never collide in one formatter.
const unitScales: UnitScale[] = [
  {composite: true, units: [
    {name: 'milliseconds', abbr: 'ms', factor: 0.001}, {name: 'seconds', abbr: 's', factor: 1}, {name: 'minutes', abbr: 'm', factor: 60},
    {name: 'hours', abbr: 'h', factor: 3600}, {name: 'days', abbr: 'd', factor: 86400}, {name: 'weeks', abbr: 'w', factor: 604800},
  ]},
  {units: [{name: 'millimeters', abbr: 'mm', factor: 0.001}, {name: 'centimeters', abbr: 'cm', factor: 0.01}, {name: 'meters', abbr: 'm', factor: 1}, {name: 'kilometers', abbr: 'km', factor: 1000}]},
  {units: [{name: 'feet', abbr: 'ft', factor: 1}, {name: 'miles', abbr: 'mi', factor: 5280}]},
  {units: [{name: 'grams', abbr: 'g', factor: 1}, {name: 'kilograms', abbr: 'kg', factor: 1000}]},
  {units: [{name: 'pounds', abbr: 'lb', factor: 1}]},
  // Data uses 1000 rather than 1024 to match the rest of our compaction, and to sidestep the KiB debate.
  {units: [{name: 'bytes', abbr: 'B', factor: 1}, {name: 'kilobytes', abbr: 'KB', factor: 1e3}, {name: 'megabytes', abbr: 'MB', factor: 1e6}, {name: 'gigabytes', abbr: 'GB', factor: 1e9}, {name: 'terabytes', abbr: 'TB', factor: 1e12}]},
]

// Units are matched case-insensitively, in either singular or plural form.
const unitLookup = new Map<string, {scale: UnitScale; unit: UnitDef}>()
for (let scale of unitScales) {
  for (let unit of scale.units) {
    unitLookup.set(unit.name, {scale, unit})
    unitLookup.set(unit.name.replace(/s$/, ''), {scale, unit})
  }
}
unitLookup.set('foot', unitLookup.get('feet')!)

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

  let precision = getPrecision(field)
  if (field?.metadata?.timeGrain === 'year' && Number.isInteger(amount)) return String(amount)
  if (field?.metadata?.ratio) return `${formatFixed(amount * 100, precision ?? 0)}%`
  if (field?.metadata?.pct) return `${formatFixed(amount, precision ?? 0)}%`

  let currency = field?.metadata?.currency?.toUpperCase()
  if (currency && supportedCurrencyCodes.has(currency)) {
    let sign = amount < 0 ? '-' : ''
    let formatted = precision == null ? currencyCompact.format(Math.abs(amount)).replace('K', 'k').replace('M', 'm').replace('B', 'b') : formatFixed(Math.abs(amount), precision)
    return `${sign}${formatCurrencySymbol(currency)}${formatted}`
  }

  let sign = amount < 0 ? '-' : ''
  let absolute = Math.abs(amount)

  // `#precision` means "N decimals in the declared unit", so it opts out of unit scaling entirely.
  if (precision != null) return addUnit(`${sign}${formatFixed(absolute, precision)}`, field, options)

  let scaled = formatInUnitScale(absolute, field, options)
  if (scaled) return `${sign}${scaled}`
  if (amount === 0) return addUnit('0', field, options)
  return addUnit(`${sign}${compactMagnitude(absolute)}`, field, options)
}

// Render a value in the most readable unit of its declared unit's scale, or undefined when the unit isn't recognized.
// Callers that share one scale across many values (axes, table columns) pass `scaleMax` so the whole set renders
// in the unit their extent suits, rather than each value picking its own and making the set jumpy.
function formatInUnitScale(absolute: number, field: Field | undefined, options: ValueFormatterOptions) {
  let declared = unitLookup.get(field?.metadata?.unit?.trim().toLowerCase() || '')
  if (!declared) return undefined
  let {scale, unit} = declared
  let base = absolute * unit.factor

  // Composite time survives a shared scale - "45m" beside "1d 1h" still reads cleanly. Only axes force it into a
  // single unit, since ticks like "4d 10h" / "4d 12h" are too wide and too samey to scan.
  if (scale.composite && options.unitStyle !== 'axis') return base ? formatComposite(scale, base) : `0${unit.abbr}`

  if (options.scaleMax == null) return base ? withUnit(base, pickUnit(scale, base), base) : `0${unit.abbr}`

  // A shared scale needs its max to fill the chosen unit several times over: pick one the max only just reaches
  // and every other value in the set drops below 1 (0.24d, 0.059d) instead of reading cleanly (5.83h, 1.42h).
  let max = Math.abs(options.scaleMax) * unit.factor
  return withUnit(base, pickUnit(scale, max, 3), max)
}

// Join a scaled number to its abbreviation. A value that still needed generic compaction gets a space so the
// magnitude doesn't read as part of the abbreviation (1.5klb). `reference` decides that for the whole set, so a
// shared scale never mixes "300mi" with "1k mi".
function withUnit(base: number, target: UnitDef, reference: number) {
  let separator = /[a-z]$/i.test(compactMagnitude(reference / target.factor)) ? ' ' : ''
  return `${compactMagnitude(base / target.factor)}${separator}${target.abbr}`
}

// Time isn't decimal, so we spell it out as up to two parts: 1d 1h, 90m -> 1h 30m.
// Capping at two keeps it scannable - "4d 10h 33m 12s" is worse than "4d 10h".
function formatComposite(scale: UnitScale, base: number) {
  let primary = pickUnit(scale, base)
  let whole = Math.floor(base / primary.factor)

  // Below the scale's smallest unit we can't go any further down, so fall back to a fractional value there.
  if (!whole) return `${compactMagnitude(base / primary.factor)}${primary.abbr}`
  if (whole >= 1000) return `${compactMagnitude(whole)} ${primary.abbr}`

  let next = scale.units[scale.units.indexOf(primary) - 1]
  let remainder = next ? Math.floor((base - whole * primary.factor) / next.factor) : 0
  return remainder ? `${whole}${primary.abbr} ${remainder}${next.abbr}` : `${whole}${primary.abbr}`
}

// The largest unit the value fills `minCount` times over, flooring at the scale's smallest unit.
function pickUnit(scale: UnitScale, base: number, minCount = 1) {
  let chosen = scale.units[0]
  for (let unit of scale.units) if (base >= unit.factor * minCount) chosen = unit
  return chosen
}

// Our generic magnitude compaction, used for unrecognized units and for values already scaled into a unit.
function compactMagnitude(absolute: number) {
  if (!absolute) return '0'
  if (absolute >= 1e12) return `${compactValue(absolute / 1e12)}T`
  if (absolute >= 1e9) return `${compactValue(absolute / 1e9)}B`
  if (absolute >= 1e6) return `${compactValue(absolute / 1e6)}M`
  if (absolute >= 1e3) return `${compactValue(absolute / 1e3)}k`
  if (absolute >= 1e-3) return compactValue(absolute)
  if (absolute >= 1e-6) return `${compactValue(absolute * 1e3)}m`
  if (absolute >= 1e-9) return `${compactValue(absolute * 1e6)}u`
  if (absolute >= 1e-12) return `${compactValue(absolute * 1e9)}n`
  return compactValue(absolute)
}

function formatCurrencySymbol(currency: string) {
  let parts = new Intl.NumberFormat('en-US', {style: 'currency', currency, currencyDisplay: 'symbol', maximumFractionDigits: 0}).formatToParts(0)
  return parts.find(part => part.type === 'currency')?.value || currency
}

function getPrecision(field?: Field) {
  let raw = field?.metadata?.precision
  if (raw == null) return undefined
  let precision = Number(raw)
  return Number.isInteger(precision) && precision >= 0 && precision <= 20 ? precision : undefined
}

function formatFixed(value: number, precision?: number) {
  if (precision == null) return percent.format(value)
  return new Intl.NumberFormat('en-US', {minimumFractionDigits: precision, maximumFractionDigits: precision}).format(value)
}

// Recognized units always render as their abbreviation; anything else keeps the raw string, parenthesized on axes.
function addUnit(value: string, field: Field | undefined, options: ValueFormatterOptions) {
  let unit = field?.metadata?.unit?.trim()
  if (!unit) return value
  let declared = unitLookup.get(unit.toLowerCase())
  if (declared) return `${value}${declared.unit.abbr}`
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
export function formatFromField(field: Field | undefined, value: unknown, options: ValueFormatterOptions = {}) {
  if (value === null || value === undefined) return '-'

  let type = String(field?.type || '').toLowerCase()
  if (type === 'number') return formatSingleValue(value, field, options)
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

// Round to three significant figures, then trim trailing zeros so a round 50 stays `50` rather than `50.0`.
// Three rather than two because converting between units lands on numbers that aren't round (14512 meters is 14.512km).
function compactValue(num: number) {
  let exponent = Math.floor(Math.log10(Math.abs(num)))
  let scale = Math.pow(10, exponent - 2)
  let rounded = Math.round(num / scale) * scale
  if (!Number.isFinite(rounded)) return String(num)
  let magnitude = Math.floor(Math.log10(rounded))
  let decimals = Math.max(0, 2 - magnitude)
  return rounded
    .toFixed(decimals)
    .replace(/\.0+$/, '')
    .replace(/(\.[0-9]*[1-9])0+$/, '$1')
    .replace(/\.$/, '')
}
