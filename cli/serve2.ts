// import {grapheneRoot} from './cwdHack.ts'
import { loadWorkspace, config } from '@graphene/lang'
import { sveltekit } from '@sveltejs/kit/vite'
import path from 'path'
import fs from 'fs-extra'
import { createServer } from 'vite'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import {evidenceThemes} from '@evidence-dev/tailwind/vite-plugin'
import {configVirtual} from '@evidence-dev/sdk/build/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import sveltePreprocess from 'svelte-preprocess'
import MarkdownIt from 'markdown-it'

let cliRoot: string
let grapheneRoot: string

const mdIt = new MarkdownIt({ html: true, linkify: true, typographer: true })

export async function serve2 () {
  grapheneRoot = process.cwd()
  cliRoot = path.join(fileURLToPath(import.meta.url), '..')
  loadWorkspace(grapheneRoot)

  const server = await createServer({
    configFile: false, // ignore evidence's built in config file
    root: grapheneRoot,
    plugins: [
      handleRequestPlugin,
      tailwindcss(),
      svelte({ exclude: 'components/**'}), //  preprocess: sveltePreprocess(),
      svelte({ include: 'components/**', compilerOptions: { customElement: true }}), // preprocess: sveltePreprocess(),
      evidenceThemes(),
      dollarResolver,
    ],
    // build: {
    //   rollupOptions: {
    //     input: {
    //       app: path.join(grapheneRoot, 'app.svelte'),
    //     }
    //   }
    // },
    server: {
      port: config.port || 4000,
      fs: {strict: false},
    },
    optimizeDeps: {
      // include: ['echarts-stat', 'echarts', 'blueimp-md5', 'nanoid', '@uwdata/mosaic-sql', '@evidence-dev/core-components', '@evidence-dev/component-utilities/stores', '@evidence-dev/component-utilities/formatting', '@evidence-dev/component-utilities/globalContexts', '@evidence-dev/sdk/utils/svelte', '@evidence-dev/component-utilities/profile', '@evidence-dev/sdk/usql', '@evidence-dev/component-utilities/buildQuery', 'debounce', '@duckdb/duckdb-wasm', 'apache-arrow'],
      exclude: ['svelte-icons', '@evidence-dev/universal-sql', '$evidence/config', '$evidence/themes', '$app/environment', '$app/navigation', '$app/forms', '$app/stores'],
    },
    ssr: {
      // external: ['@evidence-dev/telemetry', 'blueimp-md5', 'nanoid', '@uwdata/mosaic-sql', '@evidence-dev/sdk/plugins'],
    },
  })

  await server.listen()
  console.log(`Server running at ${server.resolvedUrls?.local?.[0]}`)
}

const handleRequestPlugin = {name: 'handleRequest', configureServer: s => { s.middlewares.use(handleRequest) }}
async function handleRequest(req, res, next) {
  // console.log('handleRequest', req.url)
  let [pathName, queryString] = req.url.split('?')

  if (pathName == '/query') return handleQuery(req, res)

  if (!pathName || pathName == '/') pathName = 'index'
  let mdPath = path.join(grapheneRoot, pathName + '.md')

  if (await fs.exists(mdPath)) {
    handlePage(req, res, mdPath)
  } else {
    next()
  }
}

async function handleQuery(req, res) {
  let url = new URL(req.url)
  res.end(JSON.stringify([]))
}

async function handlePage(req, res, mdPath) {
  let md = await fs.readFile(mdPath, 'utf-8')
  let html = mdIt.render(md)

  res.end(`<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Graphene</title>
    </head>
    <body>
      <div id="app"></div>
      <script>window.__DOC_HTML = ${JSON.stringify(html)}</script>
      <script type="module" src="main.ts"></script>
    </body>
  </html>`)
}
let dollarResolver = {
  name: 'dollar-resolver',
  resolveId(id) {
    if (id === '$evidence/config') return `\0$evidence/config`;
    if (id === '$app/environment') return '\0$app/environment';
    if (id === '$app/navigation') return '\0$app/navigation';
    if (id === '$app/forms') return '\0$app/forms';
    if (id === '$app/stores') return '\0$app/stores';
    return null;
  },
  load: async (id) => {
    if (id === `\0$evidence/config`) {
      return `export const config = {}`;
    }
    if (id === `\0$app/environment`) {
      return `
        export const browser = true
        export const version = 0
        export const dev = true
        export const building = false
      `;
    }
    if (id === `\0$app/navigation`) {
      return `
        export const browser = true
        export const afterNavigate = () => {}
        export function goto () {}
        export function preloadData() {}
      `;
    }
    if (id === `\0$app/forms`) {
      return `
        export const enhance = () => {}
      `;
    }
    if (id === `\0$app/stores`) {
      return `
        export const page = 'page'
        export const navigating = false
      `;
    }
  }
}
