// The query engine gathers query requests and inputs from components, and issues requests to the server.
// When inputs change, it takes care of notifying affected components and requesting new data.

import {cacheRead, cacheWrite, getHashes} from './clientCache.ts'
import {errorProvider} from './telemetry.ts'

interface QueryResult {
  rows?: any[]
  errors?: Error[]
  fields?: Field[]
}

interface Field {
  name: string
  type?: string
}

type ResultHandler = (res: QueryResult) => void

interface QueryNode {
  name?: string
  source?: string
  contents: string
  callback?: ResultHandler
  loading: boolean
  fields: Map<string, string | string[]>
  errors: Error[]
}

type ParamValue = string | number | boolean | null | Array<string | number | boolean>
type ParamSnapshot = Record<string, ParamValue>
type ParamEvent = {changed: Set<string>}
type ParamSubscriber = (params: ParamSnapshot, event: ParamEvent) => void

let runPending: Promise<void> | null = null
let params = {} as ParamSnapshot
let queries = [] as QueryNode[]
let queryResults = {} as Record<string, {rows: any[]; fields?: Field[]}>
let paramSubscribers = new Set<ParamSubscriber>()

function registerQuery(name: string, contents: string) {
  queries = queries.filter(q => q.name !== name)
  queries.push({name, contents, loading: false, fields: new Map(), errors: []})
}

const getRoutePath = () => (typeof window === 'undefined' ? '/' : window.location.pathname || '/')

function cloneParamValue(value: any): ParamValue {
  if (Array.isArray(value)) return value.map(v => v as string | number | boolean)
  return value as ParamValue
}

function paramsEqual(left: ParamSnapshot, right: ParamSnapshot) {
  let leftKeys = Object.keys(left).sort()
  let rightKeys = Object.keys(right).sort()
  if (leftKeys.length !== rightKeys.length) return false
  for (let i = 0; i < leftKeys.length; i++) {
    if (leftKeys[i] !== rightKeys[i]) return false
    if (!paramValueEqual(left[leftKeys[i]], right[rightKeys[i]])) return false
  }
  return true
}

function paramValueEqual(left: ParamValue | undefined, right: ParamValue | undefined) {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false
    if (left.length !== right.length) return false
    return left.every((value, index) => value === right[index])
  }
  return left === right
}

function snapshotParams() {
  return Object.fromEntries(Object.entries(params).map(([name, value]) => [name, cloneParamValue(value)])) as ParamSnapshot
}

function notifyParamSubscribers(event: ParamEvent) {
  let next = snapshotParams()
  paramSubscribers.forEach(subscriber => subscriber(next, event))
}

function getChangedParamNames(left: ParamSnapshot, right: ParamSnapshot) {
  let changed = new Set<string>()
  let names = new Set([...Object.keys(left), ...Object.keys(right)])
  names.forEach(name => {
    if (!paramValueEqual(left[name], right[name])) changed.add(name)
  })
  return changed
}

function serializeParam(value: ParamValue) {
  if (Array.isArray(value)) return value.map(item => String(item))
  if (value === null || value === undefined) return []
  return [String(value)]
}

function syncUrlFromParams() {
  if (typeof window === 'undefined') return
  let search = new URLSearchParams()
  Object.entries(params).forEach(([name, value]) => {
    serializeParam(value).forEach(item => {
      if (item === '') return
      search.append(name, item)
    })
  })
  let nextSearch = search.toString()
  let currentSearch = window.location.search.replace(/^\?/, '')
  if (nextSearch === currentSearch) return
  let nextUrl = window.location.pathname + (nextSearch ? `?${nextSearch}` : '') + window.location.hash
  window.history.replaceState(window.history.state, '', nextUrl)
}

function readParamsFromUrl() {
  if (typeof window === 'undefined') return {} as ParamSnapshot
  let next = {} as ParamSnapshot
  for (let [name, value] of new URLSearchParams(window.location.search).entries()) {
    let existing = next[name]
    if (existing === undefined) next[name] = value
    else if (Array.isArray(existing)) existing.push(value)
    else next[name] = [String(existing), value]
  }
  return next
}

function applyParams(nextParams: ParamSnapshot, {skipUrlSync = false}: {skipUrlSync?: boolean} = {}) {
  let cloned = Object.fromEntries(Object.entries(nextParams).map(([name, value]) => [name, cloneParamValue(value)])) as ParamSnapshot
  if (paramsEqual(params, cloned)) return
  let changed = getChangedParamNames(params, cloned)
  params = cloned
  if (!skipUrlSync) syncUrlFromParams()
  notifyParamSubscribers({changed})
  runAll() // for now, do the easy thing and reload it all
}

function updateParam(name: string, value: any) {
  applyParams({...params, [name]: cloneParamValue(value)})
}

function updateParams(nextParams: Record<string, any>) {
  let merged = {...params} as ParamSnapshot
  Object.entries(nextParams).forEach(([name, value]) => {
    merged[name] = cloneParamValue(value)
  })
  applyParams(merged)
}

function getParam(name: string) {
  return params[name]
}

function subscribeParams(subscriber: ParamSubscriber) {
  paramSubscribers.add(subscriber)
  return () => paramSubscribers.delete(subscriber)
}

function syncParamsFromUrl() {
  applyParams(readParamsFromUrl(), {skipUrlSync: true})
}

function query(source: string, fields: Record<string, string | string[]>, callback: ResultHandler) {
  // using Map here because it preserves the order in which we add fields to the select, which we use when we get the result.
  let map = new Map(Object.entries(fields))
  let exprs: string[] = []
  if (map.size > 0) {
    map.forEach(value => {
      if (Array.isArray(value)) exprs.push(...value)
      else exprs.push(value)
    })
  } else {
    exprs = ['*']
  }
  let contents = `from ${source} select ${exprs.join(', ')}`
  queries.push({contents, callback, loading: false, fields: map, errors: [], source})
  runAll()
}

