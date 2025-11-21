import {loadWorkspace, config, clearWorkspace, analyze, getDiagnostics, toSql} from '../lang/core.ts'
import {createServer, optimizeDeps, type ViteDevServer} from 'vite'
import {svelte, vitePreprocess} from '@sveltejs/vite-plugin-svelte'
import fs from 'fs-extra'
import crypto from 'crypto'
// import sveltePreprocess from 'svelte-preprocess' // this would be nice, but it breaks sourcemaps by default
import {type IncomingMessage, type ServerResponse} from 'http'
import {mdsvex} from 'mdsvex'
import path from 'path'
import {fileURLToPath} from 'url'
import {runQuery} from './connections/index.ts'
import {escapeAngles, extractQueries, injectComponentImports, sanitizeMarkdown} from './mdCompile.ts'
import {checkVitePlugin} from './check.ts'
import {mockFileMap} from './mockFiles.ts'

let uiRoot: string

export async function serve2 (): Promise<ViteDevServer> {
  uiRoot = path.join(fileURLToPath(import.meta.url), '../../ui')
  let port = Number(process.env.GRAPHENE_PORT) || 4000
  await fs.ensureDir(path.resolve(config.root, 'node_modules/.graphene'))

  let server = await createServer({
    root: config.root,
    plugins: [
      svelte({
        extensions: ['.svelte', '.md'],
        preprocess: [
          vitePreprocess(),
          mdsvex({
            extensions: ['.md'],
            remarkPlugins: [extractQueries, escapeAngles],
            rehypePlugins: [sanitizeMarkdown],
          }) as any,
          injectComponentImports(),
        ],
      }),
      checkVitePlugin(),
      handleRequestPlugin,
      updateWorkspacePlugin,
      mockFilesForTests(),
    ],
    publicDir: path.resolve(uiRoot),
    server: {
      port,
      fs: {strict: false},
      strictPort: true,
    },
    resolve: {
      alias: {
        graphene: path.resolve(uiRoot, 'web.js'),
      },
    },
    // optimizeDeps: { // this seems prudent in tests, but currently breaks because ssf needs to be optimized, even in tests
    //   noDiscovery: process.env.NODE_ENV == 'test',
    //   include: process.env.NODE_ENV == 'test' ? [] : undefined,
    // },
  })

  await optimizeDeps(server.config) // optimize before starting, so we don't have a reload immediately after loading the first page
  await server.listen()

  if (process.env.NODE_ENV !== 'test') {
    await fs.writeFile(path.resolve(config.root, 'node_modules/.graphene/serve.pid'), String(process.pid))
    console.log(`Server running at http://localhost:${port}`)
  }
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
      workspaceLoadPromise = loadWorkspace(config.root, false)
    })
    workspaceLoadPromise = loadWorkspace(config.root, false)
  },
}

const handleRequestPlugin = {
  name: 'handleRequest',
  configureServer: (s: ViteDevServer) => {
    s.middlewares.use(async function handleRequest (req, res, next) {
      try {
        let [pathName] = (req.url || '').split('?')
        if (pathName == '/_api/query') return await handleQuery(req, res)
        if (pathName == '/__ct') return await handlePage(s, res, '__ct', false)

        if (!pathName || pathName == '/') pathName = 'index'
        let mdPath = path.join(config.root, pathName + '.md')

        if (await fs.exists(mdPath)) {
          await handlePage(s, res, mdPath, true)
        } else {
          next()
        }
      } catch (err: any) {
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

  let queryResults = await runQuery(sql)
  let totalRows = queryResults.totalRows ?? queryResults.rows.length
  if (totalRows > queryResults.rows.length) throw new Error('Query returns too many rows')
  let fields = queries[0].fields.map(f => ({name: f.name, type: f.type}))
  res.end(JSON.stringify({rows: queryResults.rows, hash, fields, sql}))
}

async function handlePage (server: ViteDevServer, res: ServerResponse<IncomingMessage>, filePath: string, mount: boolean) {
  res.setHeader('Content-Type', 'text/html')

  let mdMount = mount ? `
    import Page from ${JSON.stringify(filePath)};
    new Page({ target: document.getElementById('content'), props: {} })
  ` : ''

  let html = await server.transformIndexHtml(filePath, `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Graphene</title>
      <link rel="icon" href="/assets/favicon.ico" />
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">
    </head>
    <body>
      <main>
        <div id="content"></div>
      </main>
      <script type="module">
        import 'graphene' // do this first so we can track errors caused by importing the md file
        ${mdMount}
      </script>
    </body>
  </html>`)
  return res.end(html)
}

function mockFilesForTests () {
  if (process.env.NODE_ENV !== 'test') return null

  return {
    name: 'mock-files-for-tests',
    enforce: 'pre' as const,
    resolveId (id: any) {
      if (mockFileMap[id.replace(config.root + '/', '')]) return id + '?mock'
    },
    load (id: any) {
      if (!id.endsWith('?mock')) return null
      return mockFileMap[id.replace(config.root + '/', '').replace(/\?mock$/, '')]
    },
  }
}
