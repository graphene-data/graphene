// The query engine gathers query requests and inputs from components, and issues requests to the server.
// When inputs change, it takes care of notifying affected components and requesting new data.

import {cacheRead, cacheWrite, getHashes} from './clientCache'
import {errorProvider} from './telemetry.ts'

interface QueryError {
  file: string
  message: string
  from: {lineText: string}
}

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
  contents: string
  callback?: ResultHandler
  loading: boolean
  fields: string[]
  errors: Error[]
}

let runPending: Promise<void> | null = null
let params = {} as Record<string, any>
let queries = [] as QueryNode[]

function registerQuery (name: string, contents: string) {
  queries = queries.filter(q => q.name !== name)
  queries.push({name, contents, loading: false, fields: [], errors: []})
}

function updateParam (name: string, value: any) {
  params[name] = value
  runAll() // for now, do the easy thing and reload it all
}

function query (source: string, fields: string[], callback: ResultHandler) {
  let contents = `from ${source} select ${fields.join(', ')}`
  queries.push({contents, callback, loading: false, fields, errors: []})
  runAll()
}

function unsubscribe (callback: ResultHandler) {
  queries = queries.filter(q => q.callback !== callback)
}

async function runNode (n: QueryNode) {
  if (!n.callback) throw new Error('running node nobody is listening to')
  n.callback({}) // notify that the query is loading
  n.loading = true
  n.errors = []

  let hashes = await getHashes()
  let tables = queries.filter(q => q.name)
  let gsql = [
    ...tables.map(q => `table ${q.name} as (${q.contents})`),
    n.contents,
  ].join('\n')

  try {
    let response = await fetch('/graphene/query', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({params, gsql, hashes}),
    })
    let hash = response.headers.get('ETag') || ''

    if (response.status == 304) { // cache hit. Read it out and use that
      let body = await cacheRead(hash)
      n.callback(translateData(body, n))
    } else if (response.ok) { // cache miss. write it to the cache, and return the data
      cacheWrite(hash, response.clone()) // clone allows us to write the raw response into the cache
      let body = await response.json()
      n.callback(translateData(body, n)) // nb that translateData modifies in place for performance
    } else { // request failed. Record it
      let isJson = response.headers.get('Content-Type') === 'application/json'
      let body = isJson ? await response.json() : await response.text()
      n.errors = Array.isArray(body) ? body : [body]
      n.callback({errors: n.errors})
    }
  } catch (e) {
    n.errors = [e]
  } finally {
    n.loading = false
  }
}

function runAll () {
  if (runPending) return runPending
  runPending = Promise.resolve().then(_runAll).finally(() => runPending = null)
}

async function _runAll () {
  await Promise.all(queries.map(async n => {
    if (!n.callback) return
    await runNode(n)
  }))
}

function translateData (data: any, node: QueryNode) {
  let rows = data.rows || []
  rows.dataLoaded = true // evidence components need this to be set
  rows._evidenceColumnTypes = []

  data.fields.forEach((field, index) => {
    let name = field.name

    // server gives names like `col_1` to unnamed expressions but we translate it back into the original expression like `avg(price)`
    if (field.name.match(/col_\d+/)) {
      name = node.fields[index]
      rows.forEach(r => {
        r[name] = r[field.name]
        delete r[field.name]
      })
    }

    // map graphene types down to the ones evidence expects
    rows._evidenceColumnTypes.push({name, evidenceType: evidenceType(field.type)})
  })

  // translates dates back into js Date. Do we need this? Or does evidence prefer to get dates as strings?
  rows.forEach(row => {
    Object.keys(row).forEach(key => {
      if (typeof row[key] === 'object' && row[key] && row[key].value) {
        row[key] = new Date(row[key].value)
      }
    })
  })

  return {rows}
}

export const isLoading = () => !!queries.find(q => q.loading)

errorProvider('queryEngine', () => {
  let unique = {}
  queries.flatMap(q => q.errors).filter(q => !!q).forEach(e => {
    unique[e.message + String((e as any).from?.lineText)] = e
  })
  return Object.values(unique)
})

async function waitForQueries (timeout = 20_000) {
  let end = performance.now() + timeout
  while (isLoading() && performance.now() < end) {
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  return !isLoading()
}

function evidenceType (type: string | undefined) {
  if (type === 'string') return 'string'
  if (type === 'number') return 'number'
  if (type === 'boolean') return 'boolean'
  if (type ===  'date' || type === 'timestamp') return 'date'
  console.warn('Unsupported evidence type ' + type)
  return 'string'
}

Object.assign(window.$GRAPHENE, {
  registerQuery,
  updateParam,
  query,
  unsubscribe,
  waitForQueries,
})
