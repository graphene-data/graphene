import {svelte, vitePreprocess} from '@sveltejs/vite-plugin-svelte'
import crypto from 'crypto'
import fs from 'fs-extra'
// import sveltePreprocess from 'svelte-preprocess' // this would be nice, but it breaks sourcemaps by default
import {type IncomingMessage, type ServerResponse} from 'http'
import {mdsvex} from 'mdsvex'
import {createRequire} from 'module'
import path from 'path'
import {fileURLToPath} from 'url'
import {createServer, type InlineConfig, optimizeDeps, resolveConfig, type ViteDevServer} from 'vite'

import type {AnalysisResult, WorkspaceFileInput} from '../lang/types.ts'

import {config} from '../lang/config.ts'
import {analyzeWorkspace, loadWorkspace, toSql} from '../lang/core.ts'
import {runQuery} from './connections/index.ts'
import {extractFrontmatter, injectComponentImports, remarkPlugins, rehypePlugins} from './mdCompile.ts'
import {mockFileMap} from './mockFiles.ts'
import {runVitePlugin} from './run.ts'
import {getWorkspaceScanCounts, type CliTelemetry} from './telemetry/index.ts'

// Collect Svelte compiler warnings for test assertions
export type SvelteWarning = {code: string; message: string; filename?: string}
export const svelteWarnings: SvelteWarning[] = []
export function clearSvelteWarnings() {
  svelteWarnings.length = 0
}

// Bump this whenever the query response shape changes so client caches invalidate.
const QUERY_VERSION = 1

let uiRoot: string
let nodeRequire = createRequire(import.meta.url)

export async function serve2(telemetry?: CliTelemetry): Promise<ViteDevServer> {
  let server = await createServer(await createConfig(telemetry))
  // I originally added this to avoid the page refreshing immediately on load.
  // We def don't want to run it in tests, because its not safe to do in parallel.
  // I'm not sure it's still needed, now that we explicitly list out `optimizeDeps.includes`, refreshes should be rare
  // await optimizeDeps(server.config, true)
  await server.listen()
  console.log(`Server running at http://localhost:${server.config.server.port}`)

  return server
}

