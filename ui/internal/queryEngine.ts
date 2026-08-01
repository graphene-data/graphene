// The query engine keeps Markdown named-query declarations separate from executable nodes requested by components.
// Simple reads can point a named query at one shared node; expressions and model-table reads get independent nodes.
// When inputs change, the engine reruns those nodes and notifies their subscribers.

import {writable} from 'svelte/store'

import type {GrapheneError} from '../../lang/index.d.ts'

import {type QueryResult, type Field} from '../component-utilities/types.ts'
import {cacheRead, cacheWrite, getHashes} from './clientCache.ts'
import {getParams} from './params.ts'

type ResultHandler = (res: QueryResult | void) => void

interface QueryNode {
  source: string
  contents: string
  subscribers: Map<ResultHandler, string | undefined>
  loading: boolean
  fields: string[]
  result?: QueryResult
  error?: GrapheneError
  runAt?: number
  controller?: AbortController
}

interface NamedQuery {
  contents: string
  node?: QueryNode
}

export interface QueryRequest {
  params: Record<string, any>
  gsql: string
  hashes: string[]
  repoId: string
}

export interface QueryState {
  oldestRunAt?: number
  loading: boolean
}

export type QueryFetcher = (req: QueryRequest, options?: {refresh?: boolean; signal?: AbortSignal}) => Promise<QueryResult>

let runPending: Promise<void> | null = null
let refreshNextRun = false
let queryGeneration = 0 // if we resetQueryEngine, we need to ignore any responses from previous queries
let namedQueries = new Map<string, NamedQuery>()
let nodes = [] as QueryNode[]
let queryResults = {} as Record<string, {rows: any[]; fields?: Field[]}>

let queryFetcher: QueryFetcher = fetchWithCache
export const setQueryFetcher = f => queryFetcher = f
export const queryState = writable<QueryState>({loading: false})

// Named query blocks are declarations, not executable nodes. They are available to every component query
// because one named query may depend on another that no component requests directly.
function registerQuery(name: string, contents: string) {
  namedQueries.set(name, {contents})
}

// Called by viz components to request data. Plain field reads from a Markdown named query share its full result;
// expressions and model-table reads keep their independent projected queries.
function query(source: string, fields: Record<string, string | string[]>, callback: ResultHandler, componentId?: string) {
  let node: QueryNode

  // Preserve field order because translateData maps result fields back to requested expressions by index.
  let seen = new Set<string>()
  let exprs = Object.values(fields)
    .flatMap(value => (Array.isArray(value) ? value : [value]))
    .filter(field => {
      if (seen.has(field)) return false
      seen.add(field)
      return true
    })

  // if a component that uses a named query with no additional expressions, then we can create a node
  // for the namedQuery itself, and potentially share it among components
  let namedQuery = namedQueries.get(source)
  let plainField = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/
  let isPlainQuery = exprs.every(field => plainField.test(field))
  if (namedQuery && isPlainQuery) {
    node = namedQuery.node || {loading: false, fields: [], source, contents: namedQuery.contents, subscribers: new Map()}
    namedQuery.node = node
  }

  node ||= {
    contents: `from ${source} select ${(exprs.length ? exprs : ['*']).join(', ')}`,
    loading: false,
    fields: exprs,
    source,
    subscribers: new Map([[callback, componentId]]),
  }

  // In the case of named queries, it's possible by the time we get your request, we've already
  // gotten back the data for that query, in which case we can just return it to you
  node.subscribers.set(callback, componentId)
  if (node.result) callback(node.result)
  else if (node.error) callback(errorResult(node.error, componentId))
  else if (node.loading) callback()

  if (!nodes.includes(node)) nodes.push(node)

  // The iframe bridge delivers component queries in separate tasks, so later queries may not exist yet.
  // Run this node directly; subsequent shareable requests subscribe to this in-flight or completed node.
  if (!node.loading && !node.result) void runNode(node)
  return componentId
}

function unsubscribe(callback: ResultHandler) {
  nodes.forEach(node => node.subscribers.delete(callback))
  namedQueries.forEach(query => {
    if (query.node && !query.node.subscribers.size) query.node = undefined
  })
  nodes = nodes.filter(node => node.subscribers.size)
  updatePageCacheState()
}

function resetQueryEngine() {
  nodes.forEach(node => node.controller?.abort())
  namedQueries.clear()
  nodes = []
  runPending = null
  queryGeneration++
  Object.keys(queryResults).forEach(key => delete queryResults[key])
  updatePageCacheState()
}

