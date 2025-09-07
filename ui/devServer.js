import path from 'path'
import fs from 'fs-extra'
import * as fsNative from 'fs'
import {createServer} from 'vite'
import {fileURLToPath} from 'url'
import tailwindcss from '@tailwindcss/vite'
import {evidenceThemes} from '@evidence-dev/tailwind/vite-plugin'
import {svelte} from '@sveltejs/vite-plugin-svelte'
import {visit, SKIP} from 'unist-util-visit'
import remarkMdx from 'remark-mdx'
import {remark} from 'remark'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import {loadWorkspace, clearWorkspace, analyze, getDiagnostics, toSql, config as langConfig} from '@graphene/lang'

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const UI_ENTRY_ABS = path.join(thisDir, 'web.js')

let projectRoot

export async function startUiDevServer (root) {
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
      port: 0,
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
  configureServer: (s) => {
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
  let chunks = []
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
      <script type="module" src="/@fs/${UI_ENTRY_ABS}"></script>
    </body>
  </html>`)
}

let components = ['barchart', 'areachart', 'linechart', 'table']

function remarkMdxGraphene () {
  return function transformer (tree, file) {
    file.data.queries = {}
    visit(tree, 'code', (node, index, parent) => {
      file.data.queries[node.meta] = (node.value || '').trim()
      parent.children.splice(index, 1)
      return [SKIP, index]
    })
    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node, index, parent) => {
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
    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node, index, parent) => {
      if (!parent) return
      let attrs = (node.attributes || []).map(attr => `${attr.name}="${attr.value}"`).join(' ')
      let children = (node.children || []).map(child => child.value || '').join('')
      let tag = node.name
      parent.children[index] = {
        type: 'raw',
        value: `<${tag}${attrs ? ' ' + attrs : ''}>${children}</${tag}>`,
      }
    })
  }
}

const dollarResolver = {
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

async function getConnection () {
  if ((langConfig.dialect || 'duckdb') === 'duckdb') {
    let mod = await import('@malloydata/db-duckdb')
    let files = await fsNative.promises.readdir(projectRoot)
    let dbPath = files.find(f => f.endsWith('.duckdb'))
    if (!dbPath) throw new Error('No .duckdb file found in current directory')
    return new mod.DuckDBConnection('duckdb', path.join(projectRoot, dbPath))
  }
  if (langConfig.dialect === 'bigquery') {
    let mod = await import('@malloydata/db-bigquery')
    return new mod.BigQueryConnection('bigQuery')
  }
  throw new Error('No connection found')
}

export default {
  startUiDevServer,
}

