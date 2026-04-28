import fs from 'fs-extra'
import {type IncomingMessage, type ServerResponse} from 'http'
import {styleText} from 'node:util'
import os from 'os'
import path from 'path'
import {type PluginOption, type ViteDevServer} from 'vite'
import {WebSocketServer, type WebSocket} from 'ws'

import type {GrapheneError} from '../lang/index.d.ts'

import {config} from '../lang/config.ts'
import {pollFor} from '../lang/util.ts'
import {openInBrowser} from './auth.ts'
import {isServerRunning, runServeInBackground} from './background.ts'
import {printDiagnostics} from './printer.ts'
import {type CliTelemetry} from './telemetry/index.ts'

export interface RunMdFileOptions {
  mdArg: string
  chart?: string
  log?: (...args: any[]) => void
  telemetry?: CliTelemetry
}

let browserConnections: {url: string; socket: WebSocket}[] = []
let pendingRequests: Record<string, {response: ServerResponse<IncomingMessage>}> = {}

export async function runMdFile(options: RunMdFileOptions): Promise<boolean> {
  let log = options.log || console.log
  let mdFile = options.mdArg
  let resp = await sendSocketRequest({mdFile, action: 'check', chart: options.chart, log})
  if (!resp) return false

  let errors = Array.from(resp.errors || []) as GrapheneError[]
  let chartNotFound = !!options.chart && !resp.screenshot
  if (chartNotFound) log(`Could not find chart "${options.chart}" on ${mdFile}`)

  if (errors.length) {
    log(styleText('red', 'Runtime errors') + ` in ${mdFile}:`)
    errors.forEach((e: GrapheneError) => {
      if (e.file || e.frame) printDiagnostics([e], log)
      else if (e.queryId) log(`Query (${e.queryId}): ${e.message}`)
      else log(e.message)
    })
  } else if (!chartNotFound) {
    log('No errors found 💎')
  }

  if (resp?.stillLoading) {
    log('Warning: Queries were still loading when the screenshot was taken')
  }

  if (resp?.screenshot) {
    let filename = `graphene-screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
    let screenshotPath = path.join(os.tmpdir(), filename)
    let base64Data = resp.screenshot.replace(/^data:image\/png;base64,/, '')
    await fs.writeFile(screenshotPath, base64Data, 'base64')
    log('Screenshot saved to', screenshotPath)
  }

  return errors.length == 0 && !chartNotFound
}

export async function listMdFileQueries(mdFile: string, _telemetry?: CliTelemetry, log: (...args: any[]) => void = console.log): Promise<boolean> {
  let resp = await sendSocketRequest({mdFile, action: 'list', log})
  if (!resp) return false

  let queryIds = (resp.queryIds || []) as string[]
  if (!queryIds.length) log('No chart queries found')
  else queryIds.forEach(queryId => log(queryId))
  return true
}

async function sendSocketRequest({mdFile, action, chart, log}: {mdFile: string; action: 'check' | 'list'; chart?: string; log: (...args: any[]) => void}) {
  let pageUrl = '/' + mdFile.replace(/\.md$/, '').replace(/^\//, '').replace(/\\/g, '/')
  if (pageUrl === '/index') pageUrl = '/'

  if (process.env.NODE_ENV !== 'test' && !(await isServerRunning())) {
    log('Starting Graphene server...')
    await runServeInBackground()
  }

  let host = `http://localhost:${config.port}`
  let resp = await fetchSocketRequest({host, pageUrl, action, chart})

  if (resp.error == 'no_server') {
    log('Failed to start Graphene server')
    return null
  }

  if (resp.error == 'no_tab' && process.env.NODE_ENV !== 'test') {
    log(`Opening page ${host}${pageUrl}`)
    openInBrowser(host + pageUrl)
    await new Promise(resolve => setTimeout(resolve, 500))
    resp = await fetchSocketRequest({host, pageUrl, action, chart})
  }

  if (resp.error == 'no_tab') {
    log('Failed to open a new tab')
    return null
  }

  if (resp.error) {
    log(`Failed to ${action == 'check' ? 'run check' : 'list queries'}: ${resp.error}`)
    return null
  }

  return resp
}

async function fetchSocketRequest({host, pageUrl, action, chart}: {host: string; pageUrl: string; action: 'check' | 'list'; chart?: string}) {
  let abort = new AbortController()
  let timeout = setTimeout(() => abort.abort(), 30_000)
  let browserHost = host.replace('127.0.0.1', 'localhost')
  try {
    let response = await fetch(`${host}/_api/check`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pageUrl: browserHost + pageUrl, action, chart}),
      signal: abort.signal,
    })
    clearTimeout(timeout)

    let body = response.headers.get('content-type') == 'application/json' ? await response.json() : {error: await response.text()}

    if (!response.ok) {
      if (body.error) return {error: body.error}
      console.error(`Unexpected response: ${JSON.stringify(body)}`)
      return {error: 'Unexpected response from Graphene server'}
    }

    return body
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') return {error: 'timeout'}
    return {error: 'no_server'}
  }
}

export async function proxyRunRequest(req: IncomingMessage, res: ServerResponse<IncomingMessage>): Promise<void> {
  let chunks = [] as any[]
  for await (let chunk of req) chunks.push(chunk)
  let {pageUrl, action, chart} = JSON.parse(Buffer.concat(chunks).toString())
  let id = Math.random().toString(36).slice(2)
  res.setHeader('Content-Type', 'application/json')

  let normalizedPageUrl = pageUrl.replace(/\/$/, '')
  let conn = await pollFor(() => browserConnections.find(conn => conn.url === normalizedPageUrl), 5000, 100)
  if (!conn) {
    res.statusCode = 400
    res.end(JSON.stringify({error: 'no_tab'}))
    return
  }

  conn.socket.send(JSON.stringify({type: 'check', action, chart, requestId: id}))
  pendingRequests[id] = {response: res}
}

export function runVitePlugin(): PluginOption {
  return {
    name: 'graphene-check-plugin',
    configureServer(server: ViteDevServer) {
      let wss = new WebSocketServer({noServer: true})

      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (!req.url || (!req.url.includes('/_api/ws') && !req.url.includes('graphene-ws'))) return
        wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req))
      })

      wss.on('connection', socket => {
        socket.on('message', data => {
          let message = JSON.parse(data.toString())
          if (message.type === 'register') {
            let normalizedUrl = message.url.replace(/\/$/, '')
            browserConnections.push({url: normalizedUrl, socket})
          }
          if (message.type === 'checkResponse') {
            pendingRequests[message.requestId].response.end(JSON.stringify(message))
            delete pendingRequests[message.requestId]
          }
        })
        socket.on('close', () => {
          browserConnections = browserConnections.filter(conn => conn.socket !== socket)
        })
      })

      server.httpServer?.on('close', () => wss.close())

      server.middlewares.use(async (req, res, next) => {
        let [pathName] = (req.url || '').split('?')
        if (pathName === '/_api/check') await proxyRunRequest(req, res)
        else next()
      })
    },
  }
}
