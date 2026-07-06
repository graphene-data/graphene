// clientCache stores query results in cacheStorage keyed by a hash of the compiled sql.
// Because the server does the compiling, we still need to make a request letting the server
// know all the hashes we have cached. If one matches, the server 304s (just like an ETag).

import {type QueryResult} from '../component-utilities/types.ts'

const TTL_MS = 1000 * 60 * 60 * 12 // 12hr

let cache: Cache | null = null
async function getCache() {
  cache ||= await caches.open('graphene-data')
  return cache
}

export async function getHashes(): Promise<string[]> {
  if (browserCacheDisabled()) return []

  let store = await getCache()
  let keys = await store.keys()
  return keys
    .map(k => {
      let url = new URL(k.url)
      let expires = Number(url.searchParams.get('expires') || 0)
      if (expires < Date.now()) {
        store.delete(k)
        return null
      }
      return url.pathname.replace(/^\//, '')
    })
    .filter(Boolean) as string[]
}

export async function cacheRead(hash: string): Promise<QueryResult | null> {
  if (browserCacheDisabled()) return null

  let store = await getCache()
  let resp = await store.match(`https://graphene-cache/${hash}`, {ignoreSearch: true})
  return await resp?.clone().json()
}

export async function cacheWrite(hash: string, response: Response) {
  if (!hash) return
  let store = await getCache()

  // remove any older versions of this query from the cache. This can happen if you force the query to ignore cache.
  let existing = await store.keys(`https://graphene-cache/${hash}`, {ignoreSearch: true})
  existing.forEach(key => store.delete(key))

  let result: Partial<QueryResult> = await response
    .clone()
    .json()
    .catch(() => ({}))
  let expiresAt = Number(result.runAt || Date.now()) + TTL_MS
  await store.put(`https://graphene-cache/${hash}?expires=${expiresAt}`, response)
}

// disableable for testing
function browserCacheDisabled() {
  if (typeof caches == 'undefined') return true
  if (typeof window == 'undefined') return false
  let value = new URLSearchParams(window.location.search).get('__graphene_no_browser_cache')
  return value != null && value != '0' && value != 'false'
}
