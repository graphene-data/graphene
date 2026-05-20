/// <reference types="vitest/globals" />
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import path from 'node:path'
import {vi} from 'vitest'

import {setGlobalConfig} from '../lang/config.ts'
import {LocalQueryCacheStore, runWithQueryCache} from './connections/queryCache.ts'
import {type QueryCacheEntry, type QueryConnection, type QueryOptions, type QueryResult} from './connections/types.ts'

class StoredCacheConnection implements QueryConnection {
  freshRuns = 0
  cachedRuns = 0
  failCached = false

  runQuery(_sql: string, _options?: QueryOptions): Promise<QueryResult> {
    this.freshRuns += 1
    return Promise.resolve({rows: [{source: 'fresh', n: this.freshRuns}], totalRows: 1, queryCacheRef: {provider: 'snowflake', queryId: `query-${this.freshRuns}`}})
  }

  retrieveCachedQuery(_entry: QueryCacheEntry): Promise<QueryResult> {
    this.cachedRuns += 1
    if (this.failCached) throw new Error('cached result expired')
    return Promise.resolve({rows: [{source: 'cache'}], totalRows: 1})
  }

  queryCacheIdentity() {
    return {provider: 'snowflake' as const, account: 'acct', username: 'user', role: 'role'}
  }

  listDatasets() {
    return Promise.resolve([])
  }
  listTables() {
    return Promise.resolve([])
  }
  describeTable() {
    return Promise.resolve([])
  }
  close() {
    return Promise.resolve()
  }
}

class DelegatedCacheConnection implements QueryConnection {
  lastOptions?: QueryOptions

  runQuery(sql: string, options: QueryOptions = {}): Promise<QueryResult> {
    this.lastOptions = options
    this.lastSql = sql
    return Promise.resolve({rows: [{source: 'fresh'}], totalRows: 1, cache: {status: 'delegated', provider: 'clickhouse'}})
  }

  lastSql?: string

  queryCacheIdentity() {
    return {provider: 'clickhouse' as const, database: 'default'}
  }

  listDatasets() {
    return Promise.resolve([])
  }
  listTables() {
    return Promise.resolve([])
  }
  describeTable() {
    return Promise.resolve([])
  }
  close() {
    return Promise.resolve()
  }
}

async function cacheProject() {
  let root = await fs.mkdtemp(path.join(os.tmpdir(), 'graphene-query-cache-'))
  await fs.mkdir(path.join(root, 'node_modules'))
  return root
}

describe('query cache store', () => {
  it('stores metadata without query text or row data', async () => {
    let root = await cacheProject()
    let store = new LocalQueryCacheStore(root)
    await store.set({
      key: 'abc',
      provider: 'snowflake',
      contextHash: 'ctx',
      createdAt: 1,
      expiresAt: Date.now() + 1000,
      ref: {provider: 'snowflake', queryId: 'query-1'},
    })

    let raw = await fs.readFile(path.join(root, 'node_modules/.graphene/query-cache.json'), 'utf-8')
    expect(raw).toContain('query-1')
    expect(raw).not.toContain('select * from private_table')
    expect(raw).not.toContain('source')
    expect(await store.get('abc')).toMatchObject({provider: 'snowflake', ref: {queryId: 'query-1'}})
  })

  it('prunes expired entries and treats corrupt files as empty', async () => {
    let root = await cacheProject()
    let file = path.join(root, 'node_modules/.graphene/query-cache.json')
    let store = new LocalQueryCacheStore(root)
    await store.set({key: 'old', provider: 'bigquery', contextHash: 'ctx', createdAt: 1, expiresAt: 2, ref: {provider: 'bigquery', jobId: 'job'}})
    await store.prune(3)
    expect(await store.get('old')).toBeNull()

    await fs.writeFile(file, '{not json')
    expect(await store.get('old')).toBeNull()
  })
})

describe('runWithQueryCache', () => {
  it('stores a fresh provider reference and replays it on the next matching query', async () => {
    let root = await cacheProject()
    setGlobalConfig({root, dialect: 'snowflake', snowflake: {account: 'acct', username: 'user', privateKeyPath: 'key'}})
    let conn = new StoredCacheConnection()

    let first = await runWithQueryCache(conn, 'select 1')
    let second = await runWithQueryCache(conn, 'select 1')

    expect(first.cache).toEqual({status: 'miss', provider: 'snowflake'})
    expect(second.cache).toEqual({status: 'hit', provider: 'snowflake'})
    expect(second.rows).toEqual([{source: 'cache'}])
    expect(conn.freshRuns).toBe(1)
    expect(conn.cachedRuns).toBe(1)
  })

  it('opts out when queryCache is false', async () => {
    let root = await cacheProject()
    setGlobalConfig({root, dialect: 'snowflake', queryCache: false, snowflake: {account: 'acct', username: 'user', privateKeyPath: 'key'}})
    let conn = new StoredCacheConnection()

    let res = await runWithQueryCache(conn, 'select 1')
    await runWithQueryCache(conn, 'select 1')

    expect(res.cache).toBeUndefined()
    expect(conn.freshRuns).toBe(2)
    expect(conn.cachedRuns).toBe(0)
  })

  it('logs and falls back to a direct query when replay fails', async () => {
    let root = await cacheProject()
    setGlobalConfig({root, dialect: 'snowflake', snowflake: {account: 'acct', username: 'user', privateKeyPath: 'key'}})
    let warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let conn = new StoredCacheConnection()

    await runWithQueryCache(conn, 'select 1')
    conn.failCached = true
    let fallback = await runWithQueryCache(conn, 'select 1')

    expect(fallback.rows).toEqual([{source: 'fresh', n: 2}])
    expect(conn.freshRuns).toBe(2)
    expect(warn.mock.calls[0][0]).toContain('Query cache failed')
    warn.mockRestore()
  })

  it('refreshes stored metadata without reading an existing cache entry', async () => {
    let root = await cacheProject()
    setGlobalConfig({root, dialect: 'snowflake', snowflake: {account: 'acct', username: 'user', privateKeyPath: 'key'}})
    let conn = new StoredCacheConnection()

    await runWithQueryCache(conn, 'select 1')
    let refreshed = await runWithQueryCache(conn, 'select 1', {queryCache: 'refresh'})
    let cached = await runWithQueryCache(conn, 'select 1')

    expect(refreshed.cache).toEqual({status: 'miss', provider: 'snowflake'})
    expect(cached.rows).toEqual([{source: 'cache'}])
    expect(conn.freshRuns).toBe(2)
    expect(conn.cachedRuns).toBe(1)
  })

  it('delegates cache settings for providers without stored references', async () => {
    let root = await cacheProject()
    setGlobalConfig({root, dialect: 'clickhouse', clickhouse: {url: 'https://example.com', username: 'default'}})
    let conn = new DelegatedCacheConnection()

    let res = await runWithQueryCache(conn, 'select 1')

    expect(conn.lastSql).toBe('select 1')
    expect(conn.lastOptions).toEqual({queryCache: 'read-write'})
    expect(res.cache).toEqual({status: 'delegated', provider: 'clickhouse'})
  })
})
