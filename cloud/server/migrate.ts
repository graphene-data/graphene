// Standalone migration script that runs drizzle migrations
// Used by the ECS migration task in CI/CD

import {migrate} from 'drizzle-orm/postgres-js/migrator'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {getDb} from './db.ts'

let rootDir = path.resolve(fileURLToPath(import.meta.url), '../..')

console.log('Running database migrations...')
let db = getDb()
await migrate(db, {migrationsFolder: path.join(rootDir, 'migrations')})
console.log('Migrations completed successfully')
process.exit(0)
