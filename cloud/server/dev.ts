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

interface DevArgs {
  realAuth: boolean
  port?: number
  project?: string // 'flights' (default), 'ecomm', or a path to a custom repo
}

interface DevServerHandle {
  url: string
  close: () => Promise<void>
}

export async function startDevServer ({realAuth, port, project = 'flights'}: DevArgs): Promise<DevServerHandle> {
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

  await seedDatabase(project)

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

export async function seedDatabase (project = 'flights') {
  await resetDb() // reset db instance (tests need fresh in-memory db, dev needs fresh pglite)
  let db = getDb()

  // Run migrations using drizzle's migrate function
  await migrate(db, {migrationsFolder: path.join(rootDir, 'migrations')})

  await db.insert(schema.orgs).values({id: orgId, slug: 'dev', name: 'Graphene Dev'})
  await db.insert(schema.users).values({orgId, id: userId, email: 'dev@graphenedata.com', role: 'admin' as const})

  let projectRoot: string
  if (project === 'flights') {
    projectRoot = path.resolve(rootDir, '../core/examples/flights')
    let dbPath = path.join(projectRoot, 'flights.duckdb')
    if (!fs.existsSync(dbPath)) throw new Error(`Expected DuckDB database at ${dbPath}`)
    await db.insert(schema.connections).values({orgId, label: 'duckdb', kind: 'duckdb', configJson: await encryptSecret(JSON.stringify({dbPath}))})
    await db.insert(schema.repos).values({id: repoId, slug: 'flights', orgId, url: 'https://github.com/graphene-data/examples/${repoSlug}'})
  } else if (project === 'ecomm') {
    projectRoot = path.resolve(rootDir, '../core/examples/ecomm')
    let configJson = process.env.GOOGLE_CREDENTIALS_CONTENT
    await db.insert(schema.connections).values({orgId, label: 'bq', kind: 'bigquery', configJson: await encryptSecret(configJson), namespace: 'bigquery-public-data.thelook_ecommerce'})
    // NB this id is the current install of the `graphene-data-dev` github app into the `github.com/grant-gh-test/ecomm` repo. If you re-install, update the vcsInstallationId
    let vcsInstallationId = '101959947'
    await db.insert(schema.vcsInstallations).values({orgId, id: vcsInstallationId, type: 'github'})
    await db.insert(schema.repos).values({orgId, id: repoId, slug: 'ecomm', url: 'https://github.com/grant-gh-test/ecomm.git', vcsInstallationId, vcsRepoId: '1118425707'})
  } else {
    projectRoot = path.resolve(project)

    // Assume `.env` which has a GOOGLE_APPLICATION_CREDENTIALS that points to the cred file.
    // Slight convoluted as it lets you put the key outside of the project to slightly obscure it from agents
    let envContent = fs.readFileSync(path.resolve(projectRoot, '.env'), 'utf-8') || ''
    console.log(envContent)
    let match = envContent.match(/^GOOGLE_APPLICATION_CREDENTIALS\s*=\s*(.+)$/m)
    let credsPath = match && path.resolve(match[1].trim().replace(/^['"]|['"]$/g, ''))
    let configJson = credsPath && fs.readFileSync(credsPath, 'utf-8')

    await db.insert(schema.connections).values({orgId, label: 'bq', kind: 'bigquery', configJson: await encryptSecret(configJson)})
    await db.insert(schema.repos).values({id: repoId, slug: path.basename(projectRoot), orgId, url: ''})
  }

  // Load project files into the database
  for (let filePath of globSync('**/*.{md,gsql}', {cwd: projectRoot, exclude: ['node_modules/**']})) {
    let [relative, extension] = filePath.split('.')
    let content = fs.readFileSync(path.join(projectRoot, filePath), 'utf-8')
    await db.insert(schema.files).values({repoId, path: relative, extension, content})
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let project = process.argv[2] || 'flights'
  await setupPglite(5454) // fixed port for dev server
  await startDevServer({realAuth: true, project})
}
