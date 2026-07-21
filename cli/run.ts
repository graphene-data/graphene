import {type IncomingMessage, type ServerResponse} from 'http'
import {chromium} from 'playwright-core'
import {type PluginOption, type ViteDevServer} from 'vite'
import {WebSocketServer, type WebSocket} from 'ws'

import type {PageRequest, PageResponse, SocketRegistration} from '../ui/internal/runPage.ts'

import {config} from '../lang/config.ts'
import {pollFor} from '../lang/util.ts'
import {openInBrowser} from './auth.ts'
import {ensureBackgroundServer} from './background.ts'

// Starts the local server and invokes the page through either Playwright or an open tab's WebSocket.
export async function sendToPage(mdPath, request: PageRequest, headless: boolean): Promise<PageResponse> {
  await ensureBackgroundServer()

  let pageUrl = pageUrlForMd(mdPath, request.params)
  if (headless) {
    return await runHeadlessPageRequest(pageUrl, request)
  } else {
    let resp = await sendRequestToVite(pageUrl, request)

    // If there's no tab open, attempt to open one
    if (resp.errors && resp.errors[0]?.message == 'no_tab') {
      console.log(`Opening page ${pageUrl}`)
      openInBrowser(pageUrl)
      await new Promise(resolve => setTimeout(resolve, 500))
      resp = await sendRequestToVite(pageUrl, request)
      if (resp.errors && resp.errors[0]?.message == 'no_tab') throw new Error(`Unable to open a new tab to ${pageUrl}. Try using the --headless`)
    }

    return resp
  }
}

// Computes the browser URL for a markdown page, matching the URL registered by open browser tabs.
export function pageUrlForMd(mdPath: string, params: PageRequest['params'] = {}): string {
  let host = `http://localhost:${config.port}`
  let pagePath = '/' + mdPath.replace(/\.md$/, '').replace(/^\//, '').replace(/\\/g, '/')
  if (pagePath === '/index') pagePath = ''

  let search = new URLSearchParams()
  Object.entries(params || {}).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach(item => search.append(name, item))
    else search.append(name, value)
  })
  let query = search.toString()
  return `${host}${pagePath || (query ? '/' : '')}${query ? `?${query}` : ''}`
}

// This sends the request to the Vite server, which in turn finds and appropriate page to forward the request to.
async function sendRequestToVite(pageUrl: string, request: PageRequest): Promise<PageResponse> {
  try {
    let host = `http://localhost:${config.port}`
    let response = await fetch(`${host}/_api/run`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pageUrl, request}),
      signal: AbortSignal.timeout(30_000),
    })
    let body = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {errors: [{message: await response.text()}]}
    if (body.error) return {errors: [{message: body.error}]}

    if (response.ok) return body
    console.error(`Unexpected response: ${JSON.stringify(body)}`)
    return {errors: [{message: 'Unexpected response from Graphene server'}]}
  } catch (err) {
    return {errors: [err as Error]}
  }
}

// Opens the requested page and calls its typed run function through Playwright.
async function runHeadlessPageRequest(pageUrl: string, request: PageRequest): Promise<PageResponse> {
  let channels = [{}, {channel: 'chrome'}, {channel: 'msedge'}]
  let launchOptions = {headless: true, args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning', '--disable-lcd-text', '--force-color-profile=srgb', '--lang=en-US']}
  let lastError, browser

  // try out a few different playwright 'channel's to see if we can get a browser running. If it fails, try the next
  for (let channel of channels) {
    try {
      browser = await chromium.launch({...launchOptions, ...channel})
      break
    } catch (err) {
      lastError = err
    }
  }

  // If all channels failed, it's most likely because you haven't installed playwright's chromium, so give that instruction
  let message = lastError instanceof Error ? lastError.message : String(lastError)
  if (lastError && (message.includes('Executable doesn') || message.includes('browserType.launch'))) {
    throw new Error('Failed to launch headless browser. Run `graphene install-browser` before using `graphene run --headless`.')
  } else if (lastError) {
    throw new Error(`Failed to launch headless browser: ${message}`)
  }

  try {
    let context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC', colorScheme: 'light', reducedMotion: 'reduce'})
    let page = await context.newPage()
    await page.goto(pageUrl)
    let response = await page.evaluate(request => window.$GRAPHENE.runPageRequest(request), request)
    await context.close()
    return response
  } finally {
    await browser.close()
  }
}

let browserConnections: {url: string; socket: WebSocket}[] = []
let pendingRequests: Record<string, ServerResponse<IncomingMessage>> = {}

// This plugin allows us to proxy requests from the Graphene CLI to a Graphene page running in a browser.
// It works because every Graphene tab opens a websocket connection back to the vite server. We keep track of each tab,
// and forward requests to /_api/run to the appropriate tab.
export function runVitePlugin(): PluginOption {
  return {
    name: 'graphene-run-plugin',
    configureServer(server: ViteDevServer) {
      let wss = new WebSocketServer({noServer: true})

      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (!req.url || (!req.url.includes('/_api/ws') && !req.url.includes('graphene-ws'))) return
        wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req))
      })

      wss.on('connection', socket => {
        socket.on('message', data => {
          let message = JSON.parse(data.toString()) as SocketRegistration | PageResponse
          if ('type' in message && message.type === 'register') {
            let normalizedUrl = message.url.replace(/\/$/, '')
            browserConnections.push({url: normalizedUrl, socket})
          }
          if ('requestId' in message && message.requestId) {
            pendingRequests[message.requestId]?.end(JSON.stringify(message))
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
        if (pathName === '/_api/run') await proxyRunRequest(req, res)
        else next()
      })
    },
  }
}

// Request handler for /_api/run. Finds the appropriate websocket and forwards the request along to it
export async function proxyRunRequest(req: IncomingMessage, res: ServerResponse<IncomingMessage>): Promise<void> {
  let chunks: Buffer[] = []
  for await (let chunk of req) chunks.push(Buffer.from(chunk))
  let {pageUrl, request} = JSON.parse(Buffer.concat(chunks).toString())
  request.requestId = Math.random().toString(36).slice(2)
  res.setHeader('Content-Type', 'application/json')

  let conn = await pollFor(() => browserConnections.find(conn => conn.url === pageUrl), 5000, 100)
  if (!conn) {
    res.statusCode = 400
    res.end(JSON.stringify({error: 'no_tab'}))
    return
  }

  conn.socket.send(JSON.stringify(request))
  pendingRequests[request.requestId] = res
}
