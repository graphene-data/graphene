/// <reference types="vitest/globals" />

import {PostgresConnection} from './postgres.ts'

class FakePool {
  queries: {sql: string; params?: unknown[]}[] = []
  responses: any[]
  closed = false

  constructor(...responses: any[]) {
    this.responses = responses
  }

  query(sql: string, params?: unknown[]) {
    this.queries.push({sql, params})
    return Promise.resolve(this.responses.shift() || result([]))
  }

  end() {
    this.closed = true
    return Promise.resolve()
  }
}

function result(rows: Record<string, unknown>[], fields: {name: string; dataTypeID: number}[] = []) {
  return {rows, fields, rowCount: rows.length}
}

describe('PostgresConnection', () => {
  it('runs positional queries and normalizes postgres result values', async () => {
    let pool = new FakePool(
      result(
        [{total: '42', amount: '12.5', flight_date: new Date('2024-01-05T00:00:00Z'), updated_at: new Date('2024-01-05T12:30:00Z'), tags: ['a', 'b']}],
        [
          {name: 'total', dataTypeID: 20},
          {name: 'amount', dataTypeID: 1700},
          {name: 'flight_date', dataTypeID: 1082},
          {name: 'updated_at', dataTypeID: 1114},
          {name: 'tags', dataTypeID: 1009},
        ],
      ),
    )

    let conn = new PostgresConnection({pool, schema: 'public'})
    let res = await conn.runQuery('select count(*) as total')

    expect(res).toEqual({
      rows: [{total: 42, amount: 12.5, flight_date: '2024-01-05', updated_at: '2024-01-05T12:30:00.000Z', tags: ['a', 'b']}],
      totalRows: 1,
    })
    expect(pool.queries[0]).toEqual({sql: 'select count(*) as total', params: undefined})
  })

  it('converts named params to postgres positional params outside string literals', async () => {
    let pool = new FakePool(result([]))
    let conn = new PostgresConnection({pool, schema: 'public'})

    await conn.runQuery("select $carrier as carrier, '$carrier' as literal, $carrier as again, $min_total as min_total", {carrier: 'AA', min_total: 10})

    expect(pool.queries[0]).toEqual({
      sql: "select $1 as carrier, '$carrier' as literal, $1 as again, $2 as min_total",
      params: ['AA', 10],
    })
  })

  it('lists schemas and tables using information_schema', async () => {
    let pool = new FakePool(result([{schema_name: 'PUBLIC'}, {schema_name: 'Analytics'}]), result([{table_name: 'Flights'}, {table_name: 'Carriers'}]))
    let conn = new PostgresConnection({pool, schema: 'public'})

    await expect(conn.listDatasets()).resolves.toEqual(['public', 'analytics'])
    await expect(conn.listTables('analytics')).resolves.toEqual(['flights', 'carriers'])
    expect(pool.queries[1].params).toEqual(['analytics'])
  })

  it('describes tables in the requested schema and preserves postgres array display types', async () => {
    let pool = new FakePool(
      result([
        {column_name: 'ID', data_type: 'integer', udt_name: 'int4'},
        {column_name: 'Tags', data_type: 'ARRAY', udt_name: '_text'},
        {column_name: 'Scores', data_type: 'ARRAY', udt_name: '_int4'},
        {column_name: 'BigScores', data_type: 'ARRAY', udt_name: '_int8'},
      ]),
    )
    let conn = new PostgresConnection({pool, schema: 'public'})

    await expect(conn.describeTable('analytics.events')).resolves.toEqual([
      {name: 'id', dataType: 'integer'},
      {name: 'tags', dataType: 'text[]'},
      {name: 'scores', dataType: 'integer[]'},
      {name: 'bigscores', dataType: 'bigint[]'},
    ])
    expect(pool.queries[0].params).toEqual(['analytics', 'events'])
  })

  it('closes the pool', async () => {
    let pool = new FakePool()
    let conn = new PostgresConnection({pool, schema: 'public'})

    await conn.close()

    expect(pool.closed).toBe(true)
  })
})
