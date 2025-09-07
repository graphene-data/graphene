import path from 'path'
import fs from 'fs-extra'
import {createServer, type ViteDevServer} from 'vite'
import {loadWorkspace, clearWorkspace, analyze, getDiagnostics, toSql, config as langConfig} from '@graphene/lang'
import tailwindcss from '@tailwindcss/vite'
import {evidenceThemes} from '@evidence-dev/tailwind/vite-plugin'
import {svelte} from '@sveltejs/vite-plugin-svelte'
import {visit, SKIP} from 'unist-util-visit'
import remarkMdx from 'remark-mdx'
import {remark} from 'remark'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

// served UI bundle
const UI_ENTRY = 'node_modules/@graphene/ui/web.js'

let projectRoot: string

export async function startUiDevServer (root?: string) {
  projectRoot = root || process.cwd()

  let server = await createServer({
    configFile: false,
    root: projectRoot,
    plugins: [
      handleRequestPlugin,
      tailwindcss(),
      svelte({exclude: '**/components/**'}),
      svelte({include: '**/components/**', compilerOptions: {customElement: true}}),
      evidenceThemes(),
      dollarResolver,
    ],
    server: {
      port: 0, // let vite choose; tests will read the url
      fs: {strict: false},
    },
    optimizeDeps: {
      include: ['echarts-stat', 'echarts', 'blueimp-md5', 'nanoid', '@uwdata/mosaic-sql', '@evidence-dev/core-components', '@evidence-dev/component-utilities/stores', '@evidence-dev/component-utilities/formatting', '@evidence-dev/component-utilities/globalContexts', '@evidence-dev/sdk/utils/svelte', '@evidence-dev/component-utilities/profile', '@evidence-dev/sdk/usql', '@evidence-dev/component-utilities/buildQuery', 'debounce', '@duckdb/duckdb-wasm'],
      exclude: ['svelte-icons', '@evidence-dev/universal-sql', '$evidence/config', '$evidence/themes', '$app/environment', '$app/navigation', '$app/forms', '$app/stores'],
    },
  })

  await server.listen()
  return server
}

const handleRequestPlugin = {
  name: 'handleRequest',
  configureServer: (s: ViteDevServer) => {
    s.middlewares.use(async function handleRequest (req, res, next) {
      let [pathName] = (req.url || '').split('?')
      if (pathName === '/graphene/query') return handleQuery(req, res)
      if (!pathName || pathName == '/') pathName = 'index'
      let mdPath = path.join(projectRoot, pathName + '.md')

      if (await fs.exists(mdPath)) {
        handlePage(req, res, mdPath)
      } else {
        next()
      }
    })
  },
}

async function handleQuery (req, res) {
  let chunks = [] as any[]
  for await (let chunk of req) chunks.push(chunk)
  let buffer = Buffer.concat(chunks)
  let body = buffer.toString()
  let {gsql} = JSON.parse(body)
  res.setHeader('Content-Type', 'application/json')

  clearWorkspace()
  await loadWorkspace(projectRoot)
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

async function handlePage (_req, res, mdPath) {
  let md = await fs.readFile(mdPath, 'utf-8')
  let html = await remark()
    .use(remarkMdx)
    .use(remarkMdxGraphene)
    .use(remarkRehype, {passThrough: ['mdxJsxFlowElement', 'mdxJsxTextElement']})
    .use(rehypeMdxJsxToHtml)
    .use(rehypeStringify, {allowDangerousHtml: true})
    .process(md)

  res.end(`<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Graphene</title>
      <link href="node_modules/@graphene/ui/app.css" rel="stylesheet">
    </head>
    <body>
      <div id="app"></div>
      <script>
        window.__DOC_HTML = ${JSON.stringify(String(html))}
        window.__DOC_QUERIES = ${JSON.stringify(html.data.queries)}
      </script>
      <script type="module" src="${UI_ENTRY}"></script>
    </body>
  </html>`)
}

let components = ['barchart', 'areachart', 'linechart', 'table']

function remarkMdxGraphene () {
  return function transformer (tree, file) {
    file.data.queries = {} as Record<string, string>

    visit(tree, 'code', (node: any, index: number, parent: any) => {
      file.data.queries[node.meta] = (node.value || '').trim()
      parent.children.splice(index, 1)
      return [SKIP, index]
    })

    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node: any, index: number | null, parent: any) => {
      if (!node || !parent || typeof index !== 'number') return
      if (components.includes((node.name || '').toLowerCase())) {
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
    visit(tree, 'element', ({properties}) => {
      if (!properties) return
      if (!properties.className) properties.className = 'markdown'
      else properties.className += ' markdown'
    })

    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node: any, index: number, parent: any) => {
      if (!parent) return
      let attrs = (node.attributes || []).map((attr: any) => `${attr.name}="${attr.value}"`).join(' ')
      let children = (node.children || []).map((child: any) => child.value || '').join('')
      let tag = node.name
      parent.children[index] = {
        type: 'raw',
        value: `<${tag}${attrs ? ' ' + attrs : ''}>${children}</${tag}>`,
      }
    })
  }
}

