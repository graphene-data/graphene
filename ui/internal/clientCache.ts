// clientCache stores query results in cacheStorage keyed by a hash of the compiled sql.
// Because the server does the compiling, we still need to make a request letting the server
// know all the hashes we have cached. If one matches, the server 304s (just like an ETag).

const TTL_MS = 1000 * 60 * 60 * 2

export type BrowserCacheMetadata = {createdAt: number}

export type BrowserCachedResult<T> = {
  result: T
  cache: BrowserCacheMetadata
}

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
      let entry = parseCacheKey(k)
      if (!entry || isExpired(entry.createdAt)) {
        store.delete(k)
        return null
      }
      return entry.hash
    })
    .filter(Boolean) as string[]
}

export async function cacheRead<T>(hash: string): Promise<BrowserCachedResult<T> | null> {
  if (browserCacheDisabled()) return null

  let store = await getCache()
  let entry = await findCacheEntry(store, hash)
  if (!entry) return null

  let resp = await store.match(entry.request)
  let result = (await resp?.clone().json()) as T | undefined
  if (!result) return null
  return {result, cache: {createdAt: entry.createdAt}}
}

export async function cacheWrite(hash: string, response: Response) {
  if (!hash || browserCacheDisabled()) return
  let store = await getCache()

  // remove any older versions of this query from the cache. This can happen if you force the query to ignore cache.
  let existing = await store.keys(`https://graphene-cache/${hash}`, {ignoreSearch: true})
  existing.forEach(key => store.delete(key))

  let now = Date.now()
  let body: {cache?: Partial<BrowserCacheMetadata>} = await response
    .clone()
    .json()
    .catch(() => ({}))
  let createdAt = Number(body?.cache?.createdAt || now)
  await store.put(cacheUrl(hash, createdAt), response)
}

async function findCacheEntry(store: Cache, hash: string) {
  let keys = await store.keys(`https://graphene-cache/${hash}`, {ignoreSearch: true})
  for (let request of keys) {
    let entry = parseCacheKey(request)
    if (!entry) continue
    if (!isExpired(entry.createdAt)) return {...entry, request}
    store.delete(request)
  }
  return null
}

function parseCacheKey(request: Request) {
  let url = new URL(request.url)
  let hash = url.pathname.replace(/^\//, '')
  let createdAt = Number(url.searchParams.get('createdAt') || 0)
  if (!hash || !createdAt) return null
  return {hash, createdAt}
}

function cacheUrl(hash: string, createdAt: number) {
  return `https://graphene-cache/${hash}?createdAt=${createdAt}`
}

function isExpired(createdAt: number) {
  return createdAt + TTL_MS < Date.now()
}

// disableable for testing
function browserCacheDisabled() {
  if (typeof window == 'undefined') return false
  let value = new URLSearchParams(window.location.search).get('__graphene_no_browser_cache')
  return value != null && value != '0' && value != 'false'
}
