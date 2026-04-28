// WebSocket connection for the `graphene run` command.
// Listens for run requests, waits for queries to finish, captures screenshots, and reports errors.

import {getErrors} from './telemetry.ts'

let socket: WebSocket | null = null
connect()

// html2canvas is dynamically loaded so we don't include it on pages that don't need it.
let html2canvas: any
async function loadHtml2Canvas() {
  html2canvas ||= (await import('@graphenedata/html2canvas'))?.default
}

async function captureChart(chart: string) {
  let escaped = window.CSS.escape(chart)
  let chartEl = document.querySelector(`[data-chart-title="${escaped}"]`) as HTMLElement | null
  chartEl ||= document.querySelector(`[data-query-id="${escaped}"]`) as HTMLElement | null
  if (!chartEl) return undefined

  await loadHtml2Canvas()
  let canvas = await html2canvas(chartEl, {useCORS: true, allowTaint: true, scale: 1, liveDOM: true})
  return canvas?.toDataURL('image/png')
}

function listQueryIds() {
  return Array.from(document.querySelectorAll('[data-query-id]'))
    .map(el => el.getAttribute('data-query-id') || '')
    .filter(queryId => queryId.trim().length > 0)
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
    let {type, requestId, action, chart} = JSON.parse(event.data)
    if (type !== 'check') return

    if (action === 'list') {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      socket!.send(JSON.stringify({type: 'checkResponse', requestId, queryIds: listQueryIds()}))
      return
    }

    let finished = await window.$GRAPHENE.waitForLoad(20_000)
    let screenshot = chart ? await captureChart(chart) : await takeScreenshot()
    socket!.send(JSON.stringify({type: 'checkResponse', requestId, errors: getErrors(), stillLoading: !finished, screenshot}))
  }
}
