import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import {spawn} from 'child_process'
import {type IncomingMessage, type ServerResponse} from 'http'
import {WebSocketServer, type WebSocket} from 'ws'
import {type PluginOption, type ViteDevServer} from 'vite'

import {analyze, clearWorkspace, config, type Diagnostic, getDiagnostics, loadWorkspace, updateFile} from '../lang/core.ts'
import {printDiagnostics} from './printer.ts'
import {readFileSync} from 'node:fs'
import {mockFileMap} from './mockFiles.ts'
import {isServerRunning, runServeInBackground} from './background.ts'
import {styleText} from 'node:util'
import {pollFor} from '../lang/util.ts'
import {FILE_MAP} from '../lang/analyze.ts'

interface CheckOptions {
  mdArg?: string
  chart?: string
  log?: (...args: any[]) => void
}

let browserConnections: {url: string, socket: WebSocket}[] = []
let pendingRequests: Record<string, {response: ServerResponse<IncomingMessage>}> = {}

export async function check (options: CheckOptions): Promise<boolean> {
  let log = options.log || console.log
  let mdFile = options.mdArg && normalizeMdFile(options.mdArg)

  if (options.mdArg && !mdFile) {
    log(`Couldn't find ${options.mdArg}`)
    return false
  }

  // if there's no file arg, check all md files. If there is a file arg, just load that file.
  await loadWorkspace(config.root, !mdFile)
  if (mdFile) {
    if (process.env.NODE_ENV == 'test' && mockFileMap[mdFile]) {
      updateFile(mockFileMap[mdFile], mdFile)
    } else {
      let content = readFileSync(path.resolve(config.root, mdFile), 'utf-8')
      updateFile(content, mdFile)
    }
  }

  analyze()
  if (getDiagnostics().length > 0) {
    printDiagnostics(getDiagnostics(), log)
    return false
  }

  if (!mdFile) {
    log('No errors found 💎')
    return true
  }

  // in tests, both `check` and the vite server are in the same process, so end up sharing the workspace.
  // Because of that, we need to clear out the md file we loaded into the workspace (which the usually server never loads).
  // Otherwise, you'll get `some_table already defined` errors.
  if (process.env.NODE_ENV == 'test' && mdFile) {
    delete FILE_MAP[mdFile]
  }

  // Remove .md extension if provided and ensure it's just the filename
  let host = `http://localhost:${config.port || Number(process.env.GRAPHENE_PORT) || 4000}`
  let pageUrl = '/' + mdFile.replace(/\.md$/, '').replace(/^\//, '').replace(/\\/g, '/')
  if (pageUrl === '/index') pageUrl = '/'

  if (process.env.NODE_ENV !== 'test' && !(await isServerRunning())) {
    log('Starting Graphene server...')
    await runServeInBackground()
  }

  let resp = await sendCheckRequest({host, pageUrl, chart: options.chart})

  if (resp.checkError == 'no_server') {
    log('Failed to start Graphene server')
    return false
  }

  if (resp.checkError == 'no_tab' && process.env.NODE_ENV !== 'test') {
    log(`Opening page ${host}${pageUrl}`)
    spawn('open', [host + pageUrl])
    await new Promise(resolve => setTimeout(resolve, 500))
    resp = await sendCheckRequest({host, pageUrl, chart: options.chart})
  }

  if (resp.checkError == 'no_tab') {
    log('Failed to open a new tab')
    return false
  }

  if (resp.checkError) {
    log('Failed to run check: ' + resp.checkError)
    return false
  }

  let errors = Array.from(resp.errors || [])
  if (errors.length) {
    log(styleText('red', 'Runtime errors') + ` in ${mdFile}:`)
  } else {
    log('No errors found 💎')
  }
  errors.forEach((e:any) => {
    if (e.file && e.line) printDiagnostics([e as Diagnostic], log)
    else if (e.id) log(`${e.id}: ${e.message}`)
    else log(e.message)
  })

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

  return errors.length == 0
}

async function sendCheckRequest ({host, pageUrl, chart}) {
  let abort = new AbortController()
  let timeout = setTimeout(() => abort.abort(), 30_000)
  try {
    let response = await fetch(`${host}/_api/check`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pageUrl: host + pageUrl, chart}),
      signal: abort.signal,
    })
    clearTimeout(timeout)

    let body = response.headers.get('content-type') == 'application/json' ? await response.json() : {error: await response.text()}

    if (!response.ok) {
      if (body.error) return {checkError: body.error}
      console.error(`Unexpected response: ${JSON.stringify(body)}`)
      return {checkError: 'Unexpected response from Graphene server'}
    }

    return body
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') return {checkError: 'timeout'}
    return {checkError: 'no_server'}
  }
}

function normalizeMdFile (mdFile: string): string | null {
  let clean = mdFile.trim()
  if (!clean) return null
  if (!clean.endsWith('.md')) clean = clean + '.md'

  if (process.env.NODE_ENV == 'test' && mockFileMap[clean]) {
    return clean
  }

  let absolute = [
    path.resolve(process.cwd(), clean),
    path.resolve(config.root, clean),
  ].find(p => fs.existsSync(p)) || null

  if (!absolute) return null
  let relative = path.relative(config.root, absolute)
  return relative
}

// A request has come in to the server to check a specific url. We'll load it up, forward along the request, and proxy the response.
export async function proxyCheckRequest (req: IncomingMessage, res: ServerResponse<IncomingMessage>): Promise<void> {
  let chunks = [] as any[]
  for await (let chunk of req) chunks.push(chunk)
  let {pageUrl, chart} = JSON.parse(Buffer.concat(chunks).toString())
  let id = Math.random().toString(36).slice(2) // random id string
  res.setHeader('Content-Type', 'application/json')

  // Check for existing WebSocket connections for the given url
  let normalizedPageUrl = pageUrl.replace(/\/$/, '')
  let conn = await pollFor(() => browserConnections.find(conn => conn.url === normalizedPageUrl), 5000, 100)
  if (!conn) {
    res.statusCode = 400
    res.end(JSON.stringify({error: 'no_tab'}))
    return
  } else {
    conn.socket.send(JSON.stringify({type: 'check', chart, requestId: id}))
    pendingRequests[id] = {response: res}
  }
}

// Vite plugin that allows running Graphene pages to connect, and can proxy `check` requests to those pages.
export function checkVitePlugin (): PluginOption {
  return {
    name: 'graphene-check-plugin',
    configureServer (server: ViteDevServer) {
      let wss = new WebSocketServer({noServer: true})

      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (!req.url || (!req.url.includes('/_api/ws') && !req.url.includes('graphene-ws'))) return
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req)
        })
      })

      wss.on('connection', (socket) => {
        socket.on('message', (data) => {
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
        if (pathName === '/_api/check') await proxyCheckRequest(req, res)
        else next()
      })
    },
  }
}
