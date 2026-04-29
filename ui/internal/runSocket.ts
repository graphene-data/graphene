// WebSocket connection for the `graphene run` command.
// Listens for run requests, waits for queries to finish, captures screenshots, and reports errors.

import {getDiagnostics, getErrors} from './telemetry.ts'

let socket: WebSocket | null = null
connect()

// html2canvas is dynamically loaded so we don't include it on pages that don't need it.
let html2canvas: any
async function loadHtml2Canvas() {
  html2canvas ||= (await import('@graphenedata/html2canvas'))?.default
}

async function captureChart(chartTitle: string) {
  let escaped = window.CSS.escape(chartTitle)
  let chartEl = document.querySelector(`[data-chart-title="${escaped}"]`) as HTMLElement | null
  if (!chartEl) return undefined

  await loadHtml2Canvas()
  let canvas = await html2canvas(chartEl, {useCORS: true, allowTaint: true, scale: 1, liveDOM: true})
  return canvas?.toDataURL('image/png')
}

async function takeScreenshot() {
  await loadHtml2Canvas()
  let canvas = await html2canvas(document.body, {useCORS: true, allowTaint: true, scale: 1, liveDOM: true})
  return canvas?.toDataURL('image/png')
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
    let screenshot = chart ? await captureChart(chart) : await takeScreenshot()
    socket!.send(JSON.stringify({type: 'checkResponse', requestId, diagnostics: getDiagnostics(), errors: getErrors(), stillLoading: !finished, screenshot}))
  }
}
