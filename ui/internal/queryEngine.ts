// The query engine gathers query requests and inputs from components, and issues requests to the server.
// When inputs change, it takes care of notifying affected components and requesting new data.

import type {GrapheneError} from '../../lang/types.ts'

import {cacheRead, cacheWrite, getHashes} from './clientCache.ts'
import {getActivePageInputs} from './pageInputs.svelte.ts'
import {errorProvider} from './telemetry.ts'

interface QueryResult {
  rows?: any[]
  error?: GrapheneError
  fields?: Field[]
}

interface Field {
  name: string
  type?: string
}

interface EvidenceColumnType {
  name: string
  evidenceType: string
  grapheneType?: string
}

type ResultHandler = (res: QueryResult) => void

interface QueryNode {
  name?: string
  source?: string
  contents: string
  callback?: ResultHandler
  loading: boolean
  fields: Map<string, string | string[]>
  queryId?: string
  error?: GrapheneError
}

let runPending: Promise<void> | null = null
let queries = [] as QueryNode[]
let queryResults = {} as Record<string, {rows: any[]; fields?: Field[]}>

// QueryId is a string we construct to make it easier to figure out which chart in the md is associated with which chart in the ui
// Right now it's just a combination of the data and any field attributes, but that seems to be good enough.
function buildQueryId(source: string | undefined, fields: Map<string, string | string[]>) {
  let fieldIds = Array.from(fields.entries()).flatMap(([name, value]) => {
    if (Array.isArray(value)) return value.length ? [`${name}="${value.join(', ')}"`] : []
    if (value == null) return []
    if (typeof value === 'string' && value.trim().length === 0) return []
    return [`${name}="${value}"`]
  })
  return `Query (data="${source}"${fieldIds.length ? ` ${fieldIds.join(' ')}` : ''})`
}

function registerQuery(name: string, contents: string) {
  queries = queries.filter(q => q.name !== name)
  queries.push({name, contents, loading: false, fields: new Map()})
}

const getRoutePath = () => (typeof window === 'undefined' ? '/' : window.location.pathname || '/')

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
  queries.push({contents, callback, loading: false, fields: map, source, queryId: buildQueryId(source, map)})
  runAll()
}

function unsubscribe(callback: ResultHandler) {
  queries = queries.filter(q => q.callback !== callback)
}

function resetQueryEngine() {
  queries = []
  Object.keys(queryResults).forEach(key => delete queryResults[key])
  getActivePageInputs().reset()
}

async function runNode(n: QueryNode) {
  if (!n.callback) throw new Error('running node nobody is listening to')
  let callback = n.callback
  let finish = (result: QueryResult) => {
    callback(result)
    n.loading = false
  }

  callback({})
  n.loading = true
  n.error = undefined

  let queryId = n.queryId || buildQueryId(n.source, n.fields)
  n.queryId = queryId

  let hashes = await getHashes()
  let tables = queries.filter(q => q.name)
  let gsql = [...tables.map(q => `table ${q.name} as (${q.contents})`), n.contents].join('\n')
  let params = getActivePageInputs().getParams()

  let error: GrapheneError | undefined
  let response = await fetch('/_api/query', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({params, gsql, hashes, routePath: getRoutePath(), repoId: window.$GRAPHENE?.repoId}),
  }).catch(e => (error = e))

  // network error
  if (error) {
    let err = error instanceof Error ? error : new Error(String(error))
    n.error = {queryId, message: err.message, stack: err.stack}
    finish({error: n.error})
    return
  }

  // cache hit. Read data out of the browser cache
  let hash = response.headers.get('ETag') || ''
  if (response.status == 304) {
    let body = await cacheRead(hash)
    let result = translateData(body, n)
    if (n.source) queryResults[n.source] = {rows: result.rows, fields: body.fields}
    finish(result)
    return
  }

  // cache miss. write data into the cache
  if (response.ok) {
    cacheWrite(hash, response.clone())
    let body = await response.json()
    let fields = body.fields
    let result = translateData(body, n)
    if (n.source) queryResults[n.source] = {rows: result.rows, fields}
    finish(result)
    return
  }

  // otherwise, the query failed
  error = (await response.json()) as GrapheneError
  error.queryId ||= queryId
  n.error = error
  finish({error: n.error})
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
  rows._evidenceColumnTypes = [] as EvidenceColumnType[]
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
    rows._evidenceColumnTypes.push({name, evidenceType: evidenceType(field.type), grapheneType: field.type})
  })

  return {rows}
}

const isQueryLoading = () => !!queries.find(q => q.loading)

errorProvider('queryEngine', () => {
  let unique: Record<string, GrapheneError> = {}
  queries
    .map(q => q.error)
    .filter(e => !!e)
    .forEach(error => {
      unique[`${error.queryId}|${error.message}|${error.frame || ''}`] = error
    })
  return Object.values(unique)
})

function evidenceType(type: string | undefined) {
  if (type === 'string') return 'string'
  if (type === 'number') return 'number'
  if (type === 'boolean') return 'boolean'
  if (['date', 'timestamp', 'year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second'].includes(type || '')) return 'date'
  console.warn('Unsupported evidence type ' + type)
  return 'string'
}

if (typeof window !== 'undefined') {
  Object.assign(window.$GRAPHENE, {
    getParam: (name: string) => getActivePageInputs().getParam(name),
    registerQuery,
    subscribeParams: subscriber => getActivePageInputs().subscribeParams(subscriber),
    syncParamsFromUrl: () => getActivePageInputs().syncFromUrl(),
    updateParam: (name: string, value: any) => getActivePageInputs().updateParam(name, value),
    updateParams: (nextParams: Record<string, any>) => getActivePageInputs().updateParams(nextParams),
    query,
    unsubscribe,
    resetQueryEngine,
    rerunQueries: runAll,
    isQueryLoading,
    queryResults,
  })
}
