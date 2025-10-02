// The query engine gathers query requests and inputs from components, and issues requests to the server.
// When inputs change, it takes care of notifying affected components and requesting new data.

import {cacheRead, cacheWrite, getHashes} from './clientCache'

interface QueryResult {
  rows?: any[]
  error?: any
}

type ResultHandler = (res: QueryResult) => void

interface QueryNode {
  name?: string
  contents: string
  callback?: ResultHandler
  loading: boolean
  fields: string[]
  error?: Error
}

let runPending: Promise<void> | null = null
let params = {} as Record<string, any>
let queries = [] as QueryNode[]

function registerQuery (name: string, contents: string) {
  queries = queries.filter(q => q.name !== name)
  queries.push({name, contents, loading: false, fields: []})
}

function updateParam (name: string, value: any) {
  params[name] = value
  runAll() // for now, do the easy thing and reload it all
}

function query (source: string, fields: string[], callback: ResultHandler) {
  let contents = `from ${source} select ${fields.join(', ')}`
  queries.push({contents, callback, loading: false, fields})
  runAll()
}

function unsubscribe (callback: ResultHandler) {
  queries = queries.filter(q => q.callback !== callback)
}

async function runNode (n: QueryNode) {
  if (!n.callback) throw new Error('running node nobody is listening to')
  n.callback({}) // notify that the query is loading
  n.loading = true
  n.error = undefined

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

    if (response.status == 304) {
      let body = await cacheRead(hash)
      n.callback(translateData(body, n))
    } else if (response.ok) {
      let body = await response.json()
      cacheWrite(hash, body)
      n.callback(translateData(body, n))
    } else {
      let isJson = response.headers.get('Content-Type') === 'application/json'
      let body = isJson ? await response.json() : await response.text()
      let errors = Array.isArray(body) ? body : [body]
      let err = new Error(errors[0].message || 'Query error')
      n.error = err
      n.callback({error: err})
    }
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

  // translates the executed col names (like `col_3`) back into the expression (like `avg(price)`)
  Object.keys(rows[0] || {}).forEach(k => {
    let match = k.match(/^col_(\d+)$/)
    if (match) {
      let actual = node.fields[parseInt(match[1])]
      rows.forEach(r => {
        r[actual] = r[k]
        delete r[k]
      })
    }
  })

  // translates dates back into js Date
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
export const getErrors = () => queries.map(q => q.error).filter(q => !!q)

async function waitForQueries (timeout = 20_000) {
  let end = performance.now() + timeout
  while (isLoading() && performance.now() < end) {
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  return !isLoading()
}

window.$GRAPHENE = {
  registerQuery,
  updateParam,
  query,
  unsubscribe,
  waitForQueries,
  getErrors,
}
