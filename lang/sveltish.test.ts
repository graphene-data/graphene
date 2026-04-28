import {expect} from 'vitest'

/// <reference types="vitest/globals" />
import {extractSveltishAttributes, type SveltishAttribute} from './sveltish.ts'

function attr(fragment: string, key: string, baseStart = 0) {
  let result = extractSveltishAttributes(fragment, baseStart)[key]
  expect(result, `expected ${key} to be extracted`).toBeTruthy()
  return result
}

function expectAttr(fragment: string, actual: SveltishAttribute, expected: {key: string; value: string; baseStart?: number}) {
  let baseStart = expected.baseStart || 0
  let sourceValue = expected.value == 'true' ? expected.key : expected.value
  expect(actual.key).toBe(expected.key)
  expect(actual.value).toBe(expected.value)
  expect(fragment.slice(actual.keyStart - baseStart, actual.keyEnd - baseStart)).toBe(expected.key)
  expect(fragment.slice(actual.start - baseStart, actual.end - baseStart)).toBe(sourceValue)
}

describe('extractSveltishAttributes', () => {
  it('extracts unquoted, double-quoted, single-quoted, and boolean attributes', () => {
    let fragment = '<BarChart data=orders x="month" y=\'sum(revenue)\' label sort=rank />'
    let attrs = extractSveltishAttributes(fragment, 0)

    expect(Object.keys(attrs)).toEqual(['data', 'x', 'y', 'label', 'sort'])
    expectAttr(fragment, attrs.data, {key: 'data', value: 'orders'})
    expectAttr(fragment, attrs.x, {key: 'x', value: 'month'})
    expectAttr(fragment, attrs.y, {key: 'y', value: 'sum(revenue)'})
    expectAttr(fragment, attrs.label, {key: 'label', value: 'true'})
    expectAttr(fragment, attrs.sort, {key: 'sort', value: 'rank'})
  })

  it('returns absolute offsets based on the markdown fragment start', () => {
    let baseStart = 120
    let fragment = '<BarChart data=sales_by_month x="month" y=revenue />'

    expectAttr(fragment, attr(fragment, 'data', baseStart), {key: 'data', value: 'sales_by_month', baseStart})
    expectAttr(fragment, attr(fragment, 'x', baseStart), {key: 'x', value: 'month', baseStart})
    expectAttr(fragment, attr(fragment, 'y', baseStart), {key: 'y', value: 'revenue', baseStart})
  })

  it('allows whitespace around equals and stops unquoted values at the tag close', () => {
    let fragment = '<Chart data = sales width = 500 height=320/>'
    let attrs = extractSveltishAttributes(fragment, 0)

    expectAttr(fragment, attrs.data, {key: 'data', value: 'sales'})
    expectAttr(fragment, attrs.width, {key: 'width', value: '500'})
    expectAttr(fragment, attrs.height, {key: 'height', value: '320'})
  })

  it('skips standalone Svelte expressions and spread props', () => {
    let fragment = '<BarChart data=orders {...chartProps} {visible} x=month />'
    let attrs = extractSveltishAttributes(fragment, 0)

    expect(Object.keys(attrs)).toEqual(['data', 'x'])
    expectAttr(fragment, attrs.data, {key: 'data', value: 'orders'})
    expectAttr(fragment, attrs.x, {key: 'x', value: 'month'})
  })

  it('supports Svelte-style colon and dashed attribute names in the static subset', () => {
    let fragment = '<Input data-test="brand-filter" bind:value=brand disabled />'
    let attrs = extractSveltishAttributes(fragment, 0)

    expectAttr(fragment, attrs['data-test'], {key: 'data-test', value: 'brand-filter'})
    expectAttr(fragment, attrs['bind:value'], {key: 'bind:value', value: 'brand'})
    expectAttr(fragment, attrs.disabled, {key: 'disabled', value: 'true'})
  })

  it('keeps the last value when the same static attribute appears more than once', () => {
    let fragment = '<BarChart data=old data=new x=month />'
    let attrs = extractSveltishAttributes(fragment, 0)

    expectAttr(fragment, attrs.data, {key: 'data', value: 'new'})
    expectAttr(fragment, attrs.x, {key: 'x', value: 'month'})
  })
})
