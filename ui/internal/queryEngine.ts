// The query engine gathers query requests and inputs from components, and issues requests to the server.
// When inputs change, it takes care of notifying affected components and requesting new data.

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
}

let runPending: Promise<void> | null = null
let params = {} as Record<string, any>
let queries = [] as QueryNode[]

function registerQuery (name: string, contents: string) {
  queries = queries.filter(q => q.name !== name)
  queries.push({name, contents, loading: false})
}

function updateParam (name: string, value: any) {
  params[name] = value
  runAll() // for now, do the easy thing and reload it all
}

function query (source: string, columns: string[], callback: ResultHandler) {
  let contents = `from ${source} select ${columns.join(', ')}`
  queries.push({contents, callback, loading: false})
  runAll()
}

function unsubscribe (callback: ResultHandler) {
  queries = queries.filter(q => q.callback !== callback)
}

async function runNode (n: QueryNode) {
  if (!n.callback) throw new Error('running node nobody is listening to')
  n.callback({}) // notify that the query is loading
  n.loading = true

  let tables = queries.filter(q => q.name)
  let gsql = [
    ...tables.map(q => `table ${q.name} as (${q.contents})`),
    n.contents,
  ].join('\n')

  let response = await fetch('/graphene/query', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({params, gsql}),
  })
  let isJson = response.headers.get('Content-Type') === 'application/json'
  let body = isJson ? await response.json() : await response.text()

  if (response.ok) {
    n.callback({rows: translateData(body)})
  } else {
    let errors = Array.isArray(body) ? body : [body]
    n.callback({error: new Error(errors[0].message || 'Query error')})
  }
  n.loading = false
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

function translateData (data: any[]) {
  (data as any).dataLoaded = true // evidence components need this to be set
  data.forEach(row => {
    Object.keys(row).forEach(key => {
      if (typeof row[key] === 'object' && row[key] && row[key].value) {
        row[key] = new Date(row[key].value)
      }
    })
  })
  return data
}

export function isLoading () {
  return !!queries.find(q => q.loading)
}

window.$GRAPHENE = {registerQuery, updateParam, query, unsubscribe}
