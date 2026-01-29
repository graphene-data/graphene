import {loadWorkspace, config, clearWorkspace, analyze, getDiagnostics, toSql} from '../lang/core.ts'
import {createServer, type InlineConfig, optimizeDeps, resolveConfig, type ViteDevServer} from 'vite'
import {svelte, vitePreprocess} from '@sveltejs/vite-plugin-svelte'
import fs from 'fs-extra'
import {glob} from 'glob'
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

// Collect Svelte compiler warnings for test assertions
export type SvelteWarning = {code: string, message: string, filename?: string}
export const svelteWarnings: SvelteWarning[] = []
export function clearSvelteWarnings () { svelteWarnings.length = 0 }

let uiRoot: string

export async function serve2 (): Promise<ViteDevServer> {
  let server = await createServer(await createConfig())
  // I originally added this to avoid the page refreshing immediately on load.
  // We def don't want to run it in tests, because its not safe to do in parallel.
  // I'm not sure it's still needed, now that we explicitly list out `optimizeDeps.includes`, refreshes should be rare
  // await optimizeDeps(server.config, true)
  await server.listen()
  console.log(`Server running at http://localhost:${server.config.server.port}`)

  return server
}

async function createConfig (): Promise<InlineConfig> {
  uiRoot = path.join(fileURLToPath(import.meta.url), '../../ui')
  let port = Number(process.env.GRAPHENE_PORT) || 4000
  await fs.ensureDir(path.resolve(config.root, 'node_modules/.graphene'))

  // Bind to 0.0.0.0 when running in a container so port forwarding works from the host
  let inContainer = fs.existsSync('/.dockerenv')
  let host = inContainer ? '0.0.0.0' : '127.0.0.1'

  return {
    root: config.root,
    plugins: [
      svelte({
        configFile: false,
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
        onwarn (warning, defaultHandler) {
          if (process.env.NODE_ENV === 'test') {
            svelteWarnings.push({code: warning.code, message: warning.message, filename: warning.filename})
          }
          defaultHandler?.(warning) // Still call the default handler to print warnings
        },
      }),
      fixSvelteDepsInTests(),
      checkVitePlugin(),
      handleRequestPlugin,
      updateWorkspacePlugin,
      mockFilesForTests(),
    ],
    publicDir: path.resolve(uiRoot, 'public'),
    // on the fence about this one. This would make it less likely we need to optimize when alternating between dev and tests.
    // cacheDir: process.env.NODE_ENV == 'test' ? 'node_modules/.vite-tests' : 'node_modules/.vite',
    server: {
      port,
      host,
      fs: {strict: false},
      strictPort: true,
    },
    resolve: {
      alias: {
        graphene: path.resolve(uiRoot, 'web.js'),
      },
    },

    // vite's pre-bundling won't naturally discover these dependencies since they're transitive.
    // Instead, we need to list them out here so vite knows where they are.
    optimizeDeps: {
      noDiscovery: process.env.NODE_ENV == 'test', // tests manually optimize before starting test workers
      exclude: ['virtual:nav'],
      include: [
        '@graphenedata/cli > svelte',
        '@graphenedata/cli > ssf',
        '@graphenedata/cli > @tidyjs/tidy',
        '@graphenedata/cli > chroma-js',
        '@graphenedata/cli > echarts/dist/echarts.esm.js',
        '@graphenedata/cli > @graphenedata/html2canvas',
      ],
    },
  }
}

// Runs vite's pre-bundling of dependencies. Used by tests to do this once, instead of for each worker.
export async function prepareDeps () {
  let cfg = await resolveConfig(await createConfig(), 'serve')
  await optimizeDeps(cfg, true)
}

// Svelte forces optimizeDeps whenever its own metadata has changed.
// For tests, we already optimizeDeps before any tests start up, so we don't need this, and it causes problems
// if multiple workers are all trying to optimizeDeps at the same time (vite isn't exactly concurrency-safe).
function fixSvelteDepsInTests () {
  let viteConfig: any

  function configResolved (cfg:any) { viteConfig = cfg }

  function buildStart () {
    if (process.env.NODE_ENV != 'test') return
    viteConfig.optimizeDeps.force = false
  }
  buildStart.sequential = true // force running after svelte hook
  return {name: 'fix-svelte-deps', enforce: 'pre' as const, sequential: true, configResolved, buildStart}
}

// Watch for changes to gsql files and reload the workspace.
// This reload blocks all requests, so we shouldn't ever analyze without a workspace.
// Also tracks all the md files in the workspace to populate the nav sidebar
let workspaceLoadPromise: Promise<void> | undefined
let mdFiles: string[] = []
const updateWorkspacePlugin = {
  name: 'updateWorkspace',
  resolveId (id: string) {
    if (id == 'virtual:nav') return '\0virtual:nav'
  },
  load (id: string) {
    if (id != '\0virtual:nav') return
    let allFiles = [...mdFiles]
    if (process.env.NODE_ENV == 'test') {
      for (let key of Object.keys(mockFileMap)) {
        if (!allFiles.includes(key)) allFiles.push(key)
      }
    }
    return `export default ${JSON.stringify(allFiles)}`
  },
  configureServer: (s: ViteDevServer) => {
    let refresh = async () => {
      clearWorkspace()
      workspaceLoadPromise = loadWorkspace(config.root, false)
      mdFiles = await glob('**/*.md', {cwd: config.root, ignore: ['node_modules/**']})
      mdFiles = mdFiles.filter(f => !config.ignoredFiles?.includes(path.basename(f).toLowerCase()))
      if (process.env.NODE_ENV == 'test') {
        mdFiles.push(...Object.keys(mockFileMap))
      }

      let mod = s.moduleGraph.getModuleById('\0virtual:nav')
      if (!mod) return
      s.reloadModule(mod) // triggers HMR of any `virtual:nav` imports
    }

    s.watcher.add(['**/*.gsql', '**/*.md'])
    s.watcher.on('all', refresh)
    refresh()
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
        let relativeMdPath = pathName.replace(/^\//, '') + '.md'
        let mdPath = path.join(config.root, relativeMdPath)

        if (mockFileMap[relativeMdPath] || await fs.exists(mdPath)) {
          await handlePage(s, res, mdPath, true)
        } else {
          next()
        }
      } catch (err: any) {
        if (process.env.NODE_ENV != 'test') console.error(err) // ignore in tests because they're noisy, and any unexpected errors should be captured by browserConsole.
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
    import Page from ${JSON.stringify(filePath)}
    new Page({ target: document.getElementById('content'), props: {} })
  ` : ''

  let html = await server.transformIndexHtml(filePath, `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Graphene</title>
      <link rel="icon" href="/favicon.ico" />
    </head>
    <body>
      <nav id="nav"></nav>
      <main id="content"></main>
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
      let content = mockFileMap[id.replace(config.root + '/', '').replace(/\?mock$/, '')]
      return content
    },
  }
}
