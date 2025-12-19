import fs, {globSync} from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import middie from '@fastify/middie'
import {createServer as createViteServer} from 'vite'
import {createServer} from './server.ts'
import {getDb, resetDb} from './db.ts'
import * as schema from '../schema.ts'
import {setAuthOverride} from './auth.ts'

let rootDir = path.resolve(fileURLToPath(import.meta.url), '../..')
export const orgId = 'organization-test-3c0636ef-201f-44d0-9905-f7f20cf6e47d'
export const userId = 'member-test-e3a2374e-b0cd-4073-a934-d8ed8f3ac926'
export const repoId = 'testrepo'

export type SeedType = 'duckdb' | 'bigquery'

interface DevArgs {
  realAuth: boolean
  port?: number
  seedType?: SeedType
}

interface DevServerHandle {
  url: string
  close: () => Promise<void>
}

export async function startDevServer ({realAuth, port, seedType = 'duckdb'}: DevArgs): Promise<DevServerHandle> {
  port = Number(port || process.env.GRAPHENE_PORT || 4000)

  let fastify = createServer(false)
  await fastify.register(middie, {hook: 'onRequest'})

  setAuthOverride(realAuth ? null : {userId, orgId})
  process.env.VITE_STYTCH_USE_MOCK = realAuth ? '' : 'true'

  if (process.env.DEV_GITHUB_APP) {
    let {SmeeClient} = await import('smee-client')
    new SmeeClient({source: 'https://smee.io/MkHzlt6xKj6dh9Sm', target: `http://localhost:${port}/_api/github/webhook`})
  }
  process.env.GITHUB_APP_SLUG = 'graphene-data-dev'
  process.env.GITHUB_WEBHOOK_SECRET = 'devsecret'
  process.env.GITHUB_APP_ID = '2484649'
  process.env.GITHUB_APP_CLIENT_ID = 'Iv23liKKZeEBautjO5bE'
  process.env.VITE_GITHUB_APP_SLUG = 'graphene-data-dev'

  let vite = await createViteServer({
    root: path.join(rootDir, 'frontend'),
    configFile: path.join(rootDir, 'frontend/vite.config.ts'),
    server: {middlewareMode: true, hmr: {server: fastify.server}},
    mode: process.env.NODE_ENV == 'test' ? 'test' : 'dev',
  })

  fastify.use((req, res, next) => {
    if (req.url?.startsWith('/_api')) next()
    else vite.middlewares(req, res, next)
  })

  await seedDatabase(seedType)

  await fastify.listen({port, host: 'localhost'})
  let url = `http://localhost:${port}`
  if (process.env.NODE_ENV !== 'test') {
    console.log(`Cloud dev server running at ${url}`)
  }

  return {
    url,
    async close () {
      vite.ws.close()
      fastify.server.closeAllConnections()
      await fastify.close()
      await vite.close()
    },
  }
}

// load the statements we need to run to set up a fresh database. Done separately because we can cache for all test runs
let dbSetup: string[]
export async function loadDbSetup () {
  if (dbSetup) return
  let db = getDb()
  let require = createRequire(import.meta.url)
  let {pushSQLiteSchema} = require('drizzle-kit/api')
  let {statementsToExecute} = await pushSQLiteSchema(schema, db)
  dbSetup = statementsToExecute
}

async function seedDatabase (connectionType: SeedType) {
  if (process.env.NODE_ENV == 'test') resetDb() // in tests, clear out our prev in-memory db
  else fs.rmSync(path.join(rootDir, 'cloud.db'), {force: true}) // in dev, remove the db file
  let db = getDb()

  // run schema migrations against this fresh db
  if (!dbSetup) await loadDbSetup()

  for (let statement of dbSetup) await (db as any).$client.execute(statement)

  await db.insert(schema.orgs).values({id: orgId, slug: 'dev', name: 'Graphene Dev'}).run()
  await db.insert(schema.users).values({orgId, id: userId, email: 'dev@graphenedata.com', role: 'admin' as const}).run()

  if (connectionType == 'bigquery') {
    let configJson = process.env.BIGQUERY_TEST_CREDS || ''
    if (!configJson) throw new Error('BIGQUERY_TEST_CREDS is required when using the bigquery dataset.')

    if (!configJson.startsWith('{')) {
      configJson = fs.readFileSync(path.resolve(configJson), 'utf-8')
    }

    let namespace = 'bigquery-public-data.thelook_ecommerce'
    await db.insert(schema.connections).values({orgId, label: 'bq', kind: 'bigquery', configJson, namespace})
  }

  if (connectionType == 'duckdb') {
    let dbPath = path.resolve(rootDir, '../core/examples/flights/flights.duckdb')
    if (!fs.existsSync(dbPath)) throw new Error(`Expected DuckDB database at ${dbPath}`)
    await db.insert(schema.connections).values({orgId, label: 'duckdb', kind: 'duckdb', configJson: JSON.stringify({dbPath})})
  }

  let repoSlug = connectionType == 'bigquery' ? 'ecomm' : 'flights'
  let url = `https://github.com/graphene-data/examples/${repoSlug}`
  await db.insert(schema.repos).values({id: repoId, slug: repoSlug, orgId, url}).run()

  // load our example files into the database
  let exampleRoot = path.resolve(rootDir, '../core/examples', repoSlug)
  for (let filePath of globSync('**/*.{md,gsql}', {cwd: exampleRoot})) {
    let [relative, extension] = filePath.split('.')
    let content = fs.readFileSync(path.join(exampleRoot, filePath), 'utf-8')
    await db.insert(schema.files).values({repoId, path: relative, extension, content}).run()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startDevServer({realAuth: true, seedType: 'duckdb'})
}
