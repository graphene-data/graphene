import {beforeAll, test, expect} from 'vitest'

let translateData: (data: any, node: any) => {rows: any[]}

beforeAll(async () => {
  ;(globalThis as any).window = {
    $GRAPHENE: {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  ;({translateData} = await import('../internal/queryEngine.ts'))
})

test('translateData remaps Snowflake-style uppercase row keys to requested field casing', () => {
  let data = {
    rows: [{LOCATION_STATE_CODE: 'CA', NUM: 3}],
    fields: [
      {name: 'location_state_code', type: 'string'},
      {name: 'num', type: 'number'},
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

test('translateData preserves refined Graphene temporal types while mapping them to Evidence dates', () => {
  let data = {
    rows: [{month_bucket: '2024-01-01', num: 3}],
    fields: [
      {name: 'month_bucket', type: 'month', baseType: 'date'},
      {name: 'num', type: 'number'},
    ],
  }
  let node = {
    fields: new Map([
      ['x', 'month_bucket'],
      ['y', 'num'],
    ]),
  }

  let result = translateData(data, node)

  expect((result.rows as any)._evidenceColumnTypes).toEqual([
    {name: 'month_bucket', evidenceType: 'date', grapheneType: 'month', grapheneBaseType: 'date'},
    {name: 'num', evidenceType: 'number', grapheneType: 'number', grapheneBaseType: undefined},
  ])
})
