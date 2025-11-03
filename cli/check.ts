import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import {spawn} from 'child_process'
import {type IncomingMessage, type ServerResponse} from 'http'
import {WebSocketServer, type WebSocket} from 'ws'
import {type PluginOption, type ViteDevServer} from 'vite'

import {analyze, config, getDiagnostics, loadWorkspace, updateFile} from '../lang/core.ts'
import {printDiagnostics} from './printer.ts'
import {readFileSync} from 'node:fs'

interface CheckOptions {
  mdArg?: string
  chart?: string
}

interface RuntimeErrorPayload {
  message?: string
  stack?: string
}

let browserConnections: {url: string, socket: WebSocket}[] = []
let pendingRequests: Record<string, {response: ServerResponse<IncomingMessage>}> = {}

export async function check (options: CheckOptions): Promise<boolean> {
  let mdFile = options.mdArg && normalizeMdFile(options.mdArg)

  if (options.mdArg && !mdFile) {
    console.error(`Couldn't find ${options.mdArg}`)
    return false
  }

  // if there's no file arg, check all md files. If there is a file arg, just load that file.
  await loadWorkspace(config.root, !mdFile)
  if (mdFile) {
    let content = readFileSync(path.resolve(config.root, mdFile), 'utf-8')
    updateFile(content, mdFile)
  }

  analyze()
  if (getDiagnostics().length > 0) {
    printDiagnostics(getDiagnostics())
    return false
  }

  if (!mdFile) {
    console.log('No errors found 💎')
    return true
  }

  // await ensureServerRunning(config.root) // but not in tests

  let runtimeResult: any
  let abort = new AbortController()
  let timeout = setTimeout(() => abort.abort(), 30_000)
  try {
    let port = config.port || Number(process.env.GRAPHENE_PORT) || 4000
    let response = await fetch(`http://localhost:${port}/_api/check`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({mdFile, chart: options.chart}),
      signal: abort.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      console.error(`Check failed: ${await response.text()}`)
      return false
    }

    runtimeResult = await response.json()
  } catch (err) {
    clearTimeout(timeout)
    if ((err as Error).name === 'AbortError') {
      console.error('Check request timed out waiting for the page to respond')
    } else {
      console.error('Check failed:', err)
    }
    return false
  }

  Array.from(runtimeResult?.errors || []).forEach(err => {
    for (let line of formatRuntimeError(err!, mdFile)) {
      console.error(line)
    }
  })

  if (runtimeResult?.stillLoading) {
    console.warn('Warning: Queries were still loading when the screenshot was taken')
  }

  if (runtimeResult?.screenshot) {
    let filename = `graphene-screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
    let screenshotPath = path.join(os.tmpdir(), filename)
    let base64Data = runtimeResult.screenshot.replace(/^data:image\/png;base64,/, '')
    await fs.writeFile(screenshotPath, base64Data, 'base64')
    console.log('Screenshot saved to', screenshotPath)
  }

  let runtimeErrors = Array.from(runtimeResult?.errors || [])
  if (runtimeErrors.length > 0) {
    let target = mdFile ? path.basename(mdFile) : 'project'
    console.error(`Runtime errors found in ${target}`)
    return false
  }

  console.log('No errors found 💎')
  return true
}

function normalizeMdFile (mdFile: string): string | null {
  let clean = mdFile.trim()
  if (!clean) return null
  if (!clean.endsWith('.md')) clean = clean + '.md'

  let absolute = [
    path.resolve(process.cwd(), clean),
    path.resolve(config.root, clean),
  ].find(p => fs.existsSync(p)) || null

  if (!absolute) return null
  let relative = path.relative(config.root, absolute)
  return relative
}

function formatRuntimeError (error: RuntimeErrorPayload, fallbackMd: string): string[] {
  let lines: string[] = []
  let anyError = error as RuntimeErrorPayload & Record<string, any>
  let mdFile = typeof anyError.mdFile === 'string' && anyError.mdFile.length ? anyError.mdFile : fallbackMd
  let displayLine = typeof anyError.displayLine === 'number' ? anyError.displayLine : (
    typeof anyError.line === 'number' ? anyError.line + 1 : undefined
  )
  let location = mdFile
  if (displayLine) location = `${location}:${displayLine}`

  let chartType = anyError.chartType
  let chartTitle = anyError.chartTitle || anyError.title
  let chartLabel = ''
  if (chartType && chartTitle && chartTitle !== chartType) chartLabel = `${chartType} – ${chartTitle}`
  else if (chartTitle) chartLabel = chartTitle
  else if (chartType) chartLabel = chartType

  let source = anyError.source || anyError.chartName

  let headerParts = []
  if (location) headerParts.push(location)
  if (chartLabel) headerParts.push(chartLabel)
  if (source && source !== chartLabel) headerParts.push(source)

  let message = error.message || String(error)
  if (headerParts.length) lines.push(`- ${headerParts.join(' · ')}: ${message}`)
  else lines.push(`- ${message}`)

  let fields = anyError.fields
  if (fields && typeof fields === 'object') {
    let entries = Object.entries(fields).filter(([key, value]) => key && value)
    if (entries.length) {
      let summary = entries.map(([attr, expr]) => {
        if (Array.isArray(expr)) return `${attr}=${expr.join(', ')}`
        return `${attr}=${expr}`
      }).join(', ')
      lines.push(`    fields: ${summary}`)
    }
  }

  let summary = anyError.summary || anyError.lineText
  if (summary && summary !== message) lines.push(`    ${summary.trim()}`)

  if (error.stack) lines.push(error.stack)
  return lines
}

// A request has come in to the server to check a specific url. We'll load it up, forward along the request, and proxy the response.
export async function handleCheckRequest (req: IncomingMessage, res: ServerResponse<IncomingMessage>): Promise<void> {
  let chunks = [] as any[]
  for await (let chunk of req) chunks.push(chunk)
  let {mdFile, chart} = JSON.parse(Buffer.concat(chunks).toString())
  let relativeMd = typeof mdFile === 'string' ? mdFile : ''
  if (relativeMd && path.isAbsolute(relativeMd)) relativeMd = path.relative(config.root, relativeMd)
  relativeMd = relativeMd.replace(/^\.{1,2}[\\/]*/, '')
  let id = Math.random().toString(36).slice(2) // random id string
  res.setHeader('Content-Type', 'application/json')
  pendingRequests[id] = {response: res}

  // Remove .md extension if provided and ensure it's just the filename
  let pageUrl = '/' + relativeMd.replace(/\.md$/, '').replace(/^\//, '').replace(/\\/g, '/')
  if (pageUrl === '/index') pageUrl = '/'
  pageUrl = `http://localhost:${config.port || 4000}${pageUrl}`

  // Check for existing WebSocket connections. Open a page if we don't find one.
  let normalizedPageUrl = pageUrl.endsWith('/') ? pageUrl.slice(0, -1) : pageUrl
  let conn = browserConnections.find(conn => conn.url === pageUrl || conn.url === normalizedPageUrl)
  if (!conn) {
    spawn('open', [pageUrl])
    let end = Date.now() + 5000
    while (Date.now() < end && !conn) {
      conn = browserConnections.find(conn => conn.url === pageUrl || conn.url === normalizedPageUrl)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (!conn) {
      res.statusCode = 500
      res.end(JSON.stringify({error: 'No browser tab available and failed to open one'}))
      return
    }
  }
  conn.socket.send(JSON.stringify({type: 'view', chart, requestId: id}))
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
          if (message.type === 'register') browserConnections.push({url: message.url, socket})
          if (message.type === 'viewResponse') {
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
        if (pathName === '/_api/check') await handleCheckRequest(req, res)
        else next()
      })
    },
  }
}
