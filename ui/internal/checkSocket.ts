// WebSocket connection for the `graphene check` command.
// Listens for check requests, waits for queries to finish, captures screenshots, and reports errors.

import {getErrors} from './telemetry.ts'
import {isLoading} from './queryEngine.ts'

let socket: WebSocket | null = null
connect()

function captureChart (chartTitle: string) {
  let escaped = window.CSS.escape(chartTitle)
  let canvas = document.querySelector(`[data-chart-title="${escaped}"] canvas`) as HTMLCanvasElement | null
  return canvas?.toDataURL('image/png')
}

async function takeScreenshot () {
  if (!(window as any).html2canvas) {
    let html2canvas = await import('@graphenedata/html2canvas')
    ;(window as any).html2canvas = html2canvas.default
  }
  let canvas = await (window as any).html2canvas(document.body, {useCORS: true, allowTaint: true, scale: 1, liveDOM: true})
  return canvas?.toDataURL('image/png')
}

async function waitForQueriesToFinish () {
  let startTime = Date.now()
  while (isLoading() && Date.now() - startTime < 20_000) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

function connect () {
  let wsUrl = `ws://${window.location.host}/_api/ws`
  socket = new WebSocket(wsUrl)
  socket.onclose = () => setTimeout(connect, 2000)
  socket.onopen = () => socket!.send(JSON.stringify({type: 'register', url: window.location.href}))

  socket.onmessage = async (event) => {
    let {type, requestId, chart} = JSON.parse(event.data)
    if (type !== 'check') return

    await waitForQueriesToFinish()
    let errors = getErrors().map((e: any) => ({type: e.type, message: e.message, id: e.id, file: e.file, line: e.loc?.line, frame: e.frame, from: e.from, to: e.to}))
    let stillLoading = isLoading()
    let screenshot = chart ? captureChart(chart) : await takeScreenshot()
    socket!.send(JSON.stringify({type: 'checkResponse', requestId, errors, stillLoading, screenshot}))
  }
}
