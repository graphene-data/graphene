// WebSocket connection for the `graphene run` command.
// Listens for run requests, waits for queries to finish, captures screenshots, and reports errors.

import {getErrors} from './telemetry.ts'

let socket: WebSocket | null = null
connect()

function captureChart(chartTitle: string) {
  let escaped = window.CSS.escape(chartTitle)
  let canvas = document.querySelector(`[data-chart-title="${escaped}"] canvas`) as HTMLCanvasElement | null
  return canvas?.toDataURL('image/png')
}

async function takeScreenshot() {
  if (!(window as any).html2canvas) {
    let html2canvas = await import('@graphenedata/html2canvas')
    ;(window as any).html2canvas = html2canvas.default
  }
  let canvas = await (window as any).html2canvas(document.body, {useCORS: true, allowTaint: true, scale: 1, liveDOM: true})
  return canvas?.toDataURL('image/png')
}

async function waitForStableFrame() {
  // Ensure web fonts and chart resize/debounce work have settled before html2canvas rasterizes text.
  if (document.fonts?.ready) await document.fonts.ready
  await new Promise(r => setTimeout(r, 300))
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
}

function connect() {
  let wsUrl = `ws://${window.location.host}/_api/ws`
  socket = new WebSocket(wsUrl)
  socket.onclose = () => setTimeout(connect, 2000)
  socket.onopen = () => socket!.send(JSON.stringify({type: 'register', url: window.location.href}))

  socket.onmessage = async event => {
    let {type, requestId, chart} = JSON.parse(event.data)
    if (type !== 'check') return

    let finished = await window.$GRAPHENE.waitForLoad(20_000)
    await waitForStableFrame()
    let errors = getErrors().map((e: any) => ({type: e.type, message: e.message, queryId: e.queryId, file: e.file, line: e.loc?.line, frame: e.frame, from: e.from, to: e.to}))
    let screenshot = chart ? captureChart(chart) : await takeScreenshot()
    socket!.send(JSON.stringify({type: 'checkResponse', requestId, errors, stillLoading: !finished, screenshot}))
  }
}
