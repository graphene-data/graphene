// WebSocket connection for the `graphene run` command.
// Listens for run requests, waits for queries to finish, captures screenshots, and reports errors.

import {rowsToCsv} from '../../lang/csv.ts'
import {getErrors} from './telemetry.ts'

let socket: WebSocket | null = null
connect()

// html2canvas is dynamically loaded so we don't include it on pages that don't need it.
let html2canvas: any
async function loadHtml2Canvas() {
  html2canvas ||= (await import('@graphenedata/html2canvas'))?.default
}

async function captureComponent(component: string) {
  let componentEl = findVisualComponentElement(component)
  if (!componentEl) return undefined

  await loadHtml2Canvas()
  let canvas = await html2canvas(componentEl, {useCORS: true, allowTaint: true, scale: 1, liveDOM: true})
  return canvas?.toDataURL('image/png')
}

function exportChartCsv(chart: string) {
  let componentEl = findVisualComponentElement(chart)
  let componentId = componentEl?.getAttribute('data-component-id') || ''
  let data = componentId ? window.$GRAPHENE.chartExports?.[componentId] : undefined
  if (!data) return undefined
  return rowsToCsv(data.rows || [], data.fields || [])
}

function findVisualComponentElement(component: string) {
  let escaped = window.CSS.escape(component)
  let componentEl = document.querySelector(`[data-chart-title="${escaped}"]`) as HTMLElement | null
  componentEl ||= document.querySelector(`[data-component-title="${escaped}"]`) as HTMLElement | null
  componentEl ||= document.querySelector(`[data-component-id="${escaped}"]`) as HTMLElement | null
  return componentEl
}

function listComponentIds() {
  return Array.from(document.querySelectorAll('[data-component-id]'))
    .map(el => el.getAttribute('data-component-id') || '')
    .filter(componentId => componentId.trim().length > 0)
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
    let {requestId, action, chart, format} = JSON.parse(event.data)
    let finished = await window.$GRAPHENE.waitForLoad(20_000)

    if (action === 'list') {
      socket!.send(JSON.stringify({type: 'checkResponse', requestId, componentIds: listComponentIds()}))
      return
    }

    if (format === 'csv') {
      socket!.send(JSON.stringify({type: 'checkResponse', requestId, csv: chart ? exportChartCsv(chart) : undefined, stillLoading: !finished}))
      return
    }

    let screenshot = chart ? await captureComponent(chart) : await takeScreenshot()
    socket!.send(JSON.stringify({type: 'checkResponse', requestId, errors: getErrors(), stillLoading: !finished, screenshot}))
  }
}

window.$GRAPHENE.exportChartCsv = exportChartCsv