// Actually runs a given query that some frontend component is listening to.
// This is pretty dumb at the moment, it simply concats all code fenced queries as table statements, then appends the actual query at the end.
async function runNode(n: QueryNode, refresh = false) {
  if (!n.subscribers.size) throw new Error('running node nobody is listening to')

  let generation = queryGeneration
  n.controller?.abort()
  let controller = new AbortController()
  n.controller = controller

  n.subscribers.forEach((_, callback) => callback()) // notifies listeners we're back in the loading state
  n.loading = true
  n.result = undefined
  n.error = undefined
  updatePageCacheState()

  // build up the request body. Hashes is the list of ETag hashes currently in our browser cache. We send all of them,
  // letting the server determine the hash of this particular query, and whether data we already have is acceptable.
  let tables = Array.from(namedQueries, ([name, query]) => `table ${name} as (\n${query.contents}\n)`)
  let gsql = [...tables, n.contents].join('\n')
  let params = getParams()

  try {
    let hashes = await getHashes()
    if (controller.signal.aborted) return

    let res = await queryFetcher({params, gsql, hashes, repoId: window.$GRAPHENE?.repoId}, {refresh, signal: controller.signal})
    if (generation !== queryGeneration) return

    n.runAt = res.runAt
    let result = translateData(res, n)
    n.result = result
    queryResults[n.source] = result // TODO do we still need queryResults? Seems like a hack
    n.subscribers.forEach((_, callback) => callback(result))
  } catch (e) {
    if (controller.signal.aborted || generation !== queryGeneration) return
    let err = typeof e == 'string' ? new Error(e) : (e as Error)
    let grapheneError = err as GrapheneError
    n.error = {...grapheneError, message: err.message, stack: err.stack}
    n.subscribers.forEach((componentId, callback) => callback(errorResult(n.error!, componentId)))
  } finally {
    if (n.controller === controller) {
      n.controller = undefined
      n.loading = false
      updatePageCacheState()
    }
  }
}

async function fetchWithCache(req: QueryRequest, options: {refresh?: boolean; signal?: AbortSignal} = {}): Promise<QueryResult> {
  let response = await fetch('/_api/query', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...(options.refresh ? {'Cache-Control': 'no-cache'} : {})},
    body: JSON.stringify(req),
    signal: options.signal,
  })
  let hash = response.headers.get('ETag') || ''

  // cache hit. Read data out of the browser cache and return it
  if (response.status == 304) {
    return (await cacheRead(hash))! // client only sends hashes of things that are present in the cache
  }

  if (!response.ok) {
    let body = await response.json() as GrapheneError
    let err = new Error(body.message)
    Object.assign(err, body)
    throw err
  }

  // Cache writes are best-effort and should not block rendering fresh query results.
  // In tests, browser teardown can abort Cache.put() after assertions have passed.
  let write = cacheWrite(hash, response.clone())
  if (import.meta.env.VITE_TEST) void write.catch(() => {})
  else void write
  return await response.json()
}

function runAll() {
  if (runPending) return runPending
  let pending = Promise.resolve()
    .then(_runAll)
    .finally(() => {
      if (runPending === pending) runPending = null
    })
  runPending = pending
  return pending
}

export async function refreshQueries() {
  refreshNextRun = true
  if (runPending) await runPending
  return runAll()
}

async function _runAll() {
  let refresh = refreshNextRun
  let subscribedNodes = nodes.filter(node => node.subscribers.size)
  refreshNextRun = false

  await Promise.all(subscribedNodes.map(node => runNode(node, refresh)))
}

// This translates results we got back from the server into the format any frontend code expects.
export function translateData(data: any, node: QueryNode): QueryResult {
  let rows = data.rows || []
  let fields: Field[] = []

  let requestFields = node.fields

  data.fields.forEach((field, index) => {
    let requested = requestFields[index]
    let name = requested || field.name

    // The key in row objects usually matches field.name, except in snowflake where it gets auto-capitalized
    let rowKey = field.name
    if (rows[0] && !Object.hasOwn(rows[0], field.name)) {
      rowKey = Object.keys(rows[0]).find(k => k.toLowerCase() == field.name.toLowerCase())
    }

    // Result fields come back in select order, so we can map them back to the requested field names by index.
    // Row objects are still keyed by the warehouse result name, which may differ by alias or by Snowflake uppercasing.
    if (rowKey && rowKey != name) {
      rows.forEach(r => {
        r[name] = r[rowKey]
        delete r[rowKey]
      })
    }

    fields.push({...field, name})
  })

  return {rows, fields, runAt: data.runAt || Date.now()}
}

// Give each subscriber its own component context when a shared query fails.
function errorResult(error: GrapheneError, componentId?: string): QueryResult {
  return {rows: [], fields: [], error: {...error, componentId: componentId || error.componentId}, sql: '', runAt: Date.now()}
}

const isQueryLoading = () => !!nodes.find(node => node.loading)
const getLoadingQueries = () => nodes.filter(node => node.loading).map(node => Array.from(node.subscribers.values()).find(Boolean) || node.source)

function updatePageCacheState() {
  let timestamps = nodes.map(node => node.runAt).filter(Boolean) as number[]
  queryState.set({
    oldestRunAt: timestamps.length ? Math.min(...timestamps) : undefined,
    loading: isQueryLoading(),
  })
}

Object.assign(window.$GRAPHENE, {
  registerQuery,
  query,
  unsubscribe,
  resetQueryEngine,
  rerunQueries: runAll,
  refreshQueries,
  isQueryLoading,
  getLoadingQueries,
  queryResults,
})
