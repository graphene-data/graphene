import path from 'node:path'
import {fileURLToPath} from 'node:url'
import fs, {globSync} from 'node:fs'
import {createRequire} from 'node:module'

import {orgs, files, users, connections} from '../schema.ts'
import * as schema from '../schema.ts'
import {getDb, resetDb} from './db.ts'

export interface SeedResult {
  orgId: string
  userId: string
  userEmail: string
}

const DEFAULT_ORG = {
  id: 'organization-test-5ecd5c3e-3173-494c-945f-8427215d4d9b',
  slug: 'dev',
  name: 'Graphene Dev',
}

const DEFAULT_USER = {
  id: 'member-test-ebc75d39-bebe-46dd-8261-135af85f0a1a',
  email: 'dev@graphenedata.com',
  role: 'admin' as const,
}

export interface SeedOptions {
  rootDir?: string
  datasetDir?: string
  org?: Partial<typeof DEFAULT_ORG>
  user?: Partial<typeof DEFAULT_USER>
  inMemory?: boolean
}

export async function seedDb (options: SeedOptions = {}): Promise<SeedResult> {
  let rootDir = options.rootDir ?? path.resolve(fileURLToPath(import.meta.url), '../..')
  let dbPath = path.join(rootDir, 'cloud.db')

  let useMemory = options.inMemory ?? process.env.NODE_ENV === 'test'
  if (process.env.NODE_ENV !== 'test') console.log('Re-seeding database')

  if (!useMemory) fs.rmSync(dbPath, {force: true})
  resetDb()
  let db = getDb()

  let require = createRequire(import.meta.url)
  let {pushSQLiteSchema} = require('drizzle-kit/api')
  let {statementsToExecute} = await pushSQLiteSchema(schema, db)
  for (let s of statementsToExecute) await (db as any).$client.exec(s)

  let org = {...DEFAULT_ORG, ...options.org}
  let user = {...DEFAULT_USER, ...options.user, orgId: org.id}

  await db.insert(orgs).values({id: org.id, slug: org.slug, name: org.name}).run()
  await db.insert(users).values({
    id: user.id,
    email: user.email,
    orgId: user.orgId!,
    role: user.role,
  }).run()

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    let configJson = fs.readFileSync(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS), {encoding: 'utf-8'})
    await db.insert(connections).values({orgId: org.id, label: 'ecomm', kind: 'bigquery', configJson, namespace: 'bigquery-public-data.thelook_ecommerce'}).run()
  } else {
    console.warn('No GOOGLE_APPLICATION_CREDENTIALS set. Not seeding db connection')
  }

  let defaultDatasetRoot = path.join(rootDir, '../examples/ecomm')
  if (!fs.existsSync(defaultDatasetRoot)) {
    let fallback = path.join(rootDir, '../core/examples/ecomm')
    if (fs.existsSync(fallback)) defaultDatasetRoot = fallback
  }

  let datasetRoot = options.datasetDir ?? defaultDatasetRoot
  if (!fs.existsSync(datasetRoot)) {
    throw new Error(`Missing dataset directory at ${datasetRoot}`)
  }

  for (let p of globSync('**/*.{md,gsql}', {cwd: datasetRoot})) {
    let [p2, extension] = p.split('.')
    let content = fs.readFileSync(path.join(datasetRoot, p), {encoding: 'utf-8'})
    await db.insert(files).values({orgId: org.id, path: p2, extension, content}).run()
  }

  return {orgId: org.id, userId: user.id, userEmail: user.email}
}
