import SqliteDatabase from 'better-sqlite3'
import type {Database as SqliteInstance} from 'better-sqlite3'
import {drizzle, type BetterSQLite3Database} from 'drizzle-orm/better-sqlite3'
import * as schema from '../schema.ts'
import {fileURLToPath} from 'url'
import path from 'path'

export type CloudDatabase = BetterSQLite3Database<typeof schema>

let dbInstance: CloudDatabase | undefined
let sqliteInstance: SqliteInstance | undefined

export function getDb (): CloudDatabase {
  if (dbInstance) return dbInstance

  let dbPath = getDbPath()
  sqliteInstance = new SqliteDatabase(dbPath)
  dbInstance = drizzle(sqliteInstance, {schema})
  return dbInstance
}

export function resetDb (): void {
  dbInstance = undefined
  sqliteInstance?.close()
  sqliteInstance = undefined
}

function getDbPath (): string {
  if (process.env.NODE_ENV === 'test') return ':memory:'
  if (process.env.CLOUD_DB_PATH) return process.env.CLOUD_DB_PATH
  return path.resolve(fileURLToPath(import.meta.url), '../../cloud.db')
}
