import {beforeAll, test, expect} from 'vitest'

import {scalarType} from '../../lang/types.ts'

let translateData: (data: any, node: any) => {rows: any[]; fields?: any[]}
let setQueryFetcher: (fetcher: any) => void

beforeAll(async () => {
  ;(globalThis as any).$state = {raw: value => value}
  ;(globalThis as any).caches = {open: () => Promise.resolve({keys: () => Promise.resolve([])})}
  ;(globalThis as any).window = {
    $GRAPHENE: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    location: {search: ''},
  }
  ;({translateData, setQueryFetcher} = await import('../internal/queryEngine.ts'))
})

test('translateData remaps Snowflake-style uppercase row keys to requested field casing', () => {
  let data = {
    rows: [{LOCATION_STATE_CODE: 'CA', NUM: 3}],
    fields: [
      {name: 'location_state_code', type: scalarType('string')},
      {name: 'num', type: scalarType('number')},
    ],
  }
  let node = {fields: ['location_state_code', 'num']}

  let result = translateData(data, node)

  expect(result.rows[0]).toEqual({location_state_code: 'CA', num: 3})
  expect(result.fields?.map((field: any) => field.name)).toEqual(['location_state_code', 'num'])
})

test('translateData remaps default-named expressions to requested expression keys', () => {
  let data = {
    rows: [{MONTH: '2021-01-01', count: 3}],
    fields: [
      {name: 'month', type: scalarType('date'), metadata: {timeGrain: 'month', defaultName: 'month'}},
      {name: 'count', type: scalarType('number'), metadata: {defaultName: 'count'}},
    ],
  }
  let node = {fields: ["date_trunc('month', created_at)", 'count()']}

  let result = translateData(data, node)

  expect(result.rows[0]).toEqual({"date_trunc('month', created_at)": '2021-01-01', 'count()': 3})
  expect(result.fields?.map((field: any) => field.name)).toEqual(["date_trunc('month', created_at)", 'count()'])
})

test('translateData preserves field metadata for downstream table rendering', () => {
  let data = {
    rows: [{month_start: '2021-01-01', sales: 3}],
    fields: [
      {name: 'month_start', type: scalarType('date'), metadata: {timeGrain: 'month'}},
      {name: 'sales', type: scalarType('number')},
    ],
  }
  let node = {fields: ['month_start', 'sales']}

  let result = translateData(data, node)

  expect(result.fields?.[0].metadata).toEqual({timeGrain: 'month'})
})

test('query deduplicates fields before building gsql', async () => {
  ;(window as any).$GRAPHENE.resetQueryEngine()
  let gsql = ''
  setQueryFetcher((req: any) => {
    gsql = req.gsql
    return Promise.resolve({
      rows: [{name: 'Alaska Airlines', avg_delay: 12}],
      fields: [
        {name: 'name', type: scalarType('string')},
        {name: 'avg_delay', type: scalarType('number')},
      ],
    })
  })

  let result = await new Promise<any>(resolve => {
    ;(window as any).$GRAPHENE.query('delays_by_carrier', {x: 'name', y: 'avg_delay', sort: 'avg_delay'}, (res: any) => {
      if (res) resolve(res)
    })
  })

  expect(gsql).toBe('from delays_by_carrier select name, avg_delay')
  expect(result.fields.map((field: any) => field.name)).toEqual(['name', 'avg_delay'])
})
