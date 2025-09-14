import {loadWorkspace, config, clearWorkspace, analyze, getDiagnostics, toSql} from '@graphene/lang'
import {createServer, type ViteDevServer} from 'vite'
import {evidenceThemes} from '@evidence-dev/tailwind/vite-plugin'
import {svelte, vitePreprocess} from '@sveltejs/vite-plugin-svelte'
import {visit} from 'unist-util-visit'
import fs from 'fs-extra'
// import sveltePreprocess from 'svelte-preprocess' // this would be nice, but it breaks sourcemaps by default
import {getConnection} from './connection.ts'
import {IncomingMessage, ServerResponse} from 'http'
import {mdsvex} from 'mdsvex'
import path from 'path'
import autoImport from 'sveltekit-autoimport'
import tailwindcss from '@tailwindcss/vite'
import {fileURLToPath} from 'url'

let grapheneRoot: string
let cliRoot: string

export async function serve2 () {
  grapheneRoot = process.cwd()
  cliRoot = path.join(fileURLToPath(import.meta.url), '..')

  let server = await createServer({
    root: grapheneRoot,
    plugins: [
      tailwindcss(),
      svelte({
        extensions: ['.svelte', '.md'],
        preprocess: [
          vitePreprocess(),
          mdsvex({
            extensions: ['.md'],
            remarkPlugins: [extractQueries],
            rehypePlugins: [rehypeMdxJsxToHtml],
            layout: path.resolve(cliRoot, '../ui/layout.svelte'),
          }) as any,
          injectComponentImports(),
        ],
      }),
      handleRequestPlugin,
      evidenceThemes(),
      dollarResolver,
      updateWorkspacePlugin,
    ],
    server: {
      port: config.port || 4000,
      fs: {strict: false},
    },
    optimizeDeps: {
      // include: ['echarts-stat', 'echarts', 'blueimp-md5', 'nanoid', '@uwdata/mosaic-sql', '@evidence-dev/core-components', '@evidence-dev/component-utilities/stores', '@evidence-dev/component-utilities/formatting', '@evidence-dev/component-utilities/globalContexts', '@evidence-dev/sdk/utils/svelte', '@evidence-dev/component-utilities/profile', '@evidence-dev/sdk/usql', '@evidence-dev/component-utilities/buildQuery', 'debounce', '@duckdb/duckdb-wasm'],
      exclude: ['svelte-icons', '@evidence-dev/universal-sql', '$evidence/config', '$evidence/themes', '$app/environment', '$app/navigation', '$app/forms', '$app/stores'],
    },
    ssr: {
      // external: ['@evidence-dev/telemetry', 'blueimp-md5', 'nanoid', '@uwdata/mosaic-sql', '@evidence-dev/sdk/plugins'],
    },
  })

  await server.listen()
  console.log(`Server running at ${server.resolvedUrls?.local?.[0]}`)
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
      workspaceLoadPromise = loadWorkspace(grapheneRoot)
    })
    workspaceLoadPromise = loadWorkspace(grapheneRoot)
  },
}

const handleRequestPlugin = {
  name: 'handleRequest',
  configureServer: (s: ViteDevServer) => {
    s.middlewares.use(async function handleRequest (req, res, next) {
      let [pathName] = (req.url || '').split('?')
      if (pathName == '/graphene/query') return handleQuery(req, res)

      if (!pathName || pathName == '/') pathName = 'index'
      let mdPath = path.join(grapheneRoot, pathName + '.md')

      if (await fs.exists(mdPath)) {
        handlePage(s, res, mdPath)
      } else {
        next()
      }
    })
  },
}

