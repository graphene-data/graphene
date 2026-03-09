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

let runPending: Promise<void> | null = null
let params = {} as Record<string, any>
let queries = [] as QueryNode[]
let queryResults = {} as Record<string, {rows: any[]; fields?: Field[]}>

function registerQuery(name: string, contents: string) {
  queries = queries.filter(q => q.name !== name)
  queries.push({name, contents, loading: false, fields: new Map(), errors: []})
}

const getRoutePath = () => (typeof window === 'undefined' ? '/' : window.location.pathname || '/')

function updateParam(name: string, value: any) {
  params[name] = value
  runAll() // for now, do the easy thing and reload it all
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
      let isJson = response.headers.get('Content-Type') === 'application/json'
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

function translateData(data: any, node: QueryNode) {
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

    // server gives names like `col_1` to unnamed expressions but we translate it back into the original expression like `avg(price)`
    if (field.name.match(/col_\d+/)) {
      name = requestFields[index]
      rows.forEach(r => {
        r[name] = r[field.name]
        delete r[field.name]
      })
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

Object.assign(window.$GRAPHENE, {
  registerQuery,
  updateParam,
  query,
  unsubscribe,
  isQueryLoading,
  queryResults,
})