async function createConfig(telemetry?: CliTelemetry): Promise<InlineConfig> {
  uiRoot = path.join(fileURLToPath(import.meta.url), '../../ui')
  let port = Number(process.env.GRAPHENE_PORT) || 4000
  let svelteRoot = path.dirname(nodeRequire.resolve('svelte/package.json'))
  let sveltePackage = nodeRequire('svelte/package.json')
  let svelteDependencyRoot = path.dirname(svelteRoot)
  let svelteExport = (name: string) => path.join(svelteRoot, sveltePackage.exports[name].browser || sveltePackage.exports[name].default)
  let packaged = path.basename(path.dirname(uiRoot)) == 'dist'
  await fs.ensureDir(path.resolve(config.root, 'node_modules/.graphene'))

  // Bind to 0.0.0.0 when running in a container so port forwarding works from the host
  let inContainer = fs.existsSync('/.dockerenv')
  let host = inContainer ? '0.0.0.0' : '127.0.0.1'

  return {
    root: config.root,
    logLevel: process.env.NODE_ENV == 'test' ? 'silent' : 'info',
    plugins: [
      svelte({
        configFile: false,
        extensions: ['.svelte', '.md'],
        preprocess: [
          vitePreprocess(),
          mdsvex({
            extensions: ['.md'],
            remarkPlugins,
            rehypePlugins,
          }) as any,
          injectComponentImports(),
        ],
        onwarn(warning, defaultHandler) {
          if (process.env.NODE_ENV === 'test') {
            svelteWarnings.push({code: warning.code, message: warning.message, filename: warning.filename})
          }
          defaultHandler?.(warning) // Still call the default handler to print warnings
        },
      }),
      fixSvelteDepsInTests(),
      fixHmrForFailedModules(),
      runVitePlugin(),
      handleRequestPlugin,
      updateWorkspacePlugin(telemetry),
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
      hmr: {overlay: false}, // we handle compilation errors ourselves (see LocalApp.svelte)
    },
    resolve: {
      alias: [
        {find: /^graphene$/, replacement: path.resolve(uiRoot, 'web.js')},
        // Vite runs in a user project, but svelte is a direct dependency of the cli, and thus transitive to the user project.
        // So when Vite tries to resolve `svelte` from a compiled md page, it can't find it without these aliases.
        {find: /^svelte$/, replacement: svelteExport('.')},
        {find: /^svelte\/animate$/, replacement: svelteExport('./animate')},
        {find: /^svelte\/attachments$/, replacement: svelteExport('./attachments')},
        {find: /^svelte\/easing$/, replacement: svelteExport('./easing')},
        {find: /^svelte\/events$/, replacement: svelteExport('./events')},
        {find: /^svelte\/internal$/, replacement: svelteExport('./internal')},
        {find: /^svelte\/internal\/client$/, replacement: svelteExport('./internal/client')},
        {find: /^svelte\/internal\/disclose-version$/, replacement: svelteExport('./internal/disclose-version')},
        {find: /^svelte\/internal\/flags\/async$/, replacement: svelteExport('./internal/flags/async')},
        {find: /^svelte\/internal\/flags\/legacy$/, replacement: svelteExport('./internal/flags/legacy')},
        {find: /^svelte\/internal\/flags\/tracing$/, replacement: svelteExport('./internal/flags/tracing')},
        {find: /^svelte\/legacy$/, replacement: svelteExport('./legacy')},
        {find: /^svelte\/motion$/, replacement: svelteExport('./motion')},
        {find: /^svelte\/reactivity$/, replacement: svelteExport('./reactivity')},
        {find: /^svelte\/reactivity\/window$/, replacement: svelteExport('./reactivity/window')},
        {find: /^svelte\/store$/, replacement: svelteExport('./store')},
        {find: /^svelte\/transition$/, replacement: svelteExport('./transition')},
        {find: /^clsx$/, replacement: path.join(svelteDependencyRoot, 'clsx/dist/clsx.mjs')},
      ],
    },

    optimizeDeps: {
      noDiscovery: process.env.NODE_ENV == 'test', // tests manually optimize before starting test workers
      exclude: ['virtual:nav'], // provided by a plugin, so don't try and optimize it
      // Vite running in a user project will not naturally discover and optimize these transitive deps.
      // When you launch the server, your first page load will automatically refresh after a second or two as Vite now sees and optimizes these.
      // This line makes it do that up-front, avoiding that reload jank. The packaged CLI also pre-bundles the `graphene` alias itself;
      // doing that from source causes trouble in examples/tests because the alias points outside node_modules.
      // `graphene` here is a special case: when packaged up it is considered a dependency, but in examples/tests, including it would cause errors.
      // oxfmt-ignore
      include: [
        ...(packaged ? ['graphene'] : []),
        '@graphenedata/cli > svelte',
        '@graphenedata/cli > chroma-js',
        '@graphenedata/cli > echarts',
        '@graphenedata/cli > @graphenedata/html2canvas',
        '@graphenedata/cli > @graphenedata/ui > svelte',
        '@graphenedata/cli > @graphenedata/ui > chroma-js',
        '@graphenedata/cli > @graphenedata/ui > echarts/dist/echarts.esm.js',
        '@graphenedata/cli > @graphenedata/ui > @graphenedata/html2canvas',
      ],
    },
  }
}

async function handleQuery(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
  let chunks = [] as any[]
  for await (let chunk of req) chunks.push(chunk)
  let {gsql, params, hashes} = JSON.parse(Buffer.concat(chunks).toString())
  res.setHeader('Content-Type', 'application/json')

  await workspaceLoadPromise

  // queries should not analyze md files
  let gsqlFiles = workspaceFiles.filter(file => !file.path.endsWith('.md'))
  let result = analyzeWorkspace({config, files: [...gsqlFiles, {path: 'input', contents: gsql}]})
  updateParsedFiles(result)

  let diagnostics = result.diagnostics
  if (diagnostics.length) {
    res.statusCode = 400
    res.end(JSON.stringify(diagnostics[0]))
    return
  }

  let queries = result.files.find(file => file.path == 'input')?.queries || []
  if (queries.length > 1) throw new Error('Found multiple queries, which could be a parsing error')
  let sql = toSql(queries[0], params)

  // If the client already has this data, dont run the query
  let hash = crypto.createHash('SHA1').update(`query-v${QUERY_VERSION}|${sql}`).digest('hex')
  res.setHeader('ETag', hash)
  if (hashes.includes(hash) && req.headers['cache-control'] != 'no-cache') {
    res.statusCode = 304
    return res.end()
  }

  let queryResults = await runQuery(sql)
  let totalRows = queryResults.totalRows ?? queryResults.rows.length
  if (totalRows > queryResults.rows.length) throw new Error('Query returns too many rows')
  let fields = queries[0].fields.map(field => ({name: field.name, type: field.type, metadata: field.metadata || {}}))
  res.end(JSON.stringify({rows: queryResults.rows, hash, fields, sql}))
}

