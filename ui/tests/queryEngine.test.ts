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
