/// <reference types="vitest/globals" />

import {vi} from 'vitest'

import {BigQueryConnection} from './bigQuery.ts'

class TestBigQueryConnection extends BigQueryConnection {
  protected readonly queryTimeoutMs = 1000

  constructor(job: any) {
    super({projectId: 'test-project'})
    ;(this as any).client = {createQueryJob: () => Promise.resolve([job])}
  }
}

describe('BigQueryConnection', () => {
  it('waits for query results instead of accepting incomplete BigQuery responses', async () => {
    let job = {
      metadata: {statistics: {query: {totalRows: '1'}}},
      getQueryResults: vi.fn().mockResolvedValue([[{category: 'Jeans'}]]),
    }
    let conn = new TestBigQueryConnection(job)

    await expect(conn.runQuery('select category from products')).resolves.toEqual({
      rows: [{category: 'Jeans'}],
      totalRows: 1,
    })

    expect(job.getQueryResults).toHaveBeenCalledWith({maxResults: 10000, timeoutMs: 1000})
  })
})
