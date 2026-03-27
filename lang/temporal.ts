import {type FieldType, type Expr, type RefinedTemporalType, type TemporalBaseType} from './types.ts'

export type TimestampUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'
export type BaseTemporalType = TemporalBaseType

const DATE_GRAINS = ['year', 'quarter', 'month', 'week', 'day'] as const
const TIMESTAMP_GRAINS = ['hour', 'minute', 'second'] as const
const REFINED_TEMPORAL_TYPES = [...DATE_GRAINS, ...TIMESTAMP_GRAINS] as const

export type TemporalLiteral = {
  literal: string
  timeframe: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'
  type: BaseTemporalType
}

export function parseTemporalLiteral(value: string, expected: string): TemporalLiteral | null {
  let raw = (value ?? '').trim()
  if (!raw) return null

  let yearMatch = raw.match(/^([0-9]{4})$/)
  if (yearMatch) {
    let year = Number(yearMatch[1])
    return buildResult(year, 1, 1, 0, 0, 0, 'year', expected)
  }

  let yearMonthMatch = raw.match(/^([0-9]{4})-([0-9]{2})$/)
  if (yearMonthMatch) {
    let year = Number(yearMonthMatch[1])
    let month = Number(yearMonthMatch[2])
    if (!inRange(month, 1, 12)) return null
    return buildResult(year, month, 1, 0, 0, 0, 'month', expected)
  }

  let dateMatch = raw.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/)
  if (dateMatch) {
    let year = Number(dateMatch[1])
    let month = Number(dateMatch[2])
    let day = Number(dateMatch[3])
    if (!isValidDate(year, month, day)) return null
    return buildResult(year, month, day, 0, 0, 0, 'day', expected)
  }

  if (expected === 'timestamp') {
    let dateTimeMatch = raw.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})[Tt\s]([0-9]{1,2})(?::([0-9]{2})(?::([0-9]{2}))?)?$/)
    if (!dateTimeMatch) return null
    let year = Number(dateTimeMatch[1])
    let month = Number(dateTimeMatch[2])
    let day = Number(dateTimeMatch[3])
    if (!isValidDate(year, month, day)) return null

    let hour = Number(dateTimeMatch[4])
    let minute = dateTimeMatch[5] ? Number(dateTimeMatch[5]) : 0
    let second = dateTimeMatch[6] ? Number(dateTimeMatch[6]) : 0
    if (!inRange(hour, 0, 23) || !inRange(minute, 0, 59) || !inRange(second, 0, 59)) return null

    let timeframe: TemporalLiteral['timeframe'] = 'hour'
    if (dateTimeMatch[6]) {
      timeframe = 'second'
    } else if (dateTimeMatch[5]) {
      timeframe = 'minute'
    }

    return buildResult(year, month, day, hour, minute, second, timeframe, expected)
  }

  return null
}

const INTERVAL_UNITS: Record<string, TimestampUnit> = {
  second: 'second',
  seconds: 'second',
  sec: 'second',
  secs: 'second',
  minute: 'minute',
  minutes: 'minute',
  min: 'minute',
  mins: 'minute',
  hour: 'hour',
  hours: 'hour',
  hr: 'hour',
  hrs: 'hour',
  day: 'day',
  days: 'day',
  week: 'week',
  weeks: 'week',
  month: 'month',
  months: 'month',
  quarter: 'quarter',
  quarters: 'quarter',
  year: 'year',
  years: 'year',
}

export interface IntervalLiteral {
  quantity: number
  unit: TimestampUnit
}

export function parseIntervalLiteral(value: string): IntervalLiteral | null {
  let raw = (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!raw) return null
  let match = raw.match(/^(-?\d+(?:\.\d+)?)\s+([a-z]+)$/)
  if (!match) return null
  let quantity = Number(match[1])
  if (!Number.isFinite(quantity)) return null
  let unit = INTERVAL_UNITS[match[2]]
  if (!unit) return null
  return {quantity, unit}
}

export function parseIntervalUnit(value: string): TimestampUnit | null {
  return INTERVAL_UNITS[value.toLowerCase()] || null
}

export function parseRefinedTemporalType(value: string): RefinedTemporalType | null {
  let unit = parseIntervalUnit(value)
  if (!unit || !isRefinedTemporalType(unit)) return null
  return unit
}

export function isRefinedTemporalType(type: string | undefined): type is RefinedTemporalType {
  return !!type && (REFINED_TEMPORAL_TYPES as readonly string[]).includes(type)
}

export function isTemporalType(type: FieldType | undefined): type is BaseTemporalType | RefinedTemporalType {
  return type === 'date' || type === 'timestamp' || isRefinedTemporalType(type)
}

export function coarseTemporalType(type: BaseTemporalType | RefinedTemporalType): BaseTemporalType {
  if (type === 'date' || type === 'timestamp') return type
  return (TIMESTAMP_GRAINS as readonly string[]).includes(type) ? 'timestamp' : 'date'
}

function buildResult(year: number, month: number, day: number, hour: number, minute: number, second: number, timeframe: TemporalLiteral['timeframe'], expected: string): TemporalLiteral {
  if (expected === 'date') {
    return {literal: `${pad(year)}-${pad(month)}-${pad(day)}`, timeframe, type: 'date'}
  }
  return {
    literal: `${pad(year)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`,
    timeframe,
    type: 'timestamp',
  }
}

function inRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max
}

function isValidDate(year: number, month: number, day: number) {
  if (!inRange(month, 1, 12)) return false
  if (!inRange(day, 1, 31)) return false
  let date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function pad(value: number) {
  return value.toString().padStart(2, '0')
}

export function renderTemporalArithmetic(dialect: string, leftSql: string, leftType: 'date' | 'timestamp', op: '+' | '-', intervalExpr: NonNullable<Expr['interval']>) {
  if (dialect == 'snowflake') {
    let signedQuantity = op == '+' ? intervalExpr.quantitySql : `-(${intervalExpr.quantitySql})`
    let fnName = leftType == 'date' ? 'DATEADD' : 'TIMESTAMPADD'
    return `${fnName}(${intervalExpr.unit}, ${signedQuantity}, ${leftSql})`
  }
  return `${leftSql} ${op} ${renderStandaloneInterval(dialect, intervalExpr)}`
}

export function renderStandaloneInterval(dialect: string, intervalExpr: NonNullable<Expr['interval']>) {
  if (dialect == 'duckdb') {
    if (intervalExpr.form == 'constant') return `interval ${intervalExpr.quantitySql} ${intervalExpr.unit}`
    return `(${intervalExpr.quantitySql} * (interval 1 ${intervalExpr.unit}))`
  }
  return `interval ${intervalExpr.quantitySql} ${intervalExpr.unit}`
}
