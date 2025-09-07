import {loadWorkspace, config, clearWorkspace, analyze, getDiagnostics, toSql} from '@graphene/lang'
import path from 'path'
import fs from 'fs-extra'
import {createServer, type ViteDevServer} from 'vite'
import {fileURLToPath} from 'url'
import tailwindcss from '@tailwindcss/vite'
import {evidenceThemes} from '@evidence-dev/tailwind/vite-plugin'
import {svelte} from '@sveltejs/vite-plugin-svelte'
// import sveltePreprocess from 'svelte-preprocess' // this would be nice, but it breaks sourcemaps by default
import {visit, SKIP} from 'unist-util-visit'
import remarkMdx from 'remark-mdx'
import {remark} from 'remark'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import {getConnection} from './connection.ts'
import {IncomingMessage, ServerResponse} from 'http'

let cliRoot: string
let grapheneRoot: string

export async function serve2 () {
  grapheneRoot = process.cwd()
  cliRoot = path.join(fileURLToPath(import.meta.url), '..')

  let server = await createServer({
    configFile: false, // ignore evidence's built in config file
    root: grapheneRoot,
    plugins: [
      handleRequestPlugin,
      tailwindcss(),
      svelte({exclude: '**/components/**'}),
      svelte({include: '**/components/**', compilerOptions: {customElement: true}}),
      evidenceThemes(),
      dollarResolver,
    ],
    server: {
      port: config.port || 4000,
      fs: {strict: false},
    },
    optimizeDeps: {
      include: ['echarts-stat', 'echarts', 'blueimp-md5', 'nanoid', '@uwdata/mosaic-sql', '@evidence-dev/core-components', '@evidence-dev/component-utilities/stores', '@evidence-dev/component-utilities/formatting', '@evidence-dev/component-utilities/globalContexts', '@evidence-dev/sdk/utils/svelte', '@evidence-dev/component-utilities/profile', '@evidence-dev/sdk/usql', '@evidence-dev/component-utilities/buildQuery', 'debounce', '@duckdb/duckdb-wasm'],
      exclude: ['svelte-icons', '@evidence-dev/universal-sql', '$evidence/config', '$evidence/themes', '$app/environment', '$app/navigation', '$app/forms', '$app/stores'],
    },
    ssr: {
      // external: ['@evidence-dev/telemetry', 'blueimp-md5', 'nanoid', '@uwdata/mosaic-sql', '@evidence-dev/sdk/plugins'],
    },
  })

  await server.listen()
  console.log(`Server running at ${server.resolvedUrls?.local?.[0]}`)
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
        handlePage(req, res, mdPath)
      } else {
        next()
      }
    })
  },
}

async function handleQuery (req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
  let chunks = [] as any[]
  for await (let chunk of req) chunks.push(chunk)
  let buffer = Buffer.concat(chunks)
  let body = buffer.toString()
  let {gsql} = JSON.parse(body)
  res.setHeader('Content-Type', 'application/json')

  clearWorkspace()
  await loadWorkspace(grapheneRoot)
  let queries = analyze(gsql, 'input')

  if (getDiagnostics().length) {
    res.statusCode = 400
    res.end(JSON.stringify(getDiagnostics()))
    return
  }

  let sql = toSql(queries[0])
  let connection = await getConnection()
  let queryResults = await connection.runSQL(sql)
  res.end(JSON.stringify(queryResults.rows))
}

async function handlePage (req, res, mdPath) {
  let md = await fs.readFile(mdPath, 'utf-8')
  // let html = await unified()
  //   .use(remarkParse)
  //   .use(remarkRehype, {allowDangerousHtml: true}) // we'll sanitize later
  //   .use(rehypeRaw) // allows us to handle html nodes
  //   .use(remarkMdxGraphene)
  //   // .use(rehypeSanitize)
  //   .use(rehypeStringify) // HAST → HTML string
  //   .process(md)

  // I'm using remarkMdx here because it's more convenient to walk through elements before we convert to html.
  // The other approach would be to use a more standard remarkRehype approach, which would allow arbitrary html nodes.
  let html = await remark()
    .use(remarkMdx)
    .use(remarkMdxGraphene)
    .use(remarkRehype, {passThrough: ['mdxJsxFlowElement', 'mdxJsxTextElement']})
    .use(rehypeMdxJsxToHtml)
    .use(rehypeStringify, {allowDangerousHtml: true}) // HAST → HTML string
    .process(md)

  res.end(`<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Graphene</title>
      <link href="node_modules/@graphene/ui/app.css" rel="stylesheet">
      <!-- <link href="./index.css" rel="stylesheet"> -->
    </head>
    <body>
      <div id="app"></div>
      <script>
        window.__DOC_HTML = ${JSON.stringify(String(html))}
        window.__DOC_QUERIES = ${JSON.stringify(html.data.queries)}
      </script>
      <script type="module" src="node_modules/@graphene/ui/web.js"></script>
    </body>
  </html>`)
}

let dollarResolver = {
  name: 'dollar-resolver',
  resolveId (id) {
    if (id === '$evidence/config') return '\0$evidence/config'
    if (id === '$app/environment') return '\0$app/environment'
    if (id === '$app/navigation') return '\0$app/navigation'
    if (id === '$app/forms') return '\0$app/forms'
    if (id === '$app/stores') return '\0$app/stores'
    return null
  },
  load: (id) => {
    if (id === '\0$evidence/config') {
      return 'export const config = {}'
    }
    if (id === '\0$app/environment') {
      return `
        export const browser = true
        export const version = 0
        export const dev = true
        export const building = false
      `
    }
    if (id === '\0$app/navigation') {
      return `
        export const browser = true
        export const afterNavigate = () => {}
        export function goto () {}
        export function preloadData() {}
      `
    }
    if (id === '\0$app/forms') {
      return `
        export const enhance = () => {}
      `
    }
    if (id === '\0$app/stores') {
      return `
        export const page = 'page'
        export const navigating = false
      `
    }
  },
}

let components = ['barchart', 'areachart', 'linechart', 'table']

// Plugin to transform graphene-specific markdown. Extract sql blocks, rewrite/filter components
function remarkMdxGraphene () {
  return function transformer (tree, file) {
    file.data.queries = {} as Record<string, string>

    // Extract gsql queries, then remove them from the rendered html
    visit(tree, 'code', (node, index, parent) => {
      file.data.queries[node.meta] = node.value.trim()
      parent.children.splice(index, 1)
      return [SKIP, index]
    })

    // Rewrite <BarChart> to <graphene-barchart> (the naming is forced on us by web components)
    // We'll also drop any components that are not in the allowed list
    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node: any, index: number | null, parent: any) => {
      if (!node || !parent || typeof index !== 'number') return
      if (components.includes(node.name.toLowerCase())) {
        node.name = `graphene-${node.name}`
      } else {
        parent.children.splice(index, 1)
        return [SKIP, index]
      }
    })
  }
}

function rehypeMdxJsxToHtml () {
  return (tree) => {
    // add `markdown` class to all elements, which evidence's stying expects
    visit(tree, 'element', ({properties}) => {
      if (!properties) return
      if (!properties.className) properties.className = 'markdown'
      else properties.className += ' markdown'
    })

    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node, index, parent) => {
      if (!parent) return
      let attrs = (node.attributes || []).map(attr => `${attr.name}="${attr.value}"`).join(' ')
      let children = (node.children || []).map(child => child.value || '').join('')
      let tag = node.name
      parent.children[index as number] = {
        type: 'raw',
        value: `<${tag}${attrs ? ' ' + attrs : ''}>${children}</${tag}>`,
      }
    })
  }
}
