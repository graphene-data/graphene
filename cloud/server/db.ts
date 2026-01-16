import {type Client, createClient} from '@libsql/client'
import {drizzle, type LibSQLDatabase} from 'drizzle-orm/libsql'
import * as schema from '../schema.ts'
import {TEST} from './consts.ts'

export type CloudDatabase = LibSQLDatabase<typeof schema>

let dbInstance: CloudDatabase | undefined
let sqliteInstance: Client | undefined

export function getDb (): CloudDatabase {
  if (dbInstance) return dbInstance
  let url = TEST ? ':memory:' : process.env.TURSO_DATABASE_URL!
  let authToken = process.env.TURSO_AUTH_TOKEN || ''

  sqliteInstance = createClient({url, authToken})
  dbInstance = drizzle(sqliteInstance, {schema})
  return dbInstance
}

export function resetDb (): void {
  dbInstance = undefined
  sqliteInstance?.close()
  sqliteInstance = undefined
}
