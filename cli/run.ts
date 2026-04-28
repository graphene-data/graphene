import fs from 'fs-extra'
import {type IncomingMessage, type ServerResponse} from 'http'
import {readFileSync} from 'node:fs'
import {styleText} from 'node:util'
import os from 'os'
import path from 'path'
import {type PluginOption, type ViteDevServer} from 'vite'
import {WebSocketServer, type WebSocket} from 'ws'

import type {GrapheneError} from '../lang/index.d.ts'

import {config} from '../lang/config.ts'
import {analyzeWorkspace, getFile, loadWorkspace, toSql} from '../lang/core.ts'
import {type AnalysisResult, type WorkspaceFileInput} from '../lang/types.ts'
import {pollFor} from '../lang/util.ts'
import {openInBrowser} from './auth.ts'
import {isServerRunning, runServeInBackground} from './background.ts'
import {runQuery} from './connections/index.ts'
import {mockFileMap} from './mockFiles.ts'
import {normalizeFile} from './normalizeFile.ts'
import {printDiagnostics, printTable} from './printer.ts'
import {getWorkspaceScanCounts, type CliTelemetry} from './telemetry/index.ts'

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
  let mdFile = normalizeFile(options.mdArg)
  if (!mdFile) {
    log(`Couldn't find ${options.mdArg}`)
    return false
  }

  let files = await loadWorkspace(config.root, false, config.ignoredFiles)
  options.telemetry?.event('workspace_scanned', {command: 'run', ...getWorkspaceScanCounts(files)})
  let mdContents: string
  if (process.env.NODE_ENV == 'test' && mockFileMap[mdFile]) {
    mdContents = mockFileMap[mdFile]
  } else {
    mdContents = readFileSync(path.resolve(config.root, mdFile), 'utf-8')
  }

  let result = analyzeWorkspace({config, files: files.filter(file => file.path != mdFile).concat({path: mdFile, contents: mdContents, kind: 'md'})}, mdFile)
  if (result.diagnostics.length > 0) {
    printDiagnostics(result.diagnostics, log)
    return false
  }

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
  let chartNotFound = !!options.chart && !resp.screenshot
  if (chartNotFound) log(`Could not find chart "${options.chart}" on ${mdFile}`)

  if (errors.length) {
    log(styleText('red', 'Runtime errors') + ` in ${mdFile}:`)
  } else if (!chartNotFound) {
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

  return errors.length == 0 && !chartNotFound
}

export async function runNamedQueryFromMd(mdAbsolutePath: string, queryName: string, telemetry?: CliTelemetry): Promise<boolean> {
  let files = await loadWorkspace(process.cwd(), false, config.ignoredFiles)
  telemetry?.event('workspace_scanned', {command: 'run', ...getWorkspaceScanCounts(files)})
  let mdRelativePath = path.relative(process.cwd(), mdAbsolutePath)
  let mdContents = await fs.promises.readFile(mdAbsolutePath, 'utf-8')

  let result = analyzeWorkspace({config, files: files.filter(file => file.path != mdRelativePath).concat({path: mdRelativePath, contents: mdContents, kind: 'md'})}, mdRelativePath)
  if (result.diagnostics.length > 0) {
    printDiagnostics(result.diagnostics)
    return false
  }

  let runQueryFence = [mdContents, '', '```sql', `from ${queryName} select *`, '```'].join('\n')
  let queryFiles = toWorkspaceFiles(result)
  let queryResult = analyzeWorkspace({config, files: queryFiles.filter(file => file.path != 'input.md').concat({path: 'input.md', contents: runQueryFence, kind: 'md'})}, 'input.md')
  if (queryResult.diagnostics.length > 0) {
    printDiagnostics(queryResult.diagnostics)
    return false
  }

  let input = getFile(queryResult, 'input.md')
  if (!input?.queries.length) return false
  let sql = toSql(input.queries[input.queries.length - 1])
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

function toWorkspaceFiles(analysis: AnalysisResult): WorkspaceFileInput[] {
  return analysis.files.map(file => ({
    path: file.path,
    contents: file.contents,
    kind: file.path.endsWith('.md') ? 'md' : 'gsql',
    parsed: {tree: file.tree!, virtualContents: file.virtualContents, virtualToMarkdownOffset: file.virtualToMarkdownOffset},
  }))
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
