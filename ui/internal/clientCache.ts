// clientCache stores query results in cacheStorage keyed by a hash of the compiled sql.
// Because the server does the compiling, we still need to make a request letting the server
// know all the hashes we have cached. If one matches, the server 304s (just like an ETag).

const TTL_MS = 1000 * 60 * 60 * 2

let cache: Cache | null = null
async function getCache () {
  cache ||= await caches.open('graphene-data')
  return cache
}

export async function getHashes () {
  let store = await getCache()
  let keys = await store.keys()
  return keys.map(k => {
    let url = new URL(k.url)
    let expires = Number(url.searchParams.get('expires') || 0)
    if (expires < Date.now()) {
      store.delete(k)
      return null
    }
    return url.pathname.replace(/^\//, '')
  }).filter(h => !!h)
}

export async function cacheRead (hash: string): Promise<any | null> {
  let store = await getCache()
  let resp = await store.match(`https://graphene-cache/${hash}`, {ignoreSearch: true})
  return await resp?.clone().json()
}

export async function cacheWrite (hash: string, data:any) {
  if (!hash) return
  let store = await getCache()
  let expiresAt = Date.now() + TTL_MS
  let response = new Response(JSON.stringify(data), {headers: {'Content-Type': 'application/json'}})
  await store.put(`https://graphene-cache/${hash}?expires=${expiresAt}`, response)
}
