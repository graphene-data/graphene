import './app.css'

let socket = null
let errors = []

window.addEventListener('error', (event) => errors.push(event.error))
window.addEventListener('unhandledrejection', (event) => errors.push(event.reason))
connectWebSocket()

window.$GRAPHENE = {
  queries: {},
  loadingQueries: new Set(),
  get errors () { return errors },

  registerQuery (queryName, code) {
    this.queries[queryName] = code
  },

  async query (queryName) {
    if (!queryName) throw new Error('Query name is required')
    let gsql = this.queries[queryName]
    if (!gsql) throw new Error(`Query ${queryName} not found`)

    this.loadingQueries.add(queryName)
    try {
      let rows = await gFetch('/graphene/query', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({queryName, gsql}),
      })

      // parse dates
      rows.forEach(row => {
        Object.keys(row).forEach(key => {
          if (typeof row[key] === 'object' && row[key] && row[key].value) {
            row[key] = new Date(row[key].value)
          }
        })
      })

      return rows
    } catch (error) {
      throw new Error(`Query ${queryName} failed`, {cause: error.cause})
    } finally {
      this.loadingQueries.delete(queryName)
    }
  },

  async waitForQueries (timeout = 20000) {
    let startTime = Date.now()
    while (this.loadingQueries.size > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return this.loadingQueries.size > 0
  },

  async takeScreenshot (chartName = null) {
    if (!window.html2canvas) {
      let html2canvas = await import('html2canvas')
      window.html2canvas = html2canvas.default
    }

    let stillLoading = await this.waitForQueries(20000)
    let targetElement = chartName ? document.querySelector(`[name="${chartName}"]`) : document.body
    let canvas = targetElement && await window.html2canvas(targetElement, {useCORS: true, allowTaint: true, scale: 1})
    return {stillLoading, screenshot: canvas?.toDataURL('image/png')}
  },
}

function connectWebSocket () {
  socket = new WebSocket(`ws://${window.location.host}/graphene-ws`)
  socket.onclose = () => setTimeout(connectWebSocket, 2000)

  socket.onopen = () => {
    socket.send(JSON.stringify({type: 'register', url: window.location.href}))
  }

  socket.onmessage = async (event) => {
    console.log('Got message', event.data)
    let {type, requestId, chart} = JSON.parse(event.data)

    if (type === 'view') {
      let {screenshot, stillLoading} = await window.$GRAPHENE.takeScreenshot(chart)
      let serialErrs = errors.map(e => ({message: e.message, cause: e.cause}))
      socket.send(JSON.stringify({type: 'viewResponse', requestId, screenshot, stillLoading, errors: serialErrs}))
    }
  }
}

async function gFetch (url, options) {
  let response = await fetch(url, options)
  let isJson = response.headers.get('Content-Type') === 'application/json'

  if (!response.ok) {
    let cause = isJson ? await response.json() : await response.text()
    throw new Error('Fetch failed', {cause})
  }
  return isJson ? await response.json() : await response.text()
}