function unsubscribe(callback: ResultHandler) {
  queries = queries.filter(q => q.callback !== callback)
}

function resetQueryEngine() {
  params = {}
  queries = []
  queryResults = {}
  notifyParamSubscribers({changed: new Set()})
}

async function runNode(n: QueryNode) {
  if (!n.callback) throw new Error('running node nobody is listening to')
  n.callback({}) // notify that the query is loading
  n.loading = true
  n.errors = []

  let hashes = await getHashes()
  let tables = queries.filter(q => q.name)
  let gsql = [...tables.map(q => `table ${q.name} as (${q.contents})`), n.contents].join('\n')

  try {
    let response = await fetch('/_api/query', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({params, gsql, hashes, routePath: getRoutePath(), repoId: window.$GRAPHENE?.repoId}),
    })
    let hash = response.headers.get('ETag') || ''

    if (response.status == 304) {
      // cache hit. Read it out and use that
      let body = await cacheRead(hash)
      let result = translateData(body, n)
      if (n.source) queryResults[n.source] = {rows: result.rows, fields: body.fields}
      n.callback(result)
    } else if (response.ok) {
      // cache miss. write it to the cache, and return the data
      cacheWrite(hash, response.clone()) // clone allows us to write the raw response into the cache
      let body = await response.json()
      let fields = body.fields // grab before translateData mutates
      let result = translateData(body, n) // nb that translateData modifies in place for performance
      if (n.source) queryResults[n.source] = {rows: result.rows, fields}
      n.callback(result)
    } else {
      // request failed. Record it
      let contentType = response.headers.get('Content-Type') || ''
      let isJson = contentType.includes('application/json')
      let body = isJson ? await response.json() : await response.text()
      n.errors = Array.isArray(body) ? body : [{message: body}]

      let fieldIds = Array.from(n.fields.entries()).flatMap(([name, val]) => {
        if (Array.isArray(val)) {
          if (val.length === 0) return [] as string[]
          if (val.length === 1) return [`${name}="${val[0]}"`]
          return [`${name}="${val.join(', ')}"`]
        }
        if (typeof val === 'string' && val.trim().length === 0) return [] as string[]
        if (val == null) return [] as string[]
        return [`${name}="${val}"`]
      })
      let idStr = `Query (data="${n.source}" ` + fieldIds.join(' ') + ')'
      n.errors.forEach(e => ((e as any).queryId = idStr))
      n.callback({errors: n.errors})
    }
  } catch (e) {
    n.errors = [e as Error]
  } finally {
    n.loading = false
  }
}

function runAll() {
  if (runPending) return runPending
  runPending = Promise.resolve()
    .then(_runAll)
    .finally(() => (runPending = null))
}

async function _runAll() {
  await Promise.all(
    queries.map(async n => {
      if (!n.callback) return
      await runNode(n)
    }),
  )
}

export function translateData(data: any, node: QueryNode) {
  let rows = data.rows || []
  rows.dataLoaded = true // evidence components need this to be set
  rows._evidenceColumnTypes = []
  let requestFields: string[] = []
  node.fields.forEach(value => {
    if (Array.isArray(value)) requestFields.push(...value)
    else requestFields.push(value)
  })

  data.fields.forEach((field, index) => {
    let name = field.name
    let requested = requestFields[index]

    // server gives names like `col_1` to unnamed expressions but we translate it back into the original expression like `avg(price)`
    if (field.name.match(/col_\d+/)) {
      name = requested
      rows.forEach(r => {
        r[name] = r[field.name]
        delete r[field.name]
      })
    }

    // Snowflake may return unquoted identifiers uppercased in row objects. If the requested
    // field is a simple identifier and only differs by case, remap row keys back to requested case.
    let isSimpleIdentifier = typeof requested == 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(requested)
    if (isSimpleIdentifier && rows.length > 0) {
      let current = name
      if (rows[0][current] === undefined) {
        let matched = Object.keys(rows[0]).find(k => k.toLowerCase() == requested.toLowerCase())
        if (matched) current = matched
      }
      if (current != requested && rows[0][current] !== undefined) {
        name = requested
        rows.forEach(r => {
          r[name] = r[current]
          delete r[current]
        })
      }
    }

    // map graphene types down to the ones evidence expects
    rows._evidenceColumnTypes.push({name, evidenceType: evidenceType(field.type)})
  })

  return {rows}
}

const isQueryLoading = () => !!queries.find(q => q.loading)

errorProvider('queryEngine', () => {
  let unique = {}
  queries
    .flatMap(q => q.errors)
    .filter(q => !!q)
    .forEach(e => {
      unique[e.message + String((e as any).from?.lineText)] = e
    })
  return Object.values(unique) as Error[]
})

function evidenceType(type: string | undefined) {
  if (type === 'string') return 'string'
  if (type === 'number') return 'number'
  if (type === 'boolean') return 'boolean'
  if (type === 'date' || type === 'timestamp') return 'date'
  console.warn('Unsupported evidence type ' + type)
  return 'string'
}

if (typeof window !== 'undefined') {
  params = readParamsFromUrl()
  window.addEventListener('popstate', syncParamsFromUrl)
  Object.assign(window.$GRAPHENE, {
    getParam,
    registerQuery,
    subscribeParams,
    syncParamsFromUrl,
    updateParam,
    updateParams,
    query,
    unsubscribe,
    resetQueryEngine,
    isQueryLoading,
    queryResults,
  })
}
