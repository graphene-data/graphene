import fs from 'fs-extra'
import {type IncomingMessage, type ServerResponse} from 'http'
import {readFileSync} from 'node:fs'
import {styleText} from 'node:util'
import os from 'os'
import path from 'path'
import {type PluginOption, type ViteDevServer} from 'vite'
import {WebSocketServer, type WebSocket} from 'ws'

import {analyze, config, deleteFile, type GrapheneError, getDiagnostics, loadWorkspace, toSql, updateFile} from '../lang/core.ts'
import {pollFor} from '../lang/util.ts'
import {openInBrowser} from './auth.ts'
import {isServerRunning, runServeInBackground} from './background.ts'
import {runQuery} from './connections/index.ts'
import {mockFileMap} from './mockFiles.ts'
import {normalizeFile} from './normalizeFile.ts'
import {printDiagnostics, printTable} from './printer.ts'

export interface RunMdFileOptions {
  mdArg: string
  chart?: string
  log?: (...args: any[]) => void
}

let browserConnections: {url: string; socket: WebSocket}[] = []
let pendingRequests: Record<string, {response: ServerResponse<IncomingMessage>}> = {}

export async function runMdFile(options: RunMdFileOptions): Promise<boolean> {
  let log = options.log || console.log
  let mdFile = normalizeFile(options.mdArg)
  if (!mdFile) {
    log(`Couldn't find ${options.mdArg}`)
    return false
  }

  await loadWorkspace(config.root, false)
  if (process.env.NODE_ENV == 'test' && mockFileMap[mdFile]) {
    updateFile(mockFileMap[mdFile], mdFile)
  } else {
    let content = readFileSync(path.resolve(config.root, mdFile), 'utf-8')
    updateFile(content, mdFile)
  }

  analyze()
  if (getDiagnostics().length > 0) {
    printDiagnostics(getDiagnostics(), log)
    return false
  }

  if (process.env.NODE_ENV == 'test') deleteFile(mdFile)

  let host = `http://localhost:${config.port}`
  let pageUrl = '/' + mdFile.replace(/\.md$/, '').replace(/^\//, '').replace(/\\/g, '/')
  if (pageUrl === '/index') pageUrl = '/'

  if (process.env.NODE_ENV !== 'test' && !(await isServerRunning())) {
    log('Starting Graphene server...')
    await runServeInBackground()
  }

  let resp = await sendRunRequest({host, pageUrl, chart: options.chart})

  if (resp.checkError == 'no_server') {
    log('Failed to start Graphene server')
    return false
  }

  if (resp.checkError == 'no_tab' && process.env.NODE_ENV !== 'test') {
    log(`Opening page ${host}${pageUrl}`)
    openInBrowser(host + pageUrl)
    await new Promise(resolve => setTimeout(resolve, 500))
    resp = await sendRunRequest({host, pageUrl, chart: options.chart})
  }

  if (resp.checkError == 'no_tab') {
    log('Failed to open a new tab')
    return false
  }

  if (resp.checkError) {
    log('Failed to run check: ' + resp.checkError)
    return false
  }

  let errors = Array.from(resp.errors || []) as GrapheneError[]
  if (errors.length) {
    log(styleText('red', 'Runtime errors') + ` in ${mdFile}:`)
  } else {
    log('No errors found 💎')
  }

  errors.forEach((e: GrapheneError) => {
    if (e.file || e.frame) printDiagnostics([e], log)
    else if (e.queryId) log(`${e.queryId}: ${e.message}`)
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

export async function runNamedQueryFromMd(mdAbsolutePath: string, queryName: string): Promise<boolean> {
  await loadWorkspace(process.cwd(), false)
  let mdRelativePath = path.relative(process.cwd(), mdAbsolutePath)
  let mdContents = await fs.promises.readFile(mdAbsolutePath, 'utf-8')

  updateFile(mdContents, mdRelativePath)
  analyze()
  if (getDiagnostics().length > 0) {
    printDiagnostics(getDiagnostics())
    return false
  }

  let runQueryFence = [mdContents, '', '```sql', `from ${queryName} select *`, '```'].join('\n')
  let queries = analyze(runQueryFence, 'md')
  if (getDiagnostics().length > 0) {
    printDiagnostics(getDiagnostics())
    return false
  }

  let sql = toSql(queries[queries.length - 1])
  let res = await runQuery(sql)
  printTable(res.rows)
  return true
}

async function sendRunRequest({host, pageUrl, chart}) {
  let abort = new AbortController()
  let timeout = setTimeout(() => abort.abort(), 30_000)
  let browserHost = host.replace('127.0.0.1', 'localhost')
  try {
    let response = await fetch(`${host}/_api/check`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pageUrl: browserHost + pageUrl, chart}),
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

export async function proxyRunRequest(req: IncomingMessage, res: ServerResponse<IncomingMessage>): Promise<void> {
  let chunks = [] as any[]
  for await (let chunk of req) chunks.push(chunk)
  let {pageUrl, chart} = JSON.parse(Buffer.concat(chunks).toString())
  let id = Math.random().toString(36).slice(2)
  res.setHeader('Content-Type', 'application/json')

  let normalizedPageUrl = pageUrl.replace(/\/$/, '')
  let conn = await pollFor(() => browserConnections.find(conn => conn.url === normalizedPageUrl), 5000, 100)
  if (!conn) {
    res.statusCode = 400
    res.end(JSON.stringify({error: 'no_tab'}))
    return
  }

  conn.socket.send(JSON.stringify({type: 'check', chart, requestId: id}))
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