async function handlePage(server: ViteDevServer, res: ServerResponse<IncomingMessage>) {
  res.setHeader('Content-Type', 'text/html')

  // Use a .html URL for transformIndexHtml so Vite doesn't run the svelte plugin on our HTML template.
  let html = await server.transformIndexHtml(
    '/index.html',
    `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Graphene</title>
      <link rel="icon" href="/favicon.ico" />
    </head>
    <body>
      <script type="module">
        import 'graphene'
      </script>
    </body>
  </html>`,
  )
  return res.end(html)
}

// Runs vite's pre-bundling of dependencies. Used by tests to do this once, instead of for each worker.
export async function prepareDeps() {
  let cfg = await resolveConfig(await createConfig(), 'serve')
  await optimizeDeps(cfg, true)
}

// Svelte forces optimizeDeps whenever its own metadata has changed.
// For tests, we already optimizeDeps before any tests start up, so we don't need this, and it causes problems
// if multiple workers are all trying to optimizeDeps at the same time (vite isn't exactly concurrency-safe).
function fixSvelteDepsInTests() {
  let viteConfig: any

  function configResolved(cfg: any) {
    viteConfig = cfg
  }

  // This must run AFTER Svelte's buildStart which sets force=true based on metadata changes.
  // Using enforce:'post' and sequential:true ensures we run last and can override.
  function buildStart() {
    if (process.env.NODE_ENV != 'test') return
    viteConfig.optimizeDeps.force = false
  }
  buildStart.sequential = true // force running after other sequential hooks (like svelte's)
  return {name: 'fix-svelte-deps', enforce: 'post' as const, configResolved, buildStart}
}

// When a module's transform fails (e.g. Svelte compilation error in an md file), Vite's import analysis
// never runs on it, leaving `isSelfAccepting` as undefined. Vite's `propagateUpdate` silently skips
// unanalyzed modules, so fixing the file produces no HMR update and the page stays broken.
// We detect this and send a full-reload instead, since the module was never successfully loaded
// and can't be hot-swapped.
function fixHmrForFailedModules() {
  return {
    name: 'fix-hmr-for-failed-modules',
    hotUpdate(this: any, {modules}: {modules: any[]}) {
      // When a module's last transform failed, its transformResult is null. Vite's normal HMR can't
      // hot-swap a module that has no valid transform — either because it was never analyzed
      // (isSelfAccepting === undefined) or because it was previously working but is now broken.
      // In both cases, force a full page reload so the browser re-requests everything fresh.
      let hasFailed = modules.some(m => !m.transformResult)
      if (hasFailed) {
        this.environment.hot.send({type: 'full-reload', path: '*'})
        return []
      }
    },
  }
}

