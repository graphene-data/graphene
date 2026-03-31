import {beforeAll, test, expect} from 'vitest'

import {scalarType, withTypeMetadata} from '../../lang/types.ts'

let translateData: (data: any, node: any) => {rows: any[]}
let getColumnSummary: (data: any, returnType?: string) => any

beforeAll(async () => {
  ;(globalThis as any).window = {
    $GRAPHENE: {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  ;({translateData} = await import('../internal/queryEngine.ts'))
  ;({default: getColumnSummary} = await import('../component-utilities/getColumnSummary.js'))
})

test('translateData remaps Snowflake-style uppercase row keys to requested field casing', () => {
  let data = {
    rows: [{LOCATION_STATE_CODE: 'CA', NUM: 3}],
    fields: [
      {name: 'location_state_code', type: scalarType('string')},
      {name: 'num', type: scalarType('number')},
    ],
  }
  let node = {
    fields: new Map([
      ['x', 'location_state_code'],
      ['y', 'num'],
    ]),
  }

  let result = translateData(data, node)

  expect(result.rows[0]).toEqual({location_state_code: 'CA', num: 3})
  expect((result.rows as any)._evidenceColumnTypes.map((c: any) => c.name)).toEqual(['location_state_code', 'num'])
})

test('translateData preserves field metadata for UI column summaries', () => {
  let data = {
    rows: [{month_start: '2021-01-01', sales: 3}],
    fields: [
      {name: 'month_start', type: withTypeMetadata(scalarType('date'), {temporal: {grain: 'month'}})},
      {name: 'sales', type: scalarType('number')},
    ],
  }
  let node = {
    fields: new Map([
      ['x', 'month_start'],
      ['y', 'sales'],
    ]),
  }

  let result = translateData(data, node)
  let summary = getColumnSummary(result.rows)

  expect((result.rows as any)._evidenceColumnTypes[0].fieldMetadata).toEqual({temporal: {grain: 'month'}})
  expect(summary.month_start.fieldMetadata).toEqual({temporal: {grain: 'month'}})
})
