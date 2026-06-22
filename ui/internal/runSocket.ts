// WebSocket connection for the `graphene run` command.
// Listens for run requests, waits for queries to finish, captures screenshots, and reports errors.

let socket: WebSocket | null = null
if (window.top === window) connect()

async function captureComponent(component: string) {
  return await window.$GRAPHENE.captureComponent?.(component)
}

async function exportChartCsv(chart: string) {
  return await window.$GRAPHENE.exportChartCsv?.(chart)
}

async function listComponentIds() {
  return (await window.$GRAPHENE.listComponentIds?.()) || []
}

async function takeScreenshot() {
  return await window.$GRAPHENE.capturePage?.()
}

function connect() {
  let wsUrl = `ws://${window.location.host}/_api/ws`
  socket = new WebSocket(wsUrl)
  socket.onclose = () => setTimeout(connect, 2000)
  socket.onopen = () => socket!.send(JSON.stringify({type: 'register', url: window.location.href}))

  socket.onmessage = async event => {
    let {requestId, action, chart, format} = JSON.parse(event.data)
    let finished = await window.$GRAPHENE.waitForLoad(20_000)

    if (action === 'list') {
      socket!.send(JSON.stringify({type: 'checkResponse', requestId, componentIds: await listComponentIds()}))
      return
    }

    if (format === 'csv') {
      socket!.send(JSON.stringify({type: 'checkResponse', requestId, csv: chart ? await exportChartCsv(chart) : undefined, stillLoading: !finished}))
      return
    }

    let screenshot = chart ? await captureComponent(chart) : await takeScreenshot()
    let errors = (await window.$GRAPHENE.getErrors?.()) || []
    socket!.send(JSON.stringify({type: 'checkResponse', requestId, errors, stillLoading: !finished, screenshot}))
  }
}
