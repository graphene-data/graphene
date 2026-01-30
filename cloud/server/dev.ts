import fs, {globSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import middie from '@fastify/middie'
import {createServer as createViteServer} from 'vite'
import {migrate} from 'drizzle-orm/postgres-js/migrator'
import {createServer} from './server.ts'
import {getDb, resetDb, setupPglite} from './db.ts'
import * as schema from '../schema.ts'
import {setAuthOverride} from './auth.ts'
import {encryptSecret} from './secrets.ts'
import {TEST} from './consts.ts'

let rootDir = path.resolve(fileURLToPath(import.meta.url), '../..')
export const orgId = 'organization-test-fe0fbae3-a479-4b60-8e80-7a76e76cc35d'
export const userId = 'member-test-9c9e5d97-3b98-4f27-85bd-fb496e29d724'
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
  port = port || Number(process.env.GRAPHENE_PORT) + 1 || 4000

  let fastify = createServer(false)
  await fastify.register(middie, {hook: 'onRequest'})

  setAuthOverride(realAuth ? null : {userId, orgId, slug: ''})
  process.env.VITE_STYTCH_USE_MOCK = realAuth ? '' : 'true'

  if (!TEST) {
    let {SmeeClient} = await import('smee-client')
    let smee = new SmeeClient({source: 'https://smee.io/MkHzlt6xKj6dh9Sm', target: `http://localhost:${port}/_api/github/webhook`})
    smee.start()
  }
  process.env.GITHUB_APP_SLUG = 'graphene-data-dev'
  process.env.GITHUB_APP_WEBHOOK_SECRET = 'devsecret'
  process.env.GITHUB_APP_ID = '2484649'
  process.env.GITHUB_APP_CLIENT_ID = 'Iv23liKKZeEBautjO5bE'
  process.env.VITE_GITHUB_APP_SLUG = 'graphene-data-dev'

  let vite = await createViteServer({
    root: path.join(rootDir, 'frontend'),
    configFile: path.join(rootDir, 'frontend/vite.config.ts'),
    server: {middlewareMode: true, hmr: {server: fastify.server}},
    mode: TEST ? 'test' : 'dev',
  })

  fastify.use((req, res, next) => {
    if (req.url?.startsWith('/_api')) next()
    else vite.middlewares(req, res, next)
  })

  await seedDatabase(seedType)

  await fastify.listen({port, host: '0.0.0.0'})
  let url = `http://localhost:${port}`
  if (!TEST) {
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

export async function seedDatabase (connectionType: SeedType) {
  await resetDb() // reset db instance (tests need fresh in-memory db, dev needs fresh pglite)
  let db = getDb()

  // Run migrations using drizzle's migrate function
  await migrate(db, {migrationsFolder: path.join(rootDir, 'migrations')})

  await db.insert(schema.orgs).values({id: orgId, slug: 'dev', name: 'Graphene Dev'})
  await db.insert(schema.users).values({orgId, id: userId, email: 'dev@graphenedata.com', role: 'admin' as const})

  if (connectionType == 'bigquery') {
    let configJson = process.env.GOOGLE_CREDENTIALS_CONTENT || ''
    if (!configJson) throw new Error('GOOGLE_CREDENTIALS_CONTENT is required when using the bigquery dataset.')

    if (!configJson.startsWith('{')) {
      configJson = fs.readFileSync(path.resolve(configJson), 'utf-8')
    }

    let namespace = 'bigquery-public-data.thelook_ecommerce'
    await db.insert(schema.connections).values({orgId, label: 'bq', kind: 'bigquery', configJson: await encryptSecret(configJson), namespace})
    // NB this id is the current install of the `graphene-data-dev` github app into the `github.com/grant-gh-test/ecomm` repo. If you re-install, update the vcsInstallationId
    let vcsInstallationId = '101959947'
    await db.insert(schema.vcsInstallations).values({orgId, id: vcsInstallationId, type: 'github'})
    await db.insert(schema.repos).values({orgId, id: repoId, slug: 'ecomm', url: 'https://github.com/grant-gh-test/ecomm.git', vcsInstallationId, vcsRepoId: '1118425707'})
  }

  if (connectionType == 'duckdb') {
    let dbPath = path.resolve(rootDir, '../core/examples/flights/flights.duckdb')
    if (!fs.existsSync(dbPath)) throw new Error(`Expected DuckDB database at ${dbPath}`)
    await db.insert(schema.connections).values({orgId, label: 'duckdb', kind: 'duckdb', configJson: await encryptSecret(JSON.stringify({dbPath}))})
    await db.insert(schema.repos).values({id: repoId, slug: 'flights', orgId, url: 'https://github.com/graphene-data/examples/${repoSlug}'})
  }

  // load our example files into the database
  let exampleRoot = path.resolve(rootDir, '../core/examples', connectionType == 'bigquery' ? 'ecomm' : 'flights')
  for (let filePath of globSync('**/*.{md,gsql}', {cwd: exampleRoot})) {
    let [relative, extension] = filePath.split('.')
    let content = fs.readFileSync(path.join(exampleRoot, filePath), 'utf-8')
    await db.insert(schema.files).values({repoId, path: relative, extension, content})
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await setupPglite(5454) // fixed port for dev server
  await startDevServer({realAuth: true, seedType: 'duckdb'})
}
