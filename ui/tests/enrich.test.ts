// Unit tests for the echarts enrichment pipeline (no browser).

import {describe, expect, test} from 'vitest'

import {enrich} from '../component-utilities/enrich.ts'

let fields: any[] = [
  {name: 'sales_usd0k', type: 'number'},
  {name: 'profit_margin', type: 'number'},
  {name: 'customer_segment', type: 'string'},
  {name: 'order_count', type: 'number'},
]
let rows: any[] = [
  {sales_usd0k: 100, profit_margin: 0.2, customer_segment: 'enterprise', order_count: 5},
  {sales_usd0k: 200, profit_margin: 0.3, customer_segment: 'enterprise', order_count: 8},
  {sales_usd0k: 150, profit_margin: 0.25, customer_segment: 'small_business', order_count: 3},
]

describe('titleCaseFieldLabels', () => {
  test('title-cases scatter axis names set from column names', () => {
    let out = enrich({color: ['#000'], xAxis: {name: 'sales_usd0k'}, yAxis: {name: 'profit_margin'},
      series: [{type: 'scatter', name: 'profit_margin', encode: {x: 'sales_usd0k', y: 'profit_margin'}}]} as any, rows, fields)
    expect(out.xAxis[0].name).toBe('Sales Usd0k')
    expect(out.yAxis[0].name).toBe('Profit Margin')
    expect(out.series[0].name).toBe('Profit Margin')
  })

  test('title-cases wide-form series names without touching encode (data binding stays intact)', () => {
    let out = enrich({color: ['#000'], xAxis: {}, yAxis: {},
      series: [
        {type: 'bar', name: 'sales_usd0k', encode: {x: 'customer_segment', y: 'sales_usd0k'}},
        {type: 'bar', name: 'profit_margin', encode: {x: 'customer_segment', y: 'profit_margin'}},
      ]} as any, rows, fields)
    expect(out.series.map((s: any) => s.name)).toEqual(['Sales Usd0k', 'Profit Margin'])
    // Encode must still reference the raw column names so ECharts can bind data from the dataset.
    expect(out.series.map((s: any) => s.encode.y)).toEqual(['sales_usd0k', 'profit_margin'])
  })

  test('leaves splitBy-generated series names (raw data values) untouched', () => {
    let out = enrich({color: ['#000'], xAxis: {name: 'sales_usd0k'}, yAxis: {},
      series: [{type: 'scatter', encode: {x: 'sales_usd0k', y: 'order_count', splitBy: 'customer_segment'}}]} as any, rows, fields)
    expect(out.xAxis[0].name).toBe('Sales Usd0k')
    expect(out.series.map((s: any) => s.name).sort()).toEqual(['enterprise', 'small_business'])
  })

  test('preserves legend selection across renders (selection keys match post-enrichment names)', () => {
    let base = {color: ['#000'], xAxis: {}, yAxis: {},
      series: [
        {type: 'bar', name: 'sales_usd0k', encode: {x: 'customer_segment', y: 'sales_usd0k'}},
        {type: 'bar', name: 'profit_margin', encode: {x: 'customer_segment', y: 'profit_margin'}},
      ]} as any

    let first = enrich(structuredClone(base), rows, fields)
    // Echarts emits a legendselectchanged keyed by the current (post-enrichment) series.name.
    let legendSelection = {[first.series[0].name!]: false, [first.series[1].name!]: true}

    let second = enrich({...structuredClone(base), legendSelection}, rows, fields)
    expect(second.legend[0]?.selected).toEqual({'Sales Usd0k': false, 'Profit Margin': true})
    // The selection keys still match the series.name after re-enrichment, so stack-corner
    // lookup (selected[series.name]) keeps working.
    expect(second.series.map((s: any) => s.name)).toEqual(['Sales Usd0k', 'Profit Margin'])
  })
})
