import type {Expression, FieldType} from './types.ts'
import type {TimestampUnit} from '@graphenedata/malloy'

export type TemporalLiteral = {
  literal: string
  timeframe: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'
  type: Extract<FieldType, 'date' | 'timestamp'>
}

export function parseTemporalLiteral (value: string, expected: Extract<FieldType, 'date' | 'timestamp'>): TemporalLiteral | null {
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

    let timeframe: TemporalLiteral['timeframe'] = dateTimeMatch[6]
      ? 'second'
      : dateTimeMatch[5]
        ? 'minute'
        : 'hour'

    return buildResult(year, month, day, hour, minute, second, timeframe, expected)
  }

  return null
}

export function parseTemporal (node: Expression): TimestampUnit | null {
  if (node.node !== 'stringLiteral') return null
  let rawValue = typeof (node as any).literal === 'string' ? (node as any).literal.trim() : ''
  if (!rawValue) return null

  let parsedDate = parseTemporalLiteral(rawValue, 'date')
  if (parsedDate) {
    let typeDef = {type: parsedDate.type, timeframe: parsedDate.timeframe}
    Object.assign(node, {node: 'timeLiteral', literal: parsedDate.literal, type: parsedDate.type, typeDef})
    return parsedDate.timeframe
  }

  let parsedTimestamp = parseTemporalLiteral(rawValue, 'timestamp')
  if (parsedTimestamp) {
    let typeDef = {type: parsedTimestamp.type, timeframe: parsedTimestamp.timeframe}
    Object.assign(node, {node: 'timeLiteral', literal: parsedTimestamp.literal, type: parsedTimestamp.type, typeDef})
    return parsedTimestamp.timeframe
  }

  let interval = parseIntervalLiteral(rawValue)
  if (interval) {
    Object.assign(node, {node: 'numberLiteral', literal: interval.quantity.toString(), type: 'interval', intervalUnit: interval.unit})
    return interval.unit
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

export function parseIntervalLiteral (value: string): IntervalLiteral | null {
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

function buildResult (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeframe: TemporalLiteral['timeframe'],
  expected: Extract<FieldType, 'date' | 'timestamp'>,
): TemporalLiteral {
  if (expected === 'date') {
    return {literal: `${pad(year)}-${pad(month)}-${pad(day)}`, timeframe, type: 'date'}
  }
  return {
    literal: `${pad(year)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`,
    timeframe,
    type: 'timestamp',
  }
}

function inRange (value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max
}

function isValidDate (year: number, month: number, day: number) {
  if (!inRange(month, 1, 12)) return false
  if (!inRange(day, 1, 31)) return false
  let date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function pad (value: number) {
  return value.toString().padStart(2, '0')
}
