type BridgeEnvelope = {
  protocol: 'graphene-frame'
  id?: string
  type: string
  payload?: any
  ok?: boolean
  error?: any
}

type BridgeHandler = (payload: any) => any

const BRIDGE_PROTOCOL = 'graphene-frame'

function isEnvelope(value: any): value is BridgeEnvelope {
  return value?.protocol === BRIDGE_PROTOCOL && typeof value.type == 'string'
}

function envelope(type: string, payload?: any, extra: Partial<BridgeEnvelope> = {}): BridgeEnvelope {
  return {protocol: BRIDGE_PROTOCOL, type, payload, ...extra}
}

function bridgeError(error: unknown) {
  if (!(error instanceof Error)) return {message: String(error)}
  return sanitizePayload({...error, message: error.message, stack: error.stack})
}

function restoreError(error: any) {
  let restored = new Error(error?.message || 'Frame request failed')
  if (error && typeof error == 'object') Object.assign(restored, error)
  return restored
}

export class GrapheneFrameParent {
  private nextId = 0
  private pending = new Map<string, {resolve: (value: any) => void; reject: (error: Error) => void}>()
  private handlers = new Map<string, BridgeHandler>()

  constructor(private frame: HTMLIFrameElement) {
    window.addEventListener('message', this.onMessage)
  }

  destroy() {
    window.removeEventListener('message', this.onMessage)
    this.pending.forEach(({reject}) => reject(new Error('Frame bridge was destroyed')))
    this.pending.clear()
  }

  on(type: string, handler: BridgeHandler) {
    this.handlers.set(type, handler)
  }

  notify(type: string, payload?: any) {
    this.post(envelope(type, payload))
  }

  request(type: string, payload?: any, timeout = 20_000): Promise<any> {
    let id = `parent:${++this.nextId}`
    this.post(envelope(type, payload, {id}))
    return new Promise((resolve, reject) => {
      let timer = window.setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timed out waiting for frame response: ${type}`))
      }, timeout)
      this.pending.set(id, {
        resolve: value => {
          window.clearTimeout(timer)
          resolve(value)
        },
        reject: error => {
          window.clearTimeout(timer)
          reject(error)
        },
      })
    })
  }

  private post(envelope: BridgeEnvelope) {
    this.frame.contentWindow?.postMessage(sanitizePayload(envelope), '*')
  }

  private onMessage = async (event: MessageEvent) => {
    if (event.source !== this.frame.contentWindow) return
    if (!isEnvelope(event.data)) return

    let envelope = event.data
    if (envelope.id && typeof envelope.ok == 'boolean') {
      let pending = this.pending.get(envelope.id)
      if (!pending) return
      this.pending.delete(envelope.id)
      if (envelope.ok) pending.resolve(envelope.payload)
      else pending.reject(restoreError(envelope.error))
      return
    }

    let handler = this.handlers.get(envelope.type)
    if (!handler) return

    if (!envelope.id) {
      await handler(envelope.payload)
      return
    }

    try {
      let payload = await handler(envelope.payload)
      this.post(envelopeResponse(envelope, true, payload))
    } catch (error) {
      this.post(envelopeResponse(envelope, false, undefined, bridgeError(error)))
    }
  }
}

export class GrapheneFrameChild {
  private nextId = 0
  private pending = new Map<string, {resolve: (value: any) => void; reject: (error: Error) => void}>()
  private handlers = new Map<string, BridgeHandler>()

  constructor(private parentOrigin: string) {
    window.addEventListener('message', this.onMessage)
  }

  on(type: string, handler: BridgeHandler) {
    this.handlers.set(type, handler)
  }

  notify(type: string, payload?: any) {
    window.parent.postMessage(sanitizePayload(envelope(type, payload)), this.parentOrigin)
  }

  request(type: string, payload?: any, timeout = 20_000): Promise<any> {
    let id = `child:${++this.nextId}`
    window.parent.postMessage(sanitizePayload(envelope(type, payload, {id})), this.parentOrigin)
    return new Promise((resolve, reject) => {
      let timer = window.setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timed out waiting for parent response: ${type}`))
      }, timeout)
      this.pending.set(id, {
        resolve: value => {
          window.clearTimeout(timer)
          resolve(value)
        },
        reject: error => {
          window.clearTimeout(timer)
          reject(error)
        },
      })
    })
  }

  private onMessage = async (event: MessageEvent) => {
    if (event.source !== window.parent || event.origin !== this.parentOrigin) return
    if (!isEnvelope(event.data)) return

    let envelope = event.data
    if (envelope.id && typeof envelope.ok == 'boolean') {
      let pending = this.pending.get(envelope.id)
      if (!pending) return
      this.pending.delete(envelope.id)
      if (envelope.ok) pending.resolve(envelope.payload)
      else pending.reject(restoreError(envelope.error))
      return
    }

    let handler = this.handlers.get(envelope.type)
    if (!handler) return

    if (!envelope.id) {
      await handler(envelope.payload)
      return
    }

    try {
      let payload = await handler(envelope.payload)
      window.parent.postMessage(sanitizePayload(envelopeResponse(envelope, true, payload)), this.parentOrigin)
    } catch (error) {
      window.parent.postMessage(sanitizePayload(envelopeResponse(envelope, false, undefined, bridgeError(error))), this.parentOrigin)
    }
  }
}

function envelopeResponse(request: BridgeEnvelope, ok: boolean, payload?: any, error?: any): BridgeEnvelope {
  return envelope(request.type, payload, {id: request.id, ok, error})
}

function sanitizePayload(value: any, seen = new WeakSet<object>()): any {
  if (value == null || typeof value == 'string' || typeof value == 'number' || typeof value == 'boolean') return value
  if (typeof value == 'bigint') return Number(value)
  if (typeof value == 'function' || typeof value == 'symbol') return undefined
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return bridgeError(value)
  if (typeof value != 'object') return String(value)
  if (seen.has(value)) return undefined
  seen.add(value)
  if (Array.isArray(value)) return value.map(item => sanitizePayload(item, seen))
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => {
      let sanitized = sanitizePayload(child, seen)
      return sanitized === undefined ? [] : [[key, sanitized]]
    }),
  )
}
