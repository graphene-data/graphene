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
import {type WorkspaceFileInput} from '../lang/types.ts'
import {pollFor} from '../lang/util.ts'
import {openInBrowser} from './auth.ts'
import {isServerRunning, runServeInBackground} from './background.ts'
import {runQuery} from './connections/index.ts'
import {mockFileMap} from './mockFiles.ts'
import {normalizeFile} from './normalizeFile.ts'
import {buildPageRuntime, type PageInput} from './pageRuntime.ts'
import {printDiagnostics, printTable} from './printer.ts'
import {getWorkspaceScanCounts, type CliTelemetry} from './telemetry/index.ts'

export interface RunMdFileOptions {
  mdArg: string
  chart?: string
  log?: (...args: any[]) => void
  telemetry?: CliTelemetry
}

interface RunPageQueryOptions {
  inputs?: string[]
  allQueries?: boolean
  listInputs?: boolean
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

  let resp = await sendSocketRequest({mdFile, action: 'check', chart: options.chart, log})
  if (!resp) return false

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
    else if (e.componentId) log(`${e.componentId}: ${e.message}`)
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

export async function listMdFileQueries(mdArg: string, telemetry?: CliTelemetry, log: (...args: any[]) => void = console.log): Promise<boolean> {
  let mdFile = normalizeFile(mdArg)
  if (!mdFile) {
    log(`Couldn't find ${mdArg}`)
    return false
  }

  let files = await loadWorkspace(config.root, false, config.ignoredFiles)
  telemetry?.event('workspace_scanned', {command: 'list', ...getWorkspaceScanCounts(files)})
  let mdContents = process.env.NODE_ENV == 'test' && mockFileMap[mdFile] ? mockFileMap[mdFile] : readFileSync(path.resolve(config.root, mdFile), 'utf-8')

  let result = analyzeWorkspace({config, files: files.filter(file => file.path != mdFile).concat({path: mdFile, contents: mdContents, kind: 'md'})}, mdFile)
  if (result.diagnostics.length > 0) {
    printDiagnostics(result.diagnostics, log)
    return false
  }

  let resp = await sendSocketRequest({mdFile, action: 'list', log})
  if (!resp) return false

  let componentIds = (resp.componentIds || []) as string[]
  if (!componentIds.length) log('No chart queries found')
  else componentIds.forEach(componentId => log(componentId))
  return true
}

export async function runNamedQueryFromMd(mdAbsolutePath: string, queryName: string, options: RunPageQueryOptions = {}): Promise<boolean> {
  let log = console.log
  let files = await loadWorkspace(process.cwd(), false, config.ignoredFiles)
  options.telemetry?.event('workspace_scanned', {command: 'run', ...getWorkspaceScanCounts(files)})
  let mdRelativePath = path.relative(process.cwd(), mdAbsolutePath)
  let mdContents = await fs.promises.readFile(mdAbsolutePath, 'utf-8')

  let page: ReturnType<typeof buildPageRuntime>
  try {
    page = buildPageRuntime(mdContents, mdRelativePath, parseInputOverrides(options.inputs || []))
  } catch (err: any) {
    log(err.message || String(err))
    return false
  }

  if (options.listInputs) {
    printPageInputs(page.inputs, log)
    return true
  }

  if (options.allQueries) return await runComponentQueries({files, page, log})

  let result = analyzeWorkspace({config, files: files.filter(file => file.path != mdRelativePath).concat({path: mdRelativePath, contents: mdContents, kind: 'md'})}, mdRelativePath)
  if (result.diagnostics.length > 0) {
    printDiagnostics(result.diagnostics, log)
    return false
  }

  try {
    let sql = compilePageRequest(files, page, `from ${queryName} select *`)
    let res = await runQuery(sql)
    printTable(res.rows)
    return true
  } catch (err: any) {
    log(err.message || String(err))
    return false
  }
}

async function runComponentQueries({files, page, log}: {files: WorkspaceFileInput[]; page: ReturnType<typeof buildPageRuntime>; log: (...args: any[]) => void}) {
  if (!page.componentRequests.length) {
    log('No component queries found')
    return true
  }

  let failed = false
  for (let request of page.componentRequests) {
    let fields = request.fields.length ? Array.from(new Set(request.fields.filter(Boolean))) : ['*']
    let gsql = `from ${request.source} select ${fields.join(', ')}`
    try {
      let sql = compilePageRequest(files, page, gsql)
      await runQuery(sql)
    } catch (err: any) {
      failed = true
      log(`${request.componentId} (${request.location})`)
      log(`  data="${request.source}" fields="${fields.join(', ')}"`)
      log(`  ${err.message || String(err)}`)
    }
  }

  if (!failed) log(`All component queries ran successfully (${page.componentRequests.length})`)
  return !failed
}

function compilePageRequest(files: WorkspaceFileInput[], page: ReturnType<typeof buildPageRuntime>, query: string) {
  let gsql = [...page.fences.map(f => `table ${f.name} as (\n${f.contents}\n)`), query].join('\n')
  let result = analyzeWorkspace({config, files: files.filter(file => file.path != 'input').concat({path: 'input', contents: gsql})}, 'input')
  if (result.diagnostics.length > 0) throw new Error(result.diagnostics.map(d => d.message).join('\n'))

  let input = getFile(result, 'input')
  if (!input?.queries.length) throw new Error('No query found to run')
  return toSql(input.queries[input.queries.length - 1], page.params)
}

function printPageInputs(inputs: PageInput[], log: (...args: any[]) => void) {
  if (!inputs.length) {
    log('No page inputs found')
    return
  }
  inputs.forEach(input => {
    log(`${input.name} (${input.component})`)
    log(`  keys: ${input.keys.join(', ')}`)
    log(`  default: ${formatParamValue(input.defaultValue)}`)
    log(`  value: ${formatParamValue(input.effectiveValue)}`)
    log(`  location: ${input.location}`)
  })
}

function parseInputOverrides(inputs: string[]) {
  let params: Record<string, any> = {}
  inputs.forEach(input => {
    let idx = input.indexOf('=')
    if (idx <= 0) throw new Error(`Invalid --input "${input}". Use --input name=value.`)
    let key = input.slice(0, idx)
    let value = input.slice(idx + 1)
    let existing = params[key]
    if (existing === undefined) params[key] = value
    else if (Array.isArray(existing)) existing.push(value)
    else params[key] = [existing, value]
  })
  return params
}

function formatParamValue(value: any) {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return `[${value.map(formatParamValue).join(', ')}]`
  if (typeof value == 'object') return JSON.stringify(value)
  return String(value)
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
