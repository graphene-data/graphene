import {describe, expect, test} from 'vitest'

import {displayUnitConversion, formatSingleValue} from '../component-utilities/format.ts'
import type {Field} from '../component-utilities/types.ts'

// Builds a numeric field carrying the metadata under test.
function field(metadata: Record<string, unknown>): Field {
  return {name: 'value', type: 'number', metadata} as Field
}

describe('unit formatting', () => {
  test('recognized units get an abbreviation instead of the raw word', () => {
    expect(formatSingleValue(10, field({unit: 'minutes'}))).toBe('10m')
    expect(formatSingleValue(45, field({unit: 'seconds'}))).toBe('45s')
    expect(formatSingleValue(3, field({unit: 'miles'}))).toBe('3 mi')
    expect(formatSingleValue(0, field({unit: 'minutes'}))).toBe('0m')
  })

  test('units are case-insensitive and accept singular forms', () => {
    expect(formatSingleValue(10, field({unit: 'Minutes'}))).toBe('10m')
    expect(formatSingleValue(10, field({unit: 'MINUTE'}))).toBe('10m')
    expect(formatSingleValue(2, field({unit: 'kilogram'}))).toBe('2 kg')
  })

  test('time scales into composite parts, capped at two', () => {
    expect(formatSingleValue(1500, field({unit: 'minutes'}))).toBe('1d 1h')
    expect(formatSingleValue(90, field({unit: 'minutes'}))).toBe('1h 30m')
    expect(formatSingleValue(3600, field({unit: 'seconds'}))).toBe('1h')

    // Durations step through months and years rather than weeks, and both are fixed-length so they stay consistent:
    // a month is a twelfth of a 365-day year, so 12 of them come back out as exactly one year.
    expect(formatSingleValue(18, field({unit: 'months'}))).toBe('1y 6mo')
    expect(formatSingleValue(12, field({unit: 'months'}))).toBe('1y')
    expect(formatSingleValue(365, field({unit: 'days'}))).toBe('1y')
    expect(formatSingleValue(45, field({unit: 'days'}))).toBe('1mo 14d')
    expect(formatSingleValue(30, field({unit: 'days'}))).toBe('30d')

    // Weeks aren't a step people say durations in, so they fall back like any other unrecognized unit.
    expect(formatSingleValue(3, field({unit: 'weeks'}))).toBe('3 weeks')
  })

  test('time scales down, flooring at milliseconds', () => {
    expect(formatSingleValue(0.5, field({unit: 'minutes'}))).toBe('30s')
    expect(formatSingleValue(0.0015, field({unit: 'minutes'}))).toBe('90ms')
    expect(formatSingleValue(0.0005, field({unit: 'seconds'}))).toBe('0.5ms')
  })

  test('negatives keep their sign', () => {
    expect(formatSingleValue(-90, field({unit: 'minutes'}))).toBe('-1h 30m')
    expect(formatSingleValue(-1500, field({unit: 'meters'}))).toBe('-1.5 km')
  })

  test('decimal families scale by prefix rather than composing', () => {
    expect(formatSingleValue(14512, field({unit: 'meters'}))).toBe('14.5 km')
    expect(formatSingleValue(1500, field({unit: 'meters'}))).toBe('1.5 km')
    expect(formatSingleValue(0.0005, field({unit: 'meters'}))).toBe('0.5 mm')
    expect(formatSingleValue(1200, field({unit: 'grams'}))).toBe('1.2 kg')
    expect(formatSingleValue(2500, field({unit: 'bytes'}))).toBe('2.5 KB')
    expect(formatSingleValue(2.5e9, field({unit: 'bytes'}))).toBe('2.5 GB')
  })

  test('never converts across measurement systems', () => {
    expect(formatSingleValue(1500, field({unit: 'meters'}))).toBe('1.5 km')
    expect(formatSingleValue(10560, field({unit: 'feet'}))).toBe('2 mi')
    expect(formatSingleValue(1500, field({unit: 'pounds'}))).toBe('1,500 lb')
  })

  test('precision opts out of scaling and keeps the declared unit', () => {
    expect(formatSingleValue(1500, field({unit: 'minutes', precision: 2}))).toBe('1,500.00m')
    expect(formatSingleValue(1500, field({unit: 'meters', precision: 0}))).toBe('1,500 m')
  })

  test('unrecognized units keep the current compaction and raw suffix', () => {
    expect(formatSingleValue(1500, field({unit: 'parsecs'}))).toBe('1.5k parsecs')
    // Axes used to parenthesize the fallback, which only made it louder.
    expect(formatSingleValue(10, field({unit: 'parsecs'}), {unitStyle: 'axis'})).toBe('10 parsecs')
  })

  test('time composes even on a shared scale, except on axes', () => {
    let minutes = field({unit: 'minutes'})
    // A table column shares a scale but still composes: 1h 25m beside 1d 1h reads better than 1.42h beside 25h.
    expect([85, 350, 1500].map(value => formatSingleValue(value, minutes, {scaleMax: 1500}))).toEqual(['1h 25m', '5h 50m', '1d 1h'])
  })

  test('shared scales pick one unit for the whole set', () => {
    let minutes = field({unit: 'minutes'})
    let ticks = [0, 1440, 2880, 4320].map(value => formatSingleValue(value, minutes, {unitStyle: 'axis', scaleMax: 4320}))
    expect(ticks).toEqual(['0d', '1d', '2d', '3d'])

    let small = [0, 5, 10].map(value => formatSingleValue(value, minutes, {unitStyle: 'axis', scaleMax: 10}))
    expect(small).toEqual(['0m', '5m', '10m'])

    let meters = field({unit: 'meters'})
    expect([500, 15000].map(value => formatSingleValue(value, meters, {scaleMax: 15000}))).toEqual(['0.5 km', '15 km'])
  })

  test('a value carrying a unit never takes a magnitude prefix on top of it', () => {
    // "2.5k m" is kilometers spelled badly, and milli/micro prefixes collide with the abbreviations outright.
    let centimeters = field({unit: 'centimeters'})
    let column = [0, 180, 250000, 0.4, -180].map(value => formatSingleValue(value, centimeters, {scaleMax: 250000}))
    expect(column).toEqual(['0 m', '1.8 m', '2,500 m', '0.004 m', '-1.8 m'])

    // Grouped digits read as exact, so they keep whole-number precision rather than rounding to three figures.
    expect(formatSingleValue(4243, field({unit: 'miles'}))).toBe('4,243 mi')
    expect(formatSingleValue(5e6, field({unit: 'pounds'}))).toBe('5,000,000 lb')
  })

  test('durations render tight, every other unit is held apart from its value', () => {
    // Inside a composite the space is already the separator between parts, so durations can't also use it here.
    expect(formatSingleValue(90, field({unit: 'minutes'}))).toBe('1h 30m')
    expect(formatSingleValue(45, field({unit: 'seconds'}))).toBe('45s')
    expect(formatSingleValue(1.2, field({unit: 'kilograms'}))).toBe('1.2 kg')
    expect(formatSingleValue(1.5, field({unit: 'pounds'}))).toBe('1.5 lb')
    expect(formatSingleValue(1500, field({unit: 'parsecs'}))).toBe('1.5k parsecs')
  })

  test('a shared scale steps down when its max barely fills a unit', () => {
    let minutes = field({unit: 'minutes'})
    // 1500 minutes is only just over a day, so days would leave the rest of the set reading 0.059d.
    let ticks = [85, 350, 1500].map(value => formatSingleValue(value, minutes, {unitStyle: 'axis', scaleMax: 1500}))
    expect(ticks).toEqual(['1.42h', '5.83h', '25h'])
  })

  test('charts convert their values into the unit they display in', () => {
    // 1908 minutes of flight time reads in hours, so the rows become hours and ECharts ticks round hours itself.
    expect(displayUnitConversion(field({unit: 'minutes'}), 1908)).toEqual({unit: 'hours', multiplier: 1 / 60})
    expect(displayUnitConversion(field({unit: 'meters'}), 15000)).toEqual({unit: 'kilometers', multiplier: 1 / 1000})

    // Nothing to convert when the values are already declared in the unit they'll display in.
    expect(displayUnitConversion(field({unit: 'minutes'}), 90)).toBeUndefined()
    expect(displayUnitConversion(field({unit: 'parsecs'}), 1908)).toBeUndefined()
    expect(displayUnitConversion(field({unit: 'minutes', precision: 2}), 1908)).toBeUndefined()
  })

  test('converting leaves the rendered value unchanged', () => {
    // Conversion only changes which unit carries the number, so the same physical value still formats the same way.
    expect(formatSingleValue(1908, field({unit: 'minutes'}))).toBe(formatSingleValue(31.8, field({unit: 'hours'})))
    expect(formatSingleValue(15000, field({unit: 'meters'}))).toBe(formatSingleValue(15, field({unit: 'kilometers'})))
  })
})
