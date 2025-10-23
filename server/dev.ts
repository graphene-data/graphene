import fs, {globSync} from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import middie from '@fastify/middie'
import {createServer as createViteServer, type ViteDevServer} from 'vite'
import {createServer} from './server.ts'
import {getDb, resetDb} from './db.ts'
import * as schema from '../schema.ts'

let rootDir = path.resolve(fileURLToPath(import.meta.url), '../..')
const orgId = 'organization-test-5ecd5c3e-3173-494c-945f-8427215d4d9b'
const userId = 'member-test-ebc75d39-bebe-46dd-8261-135af85f0a1a'

interface DevArgs {
  realAuth: boolean
  port?: number
  seedType: string
}

export async function startDevServer ({realAuth, port, seedType}: DevArgs) {
  port = Number(port || process.env.GRAPHENE_PORT || 4000)

  let fastify = createServer()
  await fastify.register(middie, {hook: 'onRequest'})

  let vite = await createViteServer({
    root: path.join(rootDir, 'frontend'),
    configFile: path.join(rootDir, 'frontend/vite.config.ts'),
    server: {middlewareMode: true},
    env: {VITE_STYTCH_USE_MOCK: realAuth ? true : false},
  })

  fastify.use((req, res, next) => {
    if (req.url.startsWith('/_api')) next()
    else vite.middlewares(req, res, next)
  })

  await seedDatabase(seedType)

  await fastify.listen({port, host: 'localhost'})
  let url = `http://localhost:${port}`
  if (process.env.NODE_ENV !== 'test') {
    console.log(`Cloud dev server running at ${url}`)
  }

  let close = async () => {
    await fastify.close()
    await vite.close()
  }

  return {url, close}
}

async function seedDatabase (connectionType: string) {
  if (process.env.NODE_ENV == 'test') resetDb() // in tests, clear out our prev in-memory db
  else fs.rmSync(path.join(rootDir, 'cloud.db'), {force: true}) // in dev, remove the db file

  let db = getDb()

  // run schema migrations against this fresh db
  let require = createRequire(import.meta.url)
  let {pushSQLiteSchema} = require('drizzle-kit/api')
  let {statementsToExecute} = await pushSQLiteSchema(schema, db)
  for (let statement of statementsToExecute) await (db as any).$client.exec(statement)

  await db.insert(schema.orgs).values({id: orgId, slug: 'dev', name: 'Graphene Dev'}).run()
  await db.insert(schema.users).values({orgId, id: userId, email: 'dev@graphenedata.com', role: 'admin' as const}).run()

  if (connectionType == 'bigquery') {
    let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (!credentialsPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required when using the bigquery dataset.')

    let absoluteCredentialsPath = path.resolve(credentialsPath)
    let configJson = fs.readFileSync(absoluteCredentialsPath, 'utf-8')
    let namespace = 'bigquery-public-data.thelook_ecommerce'
    await db.insert(schema.connections).values({orgId, label: 'bq', kind: 'bigquery', configJson, namespace})
  } else {
    // await db.insert()
  }

  // load our example files into the database
  let exampleRoot = path.resolve(rootDir, '../core/examples', connectionType == 'bigquery' ? 'ecomm' : 'flights')
  for (let filePath of globSync('**/*.{md,gsql}', {cwd: exampleRoot})) {
    let [relative, extension] = filePath.split('.')
    let content = fs.readFileSync(path.join(exampleRoot, filePath), 'utf-8')
    await db.insert(schema.files).values({orgId, path: relative, extension, content}).run()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startDevServer({realAuth: true, seedType: 'bigquery'})
}
