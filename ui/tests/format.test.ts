import {describe, expect, test} from 'vitest'

import {formatSingleValue} from '../component-utilities/format.ts'
import type {Field} from '../component-utilities/types.ts'

// Builds a numeric field carrying the metadata under test.
function field(metadata: Record<string, unknown>): Field {
  return {name: 'value', type: 'number', metadata} as Field
}

describe('unit formatting', () => {
  test('recognized units get an abbreviation instead of the raw word', () => {
    expect(formatSingleValue(10, field({unit: 'minutes'}))).toBe('10m')
    expect(formatSingleValue(45, field({unit: 'seconds'}))).toBe('45s')
    expect(formatSingleValue(3, field({unit: 'miles'}))).toBe('3mi')
    expect(formatSingleValue(0, field({unit: 'minutes'}))).toBe('0m')
  })

  test('units are case-insensitive and accept singular forms', () => {
    expect(formatSingleValue(10, field({unit: 'Minutes'}))).toBe('10m')
    expect(formatSingleValue(10, field({unit: 'MINUTE'}))).toBe('10m')
    expect(formatSingleValue(2, field({unit: 'kilogram'}))).toBe('2kg')
  })

  test('time scales into composite parts, capped at two', () => {
    expect(formatSingleValue(1500, field({unit: 'minutes'}))).toBe('1d 1h')
    expect(formatSingleValue(90, field({unit: 'minutes'}))).toBe('1h 30m')
    expect(formatSingleValue(3600, field({unit: 'seconds'}))).toBe('1h')
    expect(formatSingleValue(2.5, field({unit: 'weeks'}))).toBe('2w 3d')
  })

  test('time scales down, flooring at milliseconds', () => {
    expect(formatSingleValue(0.5, field({unit: 'minutes'}))).toBe('30s')
    expect(formatSingleValue(0.0015, field({unit: 'minutes'}))).toBe('90ms')
    expect(formatSingleValue(0.0005, field({unit: 'seconds'}))).toBe('0.5ms')
  })

  test('negatives keep their sign', () => {
    expect(formatSingleValue(-90, field({unit: 'minutes'}))).toBe('-1h 30m')
    expect(formatSingleValue(-1500, field({unit: 'meters'}))).toBe('-1.5km')
  })

  test('decimal families scale by prefix rather than composing', () => {
    expect(formatSingleValue(14512, field({unit: 'meters'}))).toBe('14.5km')
    expect(formatSingleValue(1500, field({unit: 'meters'}))).toBe('1.5km')
    expect(formatSingleValue(0.0005, field({unit: 'meters'}))).toBe('0.5mm')
    expect(formatSingleValue(1200, field({unit: 'grams'}))).toBe('1.2kg')
    expect(formatSingleValue(2500, field({unit: 'bytes'}))).toBe('2.5KB')
    expect(formatSingleValue(2.5e9, field({unit: 'bytes'}))).toBe('2.5GB')
  })

  test('never converts across measurement systems', () => {
    expect(formatSingleValue(1500, field({unit: 'meters'}))).toBe('1.5km')
    expect(formatSingleValue(10560, field({unit: 'feet'}))).toBe('2mi')
    expect(formatSingleValue(1500, field({unit: 'pounds'}))).toBe('1.5k lb')
  })

  test('precision opts out of scaling and keeps the declared unit', () => {
    expect(formatSingleValue(1500, field({unit: 'minutes', precision: 2}))).toBe('1,500.00m')
    expect(formatSingleValue(1500, field({unit: 'meters', precision: 0}))).toBe('1,500m')
  })

  test('unrecognized units keep the current compaction and raw suffix', () => {
    expect(formatSingleValue(1500, field({unit: 'parsecs'}))).toBe('1.5k parsecs')
    expect(formatSingleValue(1500, field({unit: 'knots'}), {unitStyle: 'axis'})).toBe('1.5k (knots)')
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
    expect([500, 15000].map(value => formatSingleValue(value, meters, {scaleMax: 15000}))).toEqual(['0.5km', '15km'])
  })

  test('a shared scale steps down when its max barely fills a unit', () => {
    let minutes = field({unit: 'minutes'})
    // 1500 minutes is only just over a day, so days would leave the rest of the set reading 0.059d.
    let ticks = [85, 350, 1500].map(value => formatSingleValue(value, minutes, {unitStyle: 'axis', scaleMax: 1500}))
    expect(ticks).toEqual(['1.4h', '5.8h', '25h'])
  })
})
