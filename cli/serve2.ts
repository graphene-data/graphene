import {loadWorkspace, config, clearWorkspace, analyze, getDiagnostics, toSql} from '../lang/core.ts'
import {createServer, optimizeDeps, type ViteDevServer} from 'vite'
import {svelte, vitePreprocess} from '@sveltejs/vite-plugin-svelte'
import {visit} from 'unist-util-visit'
import fs from 'fs-extra'
import crypto from 'crypto'
// import sveltePreprocess from 'svelte-preprocess' // this would be nice, but it breaks sourcemaps by default
import {type IncomingMessage, type ServerResponse} from 'http'
import {mdsvex} from 'mdsvex'
import path from 'path'
import {fileURLToPath} from 'url'
import {WebSocketServer, type WebSocket} from 'ws'
import {spawn} from 'child_process'
import {getConnection} from './connections/index.ts'

let grapheneRoot: string
let uiRoot: string

export async function serve2 (): Promise<ViteDevServer> {
  grapheneRoot = config.root
  uiRoot = path.join(fileURLToPath(import.meta.url), '../../ui')

  await fs.ensureDir(path.resolve(grapheneRoot, 'node_modules/.graphene'))
  await fs.writeFile(path.resolve(grapheneRoot, `node_modules/.graphene/${process.env.NODE_ENV == 'test' ? 'test' : 'serve'}.pid`), String(process.pid))

  let server = await createServer({
    root: config.root,
    plugins: [
      svelte({
        extensions: ['.svelte', '.md'],
        preprocess: [
          vitePreprocess(),
          mdsvex({
            extensions: ['.md'],
            remarkPlugins: [extractQueries],
            layout: path.resolve(uiRoot, 'layout.svelte'),
          }) as any,
          injectComponentImports(),
        ],
      }),
      handleRequestPlugin,
      updateWorkspacePlugin,
      mockFilesForTests(),
    ],
    server: {
      port: config.port,
      fs: {strict: false},
      strictPort: true,
    },
    resolve: {
      alias: {
        graphene: path.resolve(uiRoot, 'web.js'),
      },
    },
  })

  await optimizeDeps(server.config)

  await server.listen()

  console.log(`Server running at http://localhost:${config.port}`)
  return server
}

// Watch for changes to gsql files and reload the workspace.
// This reload blocks all requests, so we shouldn't ever analyze without a workspace.
let workspaceLoadPromise: Promise<void> | undefined
const updateWorkspacePlugin = {
  name: 'updateWorkspace',
  configureServer: (s: ViteDevServer) => {
    s.watcher.add('**/*.gsql')
    s.watcher.on('change', () => {
      clearWorkspace()
      workspaceLoadPromise = loadWorkspace(grapheneRoot, false)
    })
    workspaceLoadPromise = loadWorkspace(grapheneRoot, false)
  },
}

const handleRequestPlugin = {
  name: 'handleRequest',
  configureServer: (s: ViteDevServer) => {
    let wss = new WebSocketServer({noServer: true})
    s.httpServer!.on('upgrade', (req, socket, head) => {
      if (!req.url?.endsWith('/graphene-ws')) return
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    })

    wss.on('connection', (socket) => {
      socket.on('message', (data) => {
        let message = JSON.parse(data.toString())
        if (message.type === 'register') {
          browserConnections.push({url: message.url, socket})
        }
        if (message.type === 'viewResponse') {
          viewRequests[message.requestId].response.end(JSON.stringify(message))
          delete viewRequests[message.requestId]
        }
      })
      socket.on('close', () => browserConnections = browserConnections.filter(conn => conn.socket !== socket))
    })

    s.middlewares.use(async function handleRequest (req, res, next) {
      try {
        let [pathName] = (req.url || '').split('?')
        if (pathName == '/_api/query') return await handleQuery(req, res)
        if (pathName == '/graphene/view') return await handleView(req, res)
        if (pathName == '/__ct') return await handlePage(s, res, '__ct', false)

        if (!pathName || pathName == '/') pathName = 'index'
        let mdPath = path.join(grapheneRoot, pathName + '.md')

        if (await fs.exists(mdPath)) {
          await handlePage(s, res, mdPath, true)
        } else {
          next()
        }
      } catch (err) {
        console.error(err)
        res.statusCode = 500
        res.end(JSON.stringify([{message: err.message, stack: err.stack}]))
      }
    })
  },
}