// Watch for changes to gsql files and reload the workspace.
// This reload blocks all requests, so we shouldn't ever analyze without a workspace.
// Also tracks all the md files in the workspace to populate the nav sidebar
let workspaceLoadPromise: Promise<void> | undefined
let workspaceFiles: WorkspaceFileInput[] = []
let mdFiles: {path: string; title?: string}[] = []
function updateWorkspacePlugin(telemetry?: CliTelemetry) {
  return {
    name: 'updateWorkspace',
    resolveId(id: string) {
      if (id == 'virtual:nav') return '\0virtual:nav'
    },
    load(id: string) {
      if (id != '\0virtual:nav') return

      // in tests, inject mock files into the nav.
      // we do this on `load` as each test doesn't always refresh the workspace
      // TODO, we should prob inject these into `loadWorkspace`, then we wouldn't need this block at all
      let res = [...mdFiles]
      if (process.env.NODE_ENV == 'test') {
        for (let [path, contents] of Object.entries(mockFileMap)) {
          let mockFile = {path, title: extractFrontmatter(contents).title}
          let idx = res.findIndex(file => file.path == path)
          if (idx >= 0) res.splice(idx, 1, mockFile)
          else res.push(mockFile)
        }
      }

      return `export default ${JSON.stringify(res)}`
    },
    configureServer: (s: ViteDevServer) => {
      let refresh = async () => {
        workspaceLoadPromise = (async () => {
          let loaded = await loadWorkspace(config.root, true, config.ignoredFiles)
          telemetry?.event('workspace_scanned', {command: 'serve', ...getWorkspaceScanCounts(loaded)})
          workspaceFiles = loaded.map(file => {
            let existing = workspaceFiles.find(existing => existing.path == file.path && existing.contents == file.contents)
            return existing?.parsed ? {...file, parsed: existing.parsed} : file
          })
        })()
        await workspaceLoadPromise

        // store md file path/title so we can serve it as virtual:nav for the sidebar
        mdFiles = workspaceFiles.filter(file => file.path.endsWith('.md')).map(f => ({path: f.path, title: extractFrontmatter(f.contents).title}))

        let mod = s.moduleGraph.getModuleById('\0virtual:nav')
        if (!mod) return
        s.reloadModule(mod) // triggers HMR of any `virtual:nav` imports
      }

      s.watcher.add(['**/*.gsql', '**/*.md'])
      s.watcher.on('all', refresh)
      refresh()
    },
  }
}

function updateParsedFiles(analysis: AnalysisResult) {
  workspaceFiles = workspaceFiles.map(file => {
    let analyzed = analysis.files.find(next => next.path == file.path)
    if (!analyzed) return file
    return {
      ...file,
      parsed: {
        tree: analyzed.tree!,
        virtualContents: analyzed.virtualContents,
        virtualToMarkdownOffset: analyzed.virtualToMarkdownOffset,
      },
    }
  })
}

const handleRequestPlugin = {
  name: 'handleRequest',
  configureServer: (s: ViteDevServer) => {
    s.middlewares.use(async function handleRequest(req, res, next) {
      try {
        let [pathName] = (req.url || '').split('?')
        if (pathName == '/_api/query') return await handleQuery(req, res)
        if (pathName) if (pathName == '/__ct' || pathName == '/_charts' || pathName == '/_styles') return await handlePage(s, res)

        if (!pathName || pathName == '/') pathName = 'index'
        let relativeMdPath = pathName.replace(/^\//, '') + '.md'
        let mdPath = path.join(config.root, relativeMdPath)

        if (mockFileMap[relativeMdPath] || (await fs.exists(mdPath))) {
          await handlePage(s, res)
        } else {
          next()
        }
      } catch (err: any) {
        if (process.env.NODE_ENV != 'test') console.error(err) // ignore in tests because they're noisy, and any unexpected errors should be captured by browserConsole.
        res.statusCode = 500
        res.end(JSON.stringify({message: err.message, stack: err.stack}))
      }
    })
  },
}

function mockFilesForTests() {
  if (process.env.NODE_ENV !== 'test') return null

  function toMockKey(id: string) {
    // Handle both absolute paths (/wt/.../index.md) and root-relative paths (/index.md)
    return id.replace(config.root + '/', '').replace(/^\//, '')
  }

  return {
    name: 'mock-files-for-tests',
    enforce: 'pre' as const,
    resolveId(id: any) {
      if (!mockFileMap[toMockKey(id)]) return
      // Always resolve to the absolute path so the module graph key matches
      // what updateMockFile emits via server.watcher (needed for HMR to work).
      return path.join(config.root, toMockKey(id)) + '?mock'
    },
    load(id: any) {
      if (!id.endsWith('?mock')) return null
      return mockFileMap[toMockKey(id.replace(/\?mock$/, ''))]
    },
  }
}
