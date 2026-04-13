// The query engine gathers query requests and inputs from components, and issues requests to the server.
// When inputs change, it takes care of notifying affected components and requesting new data.

import type {GrapheneError} from '../../lang/index.d.ts'

import {type QueryResult, type Field} from '../component-utilities/types.ts'
import {cacheRead, cacheWrite, getHashes} from './clientCache.ts'
import {getActivePageInputs, type ParamSnapshot} from './pageInputs.svelte.ts'
import {errorProvider} from './telemetry.ts'

type ResultHandler = (res: QueryResult | void) => void

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

export interface QueryRequest {
  params: ParamSnapshot
  gsql: string
  hashes: string[]
  repoId: string
}

export type QueryFetcher = (req: QueryRequest) => Promise<QueryResult>

let runPending: Promise<void> | null = null
let queries = [] as QueryNode[]
let queryResults = {} as Record<string, {rows: any[]; fields?: Field[]}>

let queryFetcher: QueryFetcher = fetchWithCache
export const setQueryFetcher = f => (queryFetcher = f)

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

// Called by GrapheneQuery tags to register a named query on the page
function registerQuery(name: string, contents: string) {
  queries = queries.filter(q => q.name !== name)
  queries.push({name, contents, loading: false, fields: new Map()})
}

// Called by viz components to request a particular query of data
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
  let queryId = buildQueryId(source, map)
  queries.push({contents, callback, loading: false, fields: map, source, queryId})
  runAll()
  return queryId
}

function unsubscribe(callback: ResultHandler) {
  queries = queries.filter(q => q.callback !== callback)
}

function resetQueryEngine() {
  queries = []
  Object.keys(queryResults).forEach(key => delete queryResults[key])
  getActivePageInputs().reset()
}

// Actually runs a given query that some frontend component is listening to.
// This is pretty dumb at the moment, it simply concats all code fenced queries as table statements, then appends the actual query at the end.
async function runNode(n: QueryNode) {
  if (!n.callback) throw new Error('running node nobody is listening to')

  n.callback() // notifies listeners we're back in the loading state
  n.loading = true
  n.error = undefined

  // build up the request body. Hashes is the list of ETag hashes currently in our browser cache. We send all of them,
  // letting the server determine the hash of this particular query, and whether data we already have is acceptable.
  let hashes = await getHashes()
  let tables = queries.filter(q => q.name)
  let gsql = [...tables.map(q => `table ${q.name} as (${q.contents})`), n.contents].join('\n')
  let params = getActivePageInputs().getParams()

  try {
    let res = await queryFetcher({params, gsql, hashes, repoId: window.$GRAPHENE?.repoId})
    let result = translateData(res, n)
    if (n.source) queryResults[n.source] = result // TODO do we still need queryResults? Seems like a hack
    n.callback(result)
  } catch (e) {
    let err = typeof e == 'string' ? new Error(e) : (e as Error)
    let grapheneError = err as GrapheneError
    n.error = {...grapheneError, queryId: n.queryId || grapheneError.queryId, message: err.message, stack: err.stack}
    n.callback({rows: [], fields: [], error: n.error, sql: ''})
  } finally {
    n.loading = false
  }
}

async function fetchWithCache(req: QueryRequest): Promise<QueryResult> {
  let response = await fetch('/_api/query', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(req),
  })
  let hash = response.headers.get('ETag') || ''

  // cache hit. Read data out of the browser cache and return it
  if (response.status == 304) {
    return await cacheRead(hash)
  }

  if (!response.ok) {
    let body = (await response.json()) as GrapheneError
    let err = new Error(body.message)
    Object.assign(err, body)
    throw err
  }

  cacheWrite(hash, response.clone())
  return await response.json()
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

// This translates results we got back from the server into the format any frontend code expects.
export function translateData(data: any, node: QueryNode): QueryResult {
  let rows = data.rows || []
  let fields: Field[] = []
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

    // Return fields for the new ECharts config but with the name mapped back to what was requested
    fields.push({...field, name})

    // map graphene types down to the ones evidence expects
    rows._evidenceColumnTypes.push({name, evidenceType: evidenceType(field.type), fieldMetadata: field.metadata})
  })

  return {rows, fields}
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

function evidenceType(type: Field['type'] | undefined) {
  let kind = typeDescription(type)
  if (kind === 'string') return 'string'
  if (kind === 'number') return 'number'
  if (kind === 'boolean') return 'boolean'
  if (kind === 'date' || kind === 'timestamp') return 'date'
  console.warn('Unsupported evidence type ' + kind)
  return 'string'
}

function typeDescription(type: Field['type'] | undefined): string {
  if (!type) return 'unknown'
  if (typeof type === 'string') return type
  return `array<${typeDescription(type.elementType)}>`
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