async function handleQuery (req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
  let chunks = [] as any[]
  for await (let chunk of req) chunks.push(chunk)
  let {gsql} = JSON.parse(Buffer.concat(chunks).toString())
  res.setHeader('Content-Type', 'application/json')

  await workspaceLoadPromise
  let queries = analyze(gsql)

  if (getDiagnostics().length) {
    res.statusCode = 400
    res.end(JSON.stringify(getDiagnostics()))
    return
  }

  try {
    let sql = toSql(queries[0])
    let connection = await getConnection()
    let queryResults = await connection.runSQL(sql)
    res.end(JSON.stringify(queryResults.rows))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({error: err.message}))
  }
}

async function handlePage (server: ViteDevServer, res: ServerResponse<IncomingMessage>, mdPath: string) {
  res.setHeader('Content-Type', 'text/html')
  let html = await server.transformIndexHtml(mdPath, `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Graphene</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300..800&display=swap" rel="stylesheet">
    </head>
    <body>
      <div id="app"></div>
      <script type="module" src="/node_modules/@graphene/ui/web.js"></script>
      <script type="module">
        import Page from ${JSON.stringify(mdPath)};
        new Page({ target: document.getElementById('app'), props: {} })
      </script>
    </body>
  </html>`)
  return res.end(html)
}

// Evidence expects some of these imports, but afaict they don't do anything, so stub them.
let dollarResolver = {
  name: 'dollar-resolver',
  resolveId (id) {
    return ['$evidence/config', '$app/environment', '$app/navigation', '$app/forms', '$app/stores'].includes(id) ? '\0' + id : null
  },
  load: (id) => {
    if (id === '\0$evidence/config') return 'export const config = {}'
    if (id === '\0$app/environment') return 'export const browser = true; export const version = 0; export const dev = true; export const building = false;'
    if (id === '\0$app/navigation') return 'export const browser = true; export const afterNavigate = () => {}; export function goto () {}; export function preloadData() {};'
    if (id === '\0$app/forms') return 'export const enhance = () => {};'
    if (id === '\0$app/stores') return 'export const page = \'page\'; export const navigating = false;'
    return null
  },
}

// Turn gsql code fences into GrapheneQuery components
function extractQueries () {
  return function transformer (tree) {
    visit(tree, 'code', (node, index, parent) => {
      if (index === null) return
      // let attributes = [{type: 'mdxJsxAttribute', name: 'name', value: node.meta}, {type: 'mdxJsxAttribute', name: 'code', value: node.value.trim()}]
      // parent.children[index] = {type: 'mdxJsxFlowElement', name: 'GrapheneQuery', attributes, children: []}
      parent.children[index] = {type: 'html', value: `<GrapheneQuery name="${escapeHtml(node.meta)}" code="${escapeHtml(node.value.trim())}" />`}
    })
  }
}

function escapeHtml (str: string) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function rehypeMdxJsxToHtml () {
  return (tree) => {
    // add `markdown` class to all elements, which evidence's stying expects
    visit(tree, 'element', ({properties}) => {
      if (!properties) return
      if (!properties.className) properties.className = 'markdown'
      else properties.className += ' markdown'
    })
  }
}

// We don't want users to have to manually import components in their md files, so we auto-import them.
function injectComponentImports () {
  let mapping = {}
  for (let comp of ['GrapheneQuery', 'BarChart', 'AreaChart', 'LineChart', 'PieChart', 'Table', 'Row', 'BigValue']) {
    mapping[comp] = `import ${comp} from '${path.resolve(cliRoot, `../ui/components/${comp}.svelte`)}'`
  }

  // TODO: we should use `components` to load user components, and `module` to load our own from our package
  // components: [{directory: path.resolve(cliRoot, './node_modules/@graphene/ui/components'), flat: true}],
  let autoImporter = autoImport({include: ['**/*.(svelte|md)'], mapping})
  return {
    markup: async ({content, filename}) => {
      if (!filename.endsWith('.md')) return // only autoImport md files
      let importResults = await autoImporter // wait for autoImporter to init
      return importResults.markup({content, filename}) // modifies the code to add needed imports
    },
    style: () => {},
    script: () => {},
  }
}
