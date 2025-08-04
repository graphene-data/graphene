import {sveltekit} from '@sveltejs/kit/vite'
import {createLogger} from 'vite'
import {sourceQueryHmr, configVirtual, queryDirectoryHmr} from '@evidence-dev/sdk/build/vite'
import {isDebug} from '@evidence-dev/sdk/utils'
import {log} from '@evidence-dev/sdk/logger'
import {evidenceThemes} from '@evidence-dev/tailwind/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import {DuckDBInstance} from '@duckdb/node-api'
import {readdir} from 'node:fs/promises'
import * as path from 'node:path'
import {analyze, loadWorkspace} from '@graphene/lang'

let conn

async function connectDb () {
  if (conn) return

  let files = await readdir(path.join(__dirname, '../..'))
  let duckFiles = files.filter((file) => file.endsWith('.duckdb')).map(f => path.join(__dirname, '../..', f))
  console.log(duckFiles)
  if (duckFiles.length != 1) throw new Error(`Can only handle a single duckdb database, found: ${duckFiles}`)

  let db = await DuckDBInstance.create(duckFiles[0], {access_mode: 'READ_ONLY'})
  conn = await db.connect()
}

loadWorkspace(path.join(__dirname, '../..'))

process.removeAllListeners('warning')
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning' &&
      warning.message.includes('CommonJS module') &&
      warning.message.includes('ES Module')) {
    return
  }
  console.warn(warning)
})

const queryServer = {
  name: 'query-server',
  configureServer (server) {
    server.middlewares.use('/query', async (req, res, next) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end('Method Not Allowed')
        return
      }

      let chunks = []
      for await (let chunk of req) chunks.push(chunk)
      let buffer = Buffer.concat(chunks)
      let body = buffer.toString()
      let {sql, query_name} = JSON.parse(body)

      if (sql.match(/DESCRIBE SELECT/)) {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({sql, query_name, rows: [], rowCount: 0}))
        return
      }

      let parsed = analyze(sql)
      let query = parsed[parsed.length - 1]
      console.log(query)
      await connectDb()

      try {
        let reader = await conn.runAndReadAll(query)
        let rows = await reader.getRowObjects()
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({sql, query_name, rows, rowCount: rows.length}, safeBigIntReplacer))
      } catch (e) {
        res.statusCode = 400
        console.error(e)
        res.end(e.message)
      }
    })
  },
}

function safeBigIntReplacer (key, value) {
  return typeof value === 'bigint' ? value.toString() : value
}

const logger = createLogger()

const strictFs = (process.env.NODE_ENV === 'development') ? false : true
/** @type {import('vite').UserConfig} */
const config =
  {
    plugins: [queryServer, tailwindcss(), sveltekit(), configVirtual(), queryDirectoryHmr, sourceQueryHmr(), evidenceThemes()],
    optimizeDeps: {
      include: ['echarts-stat', 'echarts', 'blueimp-md5', 'nanoid', '@uwdata/mosaic-sql',
        // We need these to prevent HMR from doing a full page reload
        ...(process.env.EVIDENCE_DISABLE_INCLUDE ? [] : [
          '@evidence-dev/core-components',
          // Evidence packages injected into process-queries
          '@evidence-dev/component-utilities/stores', '@evidence-dev/component-utilities/formatting', '@evidence-dev/component-utilities/globalContexts', '@evidence-dev/sdk/utils/svelte', '@evidence-dev/component-utilities/profile', '@evidence-dev/sdk/usql', '@evidence-dev/component-utilities/buildQuery',
          'debounce',
          '@duckdb/duckdb-wasm',
          'apache-arrow',
        ]),

      ],
      exclude: ['svelte-icons', '@evidence-dev/universal-sql', '$evidence/config', '$evidence/themes'],
    },
    ssr: {
      external: ['@evidence-dev/telemetry', 'blueimp-md5', 'nanoid', '@uwdata/mosaic-sql', '@evidence-dev/sdk/plugins'],
    },
    server: {
      fs: {
        strict: strictFs, // allow template to get dependencies outside the .evidence folder
      },
      hmr: {
        overlay: false,
      },
    },
    build: {
      // 🚩 Triple check this
      minify: isDebug() ? false : true,
      target: isDebug() ? 'esnext' : undefined,
      rollupOptions: {
        external: [/^@evidence-dev\/tailwind\/fonts\//],
        onwarn (warning, warn) {
          if (warning.code === 'EVAL') return
          warn(warning)
        },
      },
    },
    customLogger: logger,
  }

// Suppress errors when building in non-debug mode
if (!isDebug() && process.env.EVIDENCE_IS_BUILDING === 'true') {
  config.logLevel = 'silent'
  logger.error = (msg) => log.error(msg)
  logger.info = () => {}
  logger.warn = () => {}
  logger.warnOnce = () => {}
} else {
  let loggerWarn = logger.warn
  let loggerOnce = logger.warnOnce

  /**
	 * @see https://github.com/evidence-dev/evidence/issues/1876
	 * Ignore the duckdb-wasm sourcemap warning
	 */
  logger.warnOnce = (m, o) => {
    if (m.match(/Sourcemap for ".+\/node_modules\/@duckdb\/duckdb-wasm\/dist\/duckdb-browser-eh\.worker\.js" points to missing source files/)) return
    loggerOnce(m, o)
  }

  logger.warn = (msg, options) => {
    // ignore fs/promises warning, used in +layout.js behind if (!browser) check
    if (msg.includes('Module "fs/promises" has been externalized for browser compatibility')) return

    // ignore eval warning, used in duckdb-wasm
    if (msg.includes('Use of eval in') && msg.includes('is strongly discouraged as it poses security risks and may cause issues with minification.')) return

    loggerWarn(msg, options)
  }
}

export default config
