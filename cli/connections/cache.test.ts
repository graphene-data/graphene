import {EventEmitter} from 'node:events'
import {beforeEach, expect, test, vi} from 'vitest'

let bigQueryClient: any
let bigQueryCreatedJob: any
let bigQueryCachedJob: any

vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: vi.fn(function () {
    bigQueryClient = {
      createQueryJob: vi.fn(() => Promise.resolve([bigQueryCreatedJob])),
      job: vi.fn(() => bigQueryCachedJob),
    }
    return bigQueryClient
  }),
  BigQueryDate: class BigQueryDate {},
  BigQueryTimestamp: class BigQueryTimestamp {},
}))

let snowflakeConnection: any
let snowflakeStatement: any

vi.mock('snowflake-sdk', () => ({
  default: {
    configure: vi.fn(),
    createConnection: vi.fn(() => snowflakeConnection),
  },
}))

beforeEach(() => {
  bigQueryCreatedJob = {
    id: 'fallback-job',
    metadata: {jobReference: {jobId: 'fresh-job', location: 'US', projectId: 'warehouse-project'}, statistics: {query: {totalRows: '1'}}},
    getQueryResults: vi.fn(() => Promise.resolve([[{answer: 1}]])),
    getMetadata: vi.fn(() => Promise.resolve([{}])),
  }
  bigQueryCachedJob = {
    metadata: {statistics: {query: {totalRows: '1'}}},
    getQueryResults: vi.fn(() => Promise.resolve([[{answer: 1}]])),
    getMetadata: vi.fn(() => Promise.resolve([{}])),
  }
  snowflakeStatement = {
    getNumRows: () => 1,
    getQueryId: () => 'snowflake-query-id',
    streamRows: () => new FakeSnowflakeRows([{ANSWER: 1}]),
  }
  snowflakeConnection = {
    connect: (callback: any) => callback(null, snowflakeConnection),
    execute: vi.fn(({complete}: any) => complete(null, snowflakeStatement)),
    getConfig: () => ({account: 'acct', username: 'user', database: 'db', schema: 'schema', warehouse: 'wh', role: 'role'}),
    destroy: (callback: any) => callback(null),
  }
})

test('BigQuery query results include reusable job metadata', async () => {
  let {BigQueryConnection} = await import('./bigQuery.ts')
  let conn = new BigQueryConnection({projectId: 'warehouse-project'})

  let result = await conn.runQuery('select 1')
  let cached = await conn.retrieveQueryResults({jobId: 'fresh-job', location: 'US', projectId: 'warehouse-project'})

  expect(result.cacheRef).toEqual({provider: 'bigquery', ref: {jobId: 'fresh-job', location: 'US', projectId: 'warehouse-project'}})
  expect(cached.rows).toEqual([{answer: 1}])
  expect(bigQueryClient.job).toHaveBeenCalledWith('fresh-job', {location: 'US', projectId: 'warehouse-project'})
})

test('Snowflake query results include reusable query id metadata', async () => {
  let {SnowflakeConnection} = await import('./snowflake.ts')
  let conn = new SnowflakeConnection({username: 'user', account: 'acct'})

  let result = await conn.runQuery('select 1')
  let cached = await conn.retrieveQueryResults({queryId: 'snowflake-query-id'})

  expect(result.cacheRef).toEqual({provider: 'snowflake', ref: {queryId: 'snowflake-query-id'}})
  expect(cached.rows).toEqual([{ANSWER: 1}])
  expect(snowflakeConnection.execute).toHaveBeenLastCalledWith(expect.objectContaining({sqlText: "select * from table(result_scan('snowflake-query-id'))"}))
})

class FakeSnowflakeRows extends EventEmitter {
  rows: any[]

  constructor(rows: any[]) {
    super()
    this.rows = [...rows]
    setImmediate(() => {
      this.emit('readable')
      this.emit('end')
    })
  }

  read() {
    return this.rows.shift() || null
  }
}
