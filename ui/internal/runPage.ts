// Page-side implementation and typed contract for `graphene run` requests.
// Open-browser runs reach runPageRequest through this file's WebSocket, while headless runs call
// it through Playwright. Keeping the behavior here ensures both modes load, capture, and export identically.

import type {Options as Html2CanvasOptions} from '@graphenedata/html2canvas'

import type {Field, GrapheneError} from '../../lang/index.d.ts'

import {getErrors} from './telemetry.ts'

export interface SocketRegistration {
  type: 'register'
  url: string
}

export interface PageRequest {
  requestId?: string
  chart?: string
  params?: Record<string, string | string[]>
}

export interface PageResponse {
  requestId?: string
  errors?: GrapheneError[]
  stillLoading?: boolean
  screenshot?: string
  componentIds?: string[]
  data?: {
    rows: Record<string, unknown>[]
    fields: Field[]
  }
}

type Html2Canvas = (element: HTMLElement, options?: Partial<Html2CanvasOptions>) => Promise<HTMLCanvasElement>

let html2canvas: Html2Canvas | undefined
let socket: WebSocket | null = null
window.$GRAPHENE.runPageRequest = runPageRequest
connect()

// Waits for a stable page and executes the requested check, listing, or data export.
export async function runPageRequest(request: PageRequest): Promise<PageResponse> {
  let finished = await window.$GRAPHENE.waitForLoad(20_000)
  let errors = getErrors()

  // --chart tells us to focus on a single viz
  let componentEl = request.chart ? findVisualComponentElement(request.chart) : undefined
  if (request.chart && !componentEl) errors.push({message: `Could not find chart "${request.chart}"`})

  let capture = await loadHtml2Canvas()
  let canvas = await capture(componentEl || document.body, {useCORS: true, allowTaint: true, scale: 1, useLiveDOM: true})
  let screenshot = canvas?.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')

  let componentId = componentEl?.getAttribute('data-component-id') || ''
  let data = window.$GRAPHENE.chartExports?.[componentId]

  // get a list of all component ids for `graphene list`
  let componentIds = Array.from(document.querySelectorAll('[data-component-id]'))
    .map(el => el.getAttribute('data-component-id') || '')
    .filter(componentId => componentId.trim().length > 0)

  return {requestId: request.requestId, errors, stillLoading: !finished, screenshot, componentIds, data}
}

// Registers this tab with the local server and forwards CLI requests to runPageRequest.
function connect() {
  let wsUrl = `ws://${window.location.host}/_api/ws`
  socket = new WebSocket(wsUrl)
  socket.onclose = () => setTimeout(connect, 2000)
  socket.onopen = () => socket!.send(JSON.stringify({type: 'register', url: window.location.href}))

  socket.onmessage = async event => {
    let message = JSON.parse(event.data) as PageRequest
    try {
      let response = await runPageRequest(message)
      socket!.send(JSON.stringify(response))
    } catch (err) {
      let error = err instanceof Error ? err.message : String(err)
      socket!.send(JSON.stringify({requestId: message.requestId, errors: [{message: error}]} satisfies PageResponse))
    }
  }
}

// Loads screenshot code only when the CLI requests a screenshot.
async function loadHtml2Canvas() {
  html2canvas ||= (await import('@graphenedata/html2canvas')).default as unknown as Html2Canvas
  return html2canvas
}

// Resolves the user-facing title and stable component ID forms accepted by `--chart`.
function findVisualComponentElement(component: string) {
  let escaped = window.CSS.escape(component)
  let componentEl = document.querySelector(`[data-chart-title="${escaped}"]`) as HTMLElement | null
  componentEl ||= document.querySelector(`[data-component-title="${escaped}"]`) as HTMLElement | null
  componentEl ||= document.querySelector(`[data-component-id="${escaped}"]`) as HTMLElement | null
  return componentEl
}
