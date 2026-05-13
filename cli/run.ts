import fs from 'fs-extra'
import {type IncomingMessage, type ServerResponse} from 'http'
import {readFileSync} from 'node:fs'
import {styleText} from 'node:util'
import path from 'path'
import {chromium, type Page} from 'playwright-core'
import {type PluginOption, type ViteDevServer} from 'vite'
import {WebSocketServer, type WebSocket} from 'ws'

import type {GrapheneError} from '../lang/index.d.ts'

import {config} from '../lang/config.ts'
import {analyzeWorkspace, getFile, loadWorkspace, toSql} from '../lang/core.ts'
import {type AnalysisResult, type WorkspaceFileInput} from '../lang/types.ts'
import {pollFor} from '../lang/util.ts'
import {openInBrowser} from './auth.ts'
import {getGrapheneCache, isServerRunning, runServeInBackground} from './background.ts'
import {runQuery} from './connections/index.ts'
import {mockFileMap} from './mockFiles.ts'
import {normalizeFile} from './normalizeFile.ts'
import {printDiagnostics, printTable} from './printer.ts'
import {getWorkspaceScanCounts, type CliTelemetry} from './telemetry/index.ts'

export interface RunMdFileOptions {
  mdArg: string
  chart?: string
  headless?: boolean
  inputs?: RunInputs
  log?: (...args: any[]) => void
  telemetry?: CliTelemetry
}

type RunInputs = Record<string, string | string[]>

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

  let pageUrl = markdownPageUrl(mdFile, options.inputs)
  let request = {pageUrl, action: 'check' as const, chart: options.chart, log}
  let resp = options.headless ? await runHeadlessPageRequest(request) : await sendSocketRequest(request)
  if (!resp) return false
  log('Page available at', runHost() + pageUrl)

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
    let filename = `${new Date().toISOString().replace(/[:.]/g, '-')}.png`
    let screenshotDir = path.join(getGrapheneCache(config.root), 'screenshots')
    let screenshotPath = path.join(screenshotDir, filename)
    await fs.ensureDir(screenshotDir)
    await fs.writeFile(screenshotPath, resp.screenshot)
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

  let resp = await sendSocketRequest({pageUrl: markdownPageUrl(mdFile), action: 'list', log})
  if (!resp) return false

  let componentIds = (resp.componentIds || []) as string[]
  if (!componentIds.length) log('No chart queries found')
  else componentIds.forEach(componentId => log(componentId))
  return true
}

export async function runNamedQueryFromMd(mdAbsolutePath: string, queryName: string, options: {inputs?: RunInputs; telemetry?: CliTelemetry} = {}): Promise<boolean> {
  let files = await loadWorkspace(process.cwd(), false, config.ignoredFiles)
  options.telemetry?.event('workspace_scanned', {command: 'run', ...getWorkspaceScanCounts(files)})
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
  let sql: string
  try {
    sql = toSql(input.queries[input.queries.length - 1], options.inputs || {})
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    return false
  }
  let res = await runQuery(sql)
  printTable(res.rows)
  return true
}

async function sendSocketRequest({pageUrl, action, chart, log}: {pageUrl: string; action: 'check' | 'list'; chart?: string; log: (...args: any[]) => void}) {
  let host = runHost()
  if (process.env.NODE_ENV !== 'test' && !(await isServerRunning())) {
    log('Starting Graphene server...')
    await runServeInBackground()
  }

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

function markdownPageUrl(mdFile: string, inputs?: RunInputs) {
  let pageUrl = '/' + mdFile.replace(/\.md$/, '').replace(/^\//, '').replace(/\\/g, '/')
  if (pageUrl === '/index') pageUrl = '/'
  pageUrl = appendInputsToUrl(pageUrl, inputs)
  return pageUrl
}

function runHost() {
  return `http://localhost:${config.port}`
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

  conn.socket.send(JSON.stringify({action, chart, requestId: id}))
  pendingRequests[id] = {response: res}
}

async function runHeadlessPageRequest({pageUrl, action, chart, log}: {pageUrl: string; action: 'check' | 'list'; chart?: string; log: (...args: any[]) => void}) {
  if (process.env.NODE_ENV !== 'test' && !(await isServerRunning())) {
    log('Starting Graphene server...')
    await runServeInBackground()
  }

  let host = runHost()
  let browser = await launchHeadlessBrowser(log)
  if (!browser) return null

  try {
    let context = await browser.newContext({
      viewport: {width: 1280, height: 720},
      deviceScaleFactor: 1,
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'reduce',
    })
    let page = await context.newPage()
    await page.goto(host + pageUrl)

    let finished = await page.evaluate(async () => {
      let graphene = (window as any).$GRAPHENE
      if (typeof graphene?.waitForLoad === 'function') return await graphene.waitForLoad(20_000)
      return false
    })

    if (action === 'list') {
      let componentIds = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-component-id]'))
          .map(el => el.getAttribute('data-component-id') || '')
          .filter(componentId => componentId.trim().length > 0),
      )
      await context.close()
      return {componentIds}
    }

    let errors = await page.evaluate(() => ((window as any).$GRAPHENE?.getErrors?.() || []) as GrapheneError[])
    let screenshot = chart ? await captureChart(page, chart) : await page.screenshot({fullPage: true, animations: 'disabled', scale: 'css'})
    await context.close()
    return {errors, stillLoading: !finished, screenshot}
  } catch (err) {
    log(`Failed to ${action == 'check' ? 'run check' : 'list queries'}: ${err instanceof Error ? err.message : String(err)}`)
    return null
  } finally {
    await browser.close()
  }
}

function appendInputsToUrl(pageUrl: string, inputs: RunInputs = {}) {
  let search = new URLSearchParams()
  Object.entries(inputs).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach(item => search.append(name, item))
    else search.append(name, value)
  })
  let rendered = search.toString()
  if (!rendered) return pageUrl
  return `${pageUrl}?${rendered}`
}

async function launchHeadlessBrowser(log: (...args: any[]) => void) {
  let launchOptions = {
    headless: true,
    args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning', '--disable-lcd-text', '--force-color-profile=srgb', '--lang=en-US'],
  }
  let lastError: unknown

  try {
    return await chromium.launch(launchOptions)
  } catch (err) {
    lastError = err
  }

  for (let channel of ['chrome', 'msedge'] as const) {
    try {
      return await chromium.launch({...launchOptions, channel})
    } catch (err) {
      lastError = err
    }
  }

  let message = lastError instanceof Error ? lastError.message : String(lastError)
  if (message.includes('Executable doesn') || message.includes('browserType.launch')) {
    log('Failed to launch headless browser. Run `graphene install-browser` before using `graphene run --headless`.')
  } else {
    log(`Failed to launch headless browser: ${message}`)
  }
  return null
}

async function captureChart(page: Page, chart: string) {
  let selector = await page.evaluate(chart => {
    let escaped = window.CSS.escape(chart)
    if (document.querySelector(`[data-chart-title="${escaped}"]`)) return `[data-chart-title="${escaped}"]`
    if (document.querySelector(`[data-component-id="${escaped}"]`)) return `[data-component-id="${escaped}"]`
    return null
  }, chart)
  if (!selector) return undefined
  return await page.locator(selector).screenshot({animations: 'disabled', scale: 'css'})
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
