import {grapheneRoot} from './cwdHack.ts'
import { loadWorkspace, config } from '@graphene/lang'
import { sveltekit } from '@sveltejs/kit/vite'
import path from 'path'
import fs from 'fs-extra'
import { createServer } from 'vite'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import {evidenceThemes} from '@evidence-dev/tailwind/vite-plugin'
import {configVirtual} from '@evidence-dev/sdk/build/vite'

let cliRoot: string
let evidenceRoot: string

export async function serve2 () {
  loadWorkspace(grapheneRoot)

  // create the evidence template dir and copy stuff over
  cliRoot = path.join(fileURLToPath(import.meta.url), '..')
  evidenceRoot = process.cwd()
  fs.emptyDirSync(evidenceRoot)
  fs.copySync(path.join(cliRoot, 'node_modules/@evidence-dev/evidence/template'), evidenceRoot)
  fs.copySync(path.join(cliRoot, 'svelte.config.js'), path.join(evidenceRoot, 'svelte.config.js'))
  fs.copySync(path.join(cliRoot, '+layout.js'), path.join(evidenceRoot, 'src/pages/+layout.js'))
  fs.copySync(path.join(grapheneRoot, 'pages/index.md'), path.join(evidenceRoot, 'src/pages/index.md'))

  const server = await createServer({
    configFile: false, // ignore evidence's built in config file
    // root: evidenceRoot, << ideally this, but sveltekit doesn't allow it, hence chdirHack
    plugins: [handleRequestPlugin, tailwindcss(), sveltekit(), configVirtual(), evidenceThemes()],
    server: {
      port: config.port || 4000,
      fs: {strict: false},
    },
    optimizeDeps: {
      include: ['echarts-stat', 'echarts', 'blueimp-md5', 'nanoid', '@uwdata/mosaic-sql', '@evidence-dev/core-components', '@evidence-dev/component-utilities/stores', '@evidence-dev/component-utilities/formatting', '@evidence-dev/component-utilities/globalContexts', '@evidence-dev/sdk/utils/svelte', '@evidence-dev/component-utilities/profile', '@evidence-dev/sdk/usql', '@evidence-dev/component-utilities/buildQuery', 'debounce', '@duckdb/duckdb-wasm', 'apache-arrow'],
      exclude: ['svelte-icons', '@evidence-dev/universal-sql', '$evidence/config', '$evidence/themes'],
    },
    ssr: {
      external: ['@evidence-dev/telemetry', 'blueimp-md5', 'nanoid', '@uwdata/mosaic-sql', '@evidence-dev/sdk/plugins'],
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
    res.end('helloWorld')
  } else {
    next()
  }
}

async function handleQuery(req, res) {
  let url = new URL(req.url)
  res.end(JSON.stringify([]))
}