async function handleQuery (req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
  let chunks = [] as any[]
  for await (let chunk of req) chunks.push(chunk)
  let {gsql, params, hashes} = JSON.parse(Buffer.concat(chunks).toString())
  res.setHeader('Content-Type', 'application/json')

  await workspaceLoadPromise
  let queries = analyze(gsql)

  if (getDiagnostics().length) {
    res.statusCode = 400
    res.end(JSON.stringify(getDiagnostics()))
    return
  }

  if (queries.length > 1) throw new Error('Found multiple queries, which could be a parsing error')
  let sql = toSql(queries[0], params)

  // If the client already has this data, dont run the query
  let hash = crypto.createHash('SHA1').update(sql).digest('hex')
  res.setHeader('ETag', hash)
  if (hashes.includes(hash) && req.headers['cache-control'] != 'no-cache') {
    res.statusCode = 304
    return res.end()
  }

  let connection = await getConnection()
  let queryResults = await connection.runQuery(sql)
  let totalRows = queryResults.totalRows ?? queryResults.rows.length
  if (totalRows > queryResults.rows.length) throw new Error('Query returns too many rows')
  let fields = queries[0].fields.map(f => ({name: f.name, type: f.type}))
  res.end(JSON.stringify({rows: queryResults.rows, hash, fields, sql}))
}

let browserConnections: {url: string, socket: WebSocket}[] = [] // sockets for all open tabs
let viewRequests: Record<string, {response: ServerResponse<IncomingMessage>}> = {} // outstanding requests

async function handleView (req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
  let chunks = [] as any[]
  for await (let chunk of req) chunks.push(chunk)
  let {mdFile, chart} = JSON.parse(Buffer.concat(chunks).toString())
  let id = Math.random().toString(36).slice(2) // random id string
  res.setHeader('Content-Type', 'application/json')
  viewRequests[id] = {response: res}

  // Remove .md extension if provided and ensure it's just the filename
  let pageUrl = '/' + mdFile.replace(/\.md$/, '').replace(/^\//, '')
  if (pageUrl === '/index') pageUrl = '/'
  pageUrl = `http://localhost:${config.port || 4000}${pageUrl}`

  // Check for existing WebSocket connections. Open a page if we don't find one.
  let conn = browserConnections.find(conn => conn.url === pageUrl)
  if (!conn) {
    spawn('open', [pageUrl])
    let end = Date.now() + 5000
    while (Date.now() < end && !conn) {
      conn = browserConnections.find(conn => conn.url === pageUrl)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (!conn) {
      res.statusCode = 500
      return res.end(JSON.stringify({error: 'No browser tab available and failed to open one'}))
    }
  }
  conn.socket.send(JSON.stringify({type: 'view', chart, requestId: id}))
}


async function handlePage (server: ViteDevServer, res: ServerResponse<IncomingMessage>, filePath: string, mount: boolean) {
  res.setHeader('Content-Type', 'text/html')

  let mdMount = mount ? `
    import Page from ${JSON.stringify(filePath)};
    new Page({ target: document.getElementById('app'), props: {} })
  ` : ''

  let html = await server.transformIndexHtml(filePath, `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Graphene</title>
      <link rel="icon" href="@graphenedata/ui/assets/favicon.ico" />
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">
    </head>
    <body>
      <div id="app"></div>
      <script type="module">
        // do this first so we can track errors caused by importing the md file
        import 'graphene'
      </script>
      <script type="module">
        ${mdMount}
      </script>
    </body>
  </html>`)
  return res.end(html)
}

// Turn gsql code fences into GrapheneQuery components
function extractQueries () {
  function escapeHtml (str: string) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  return function transformer (tree) {
    visit(tree, 'code', (node, index, parent) => {
      if (index === null) return
      // let attributes = [{type: 'mdxJsxAttribute', name: 'name', value: node.meta}, {type: 'mdxJsxAttribute', name: 'code', value: node.value.trim()}]
      // parent.children[index] = {type: 'mdxJsxFlowElement', name: 'GrapheneQuery', attributes, children: []}
      parent.children[index] = {type: 'html', value: `<GrapheneQuery name="${escapeHtml(node.meta)}" code="${escapeHtml(node.value.trim())}" />`}
    })
  }
}

// We don't want users to have to manually import components in their md files, so we auto-import them.
function injectComponentImports () {
  let files = fs.readdirSync(path.join(uiRoot, 'components'))
  let componentNames = files.map(f => path.basename(f, '.svelte')).filter(f => !f.startsWith('_'))
  let imp = `const {${componentNames.join(', ')}} = window.$GRAPHENE.components`

  return {
    markup: ({content, filename}) => {
      if (!filename.endsWith('.md')) return // only auto-import components for md files
      content = content.replace('<script>', `<script>\n${imp}`)
      return {code: content}
    },
    style: () => {},
    script: () => {},
  }
}

export const mockFileMap: Record<string, string> = {}
function mockFilesForTests () {
  if (process.env.NODE_ENV !== 'test') return null

  return {
    name: 'mock-files-for-tests',
    enforce: 'pre' as const,
    resolveId (id) {
      if (mockFileMap[id.replace(grapheneRoot, '')]) return id + '?mock'
    },
    load (id) {
      if (!id.endsWith('?mock')) return null
      return mockFileMap[id.replace(grapheneRoot, '').replace(/\?mock$/, '')]
    },
  }
}
