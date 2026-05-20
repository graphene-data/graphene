import {createHash, randomUUID} from 'node:crypto'
import * as fs from 'node:fs/promises'
import path from 'node:path'

import {config} from '../../lang/config.ts'
import {type QueryCacheEntry, type QueryConnection, type QueryOptions, type QueryParams, type QueryResult} from './types.ts'

const CACHE_VERSION = 1
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const fileLocks = new Map<string, Promise<void>>()

interface QueryCacheFile {
  version: number
  entries: Record<string, QueryCacheEntry>
}

export interface QueryCacheStore {
  get(key: string): Promise<QueryCacheEntry | null>
  set(entry: QueryCacheEntry): Promise<void>
  delete(key: string): Promise<void>
  prune(now?: number): Promise<void>
}

export async function runWithQueryCache(conn: QueryConnection, sql: string, options: QueryOptions = {}): Promise<QueryResult> {
  let {params} = options
  let identity = conn.queryCacheIdentity?.()
  if (!identity || config.queryCache !== true) return await conn.runQuery(sql, {params})
  let provider = identity.provider

  if (!conn.retrieveCachedQuery) {
    let res = await conn.runQuery(sql, {...options, queryCache: options.queryCache || 'read-write'})
    return withCacheStatus(res, res.cache || {provider})
  }

  let store = new LocalQueryCacheStore(config.root)
  let contextHash = hashValue(identity)
  let key = hashValue({version: CACHE_VERSION, dialect: config.dialect, root: config.root, sql, params: params || null, contextHash})
  let now = Date.now()

  if (options.queryCache != 'refresh') {
    try {
      await store.prune(now)
      let entry = await store.get(key)
      if (entry && entry.expiresAt > now && entry.contextHash == contextHash && entry.provider == provider) {
        try {
          let res = await conn.retrieveCachedQuery(entry)
          return withCacheStatus(res, {provider, createdAt: entry.createdAt, expiresAt: entry.expiresAt, ref: entry.ref})
        } catch (err) {
          await store.delete(key)
          throw err
        }
      }
      if (entry) return withCacheStatus(await runFreshAndStore(conn, store, key, contextHash, sql, params, provider, now, options.queryCache || 'read-write'), {provider})
    } catch (err) {
      logCacheFallback(err)
      return await conn.runQuery(sql, {params})
    }
  }

  try {
    let res = await runFreshAndStore(conn, store, key, contextHash, sql, params, provider, now, options.queryCache || 'read-write')
    return withCacheStatus(res, {provider})
  } catch (err) {
    logCacheFallback(err)
    return await conn.runQuery(sql, {params})
  }
}

async function runFreshAndStore(
  conn: QueryConnection,
  store: QueryCacheStore,
  key: string,
  contextHash: string,
  sql: string,
  params: QueryParams | undefined,
  provider: QueryCacheEntry['provider'],
  now: number,
  queryCache: QueryOptions['queryCache'],
) {
  let res = await conn.runQuery(sql, {params, queryCache})
  if (!res.cache?.ref) return res

  try {
    await store.set({
      key,
      provider,
      contextHash,
      createdAt: now,
      expiresAt: now + CACHE_TTL_MS,
      ref: res.cache.ref,
    })
  } catch (err) {
    logCacheFallback(err)
  }
  return res
}

function withCacheStatus(res: QueryResult, cache: QueryResult['cache']): QueryResult {
  return {...res, cache: {...res.cache, ...cache}}
}

function logCacheFallback(err: unknown) {
  let message = err instanceof Error ? err.message : String(err)
  console.warn(`[graphene] Query cache failed; running query directly. ${message}`)
}

export class LocalQueryCacheStore implements QueryCacheStore {
  private projectRoot: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async get(key: string): Promise<QueryCacheEntry | null> {
    let state = await this.read()
    return state.entries[key] || null
  }

  async set(entry: QueryCacheEntry): Promise<void> {
    let filePath = await this.filePath()
    if (!filePath) return

    await withFileLock(filePath, async () => {
      let state = await this.read()
      state.entries[entry.key] = entry
      await this.write(filePath, state)
    })
  }

  async delete(key: string): Promise<void> {
    let filePath = await this.filePath()
    if (!filePath) return

    await withFileLock(filePath, async () => {
      let state = await this.read()
      delete state.entries[key]
      await this.write(filePath, state)
    })
  }

  async prune(now = Date.now()): Promise<void> {
    let filePath = await this.filePath()
    if (!filePath) return

    await withFileLock(filePath, async () => {
      let state = await this.read()
      let entries = Object.fromEntries(Object.entries(state.entries).filter(([, entry]) => entry.expiresAt > now))
      if (Object.keys(entries).length == Object.keys(state.entries).length) return
      await this.write(filePath, {...state, entries})
    })
  }

  private async read(): Promise<QueryCacheFile> {
    let filePath = await this.filePath()
    if (!filePath) return defaultState()

    try {
      let parsed = JSON.parse(await fs.readFile(filePath, 'utf-8'))
      if (parsed?.version !== CACHE_VERSION || typeof parsed.entries != 'object' || Array.isArray(parsed.entries)) return defaultState()
      return {version: CACHE_VERSION, entries: parsed.entries}
    } catch {
      return defaultState()
    }
  }

  private async write(filePath: string, state: QueryCacheFile) {
    let tmpPath = `${filePath}.tmp-${randomUUID()}`
    await fs.mkdir(path.dirname(filePath), {recursive: true})
    await fs.writeFile(tmpPath, JSON.stringify(state, null, 2) + '\n')
    await fs.rename(tmpPath, filePath)
  }

  private async filePath() {
    let nodeModules = path.join(this.projectRoot, 'node_modules')
    try {
      if (!(await fs.stat(nodeModules)).isDirectory()) return null
    } catch {
      return null
    }
    return path.join(nodeModules, '.graphene', 'query-cache.json')
  }
}

function defaultState(): QueryCacheFile {
  return {version: CACHE_VERSION, entries: {}}
}

async function withFileLock(filePath: string, fn: () => Promise<void>) {
  let previous = fileLocks.get(filePath) || Promise.resolve()
  let current = previous.catch(() => {}).then(fn)
  fileLocks.set(filePath, current)
  try {
    await current
  } finally {
    if (fileLocks.get(filePath) === current) fileLocks.delete(filePath)
  }
}

function hashValue(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value == 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}
