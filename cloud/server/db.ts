import {drizzle, type PostgresJsDatabase} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import path from 'path'
import fs from 'fs'
import {fileURLToPath} from 'url'
import * as schema from '../schema.ts'
import {PROD, TEST} from './consts.ts'

export type CloudDatabase = PostgresJsDatabase<typeof schema>

let dbInstance: CloudDatabase | undefined
let postgresClient: any | undefined
let pgliteInstance: any | undefined
let socketServer: any | undefined
let pglitePort: number | undefined

// These get populated by setupPglite() in test fixtures
let PGlite: any
let PGLiteSocketServer: any

/** Call once in test fixtures to load pglite classes (avoids dynamic import in getDb) */
export async function setupPglite(port: number) {
  let pglite = await import('@electric-sql/pglite')
  let socket = await import('@electric-sql/pglite-socket')
  PGlite = pglite.PGlite
  PGLiteSocketServer = socket.PGLiteSocketServer
  pglitePort = port
}

export function getDb(): CloudDatabase {
  if (dbInstance) return dbInstance

  if (PROD) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in production')
    postgresClient = postgres(process.env.DATABASE_URL, {max: 10})
  } else {
    if (!PGlite) throw new Error('Call setupPglite() before getDb() in dev/test')
    let rootDir = path.resolve(fileURLToPath(import.meta.url), '../..')
    pgliteInstance = new PGlite(TEST ? undefined : path.join(rootDir, '.pglite'), {debug: 0})
    socketServer = new PGLiteSocketServer({db: pgliteInstance, port: pglitePort, host: '127.0.0.1'})
    socketServer.start() // seems to work if we don't await this, and keeps this fn sync

    postgresClient = postgres({
      host: '127.0.0.1',
      port: pglitePort,
      database: 'postgres',
      username: 'postgres',
      max: 1, // pglite only supports one connection
      onnotice: () => {}, // suppress debug notices from pglite
    })
  }

  dbInstance = drizzle(postgresClient, {schema})
  return dbInstance
}

export async function resetDb(): Promise<void> {
  if (PROD) throw new Error('Cannot reset db in prod')

  if (!TEST) {
    let rootDir = path.resolve(fileURLToPath(import.meta.url), '../..')
    fs.rmSync(path.join(rootDir, '.pglite'), {recursive: true, force: true})
  }

  await postgresClient?.end()
  await socketServer?.stop()
  await pgliteInstance?.close()

  dbInstance = undefined
  postgresClient = undefined
  pgliteInstance = undefined
  socketServer = undefined
}
