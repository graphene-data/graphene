import {defineConfig} from 'drizzle-kit'
import 'drizzle-orm'

let dbCredentials: any = {}

if (process.env.TURSO_DATABASE_URL) {
  dbCredentials.url = process.env.TURSO_DATABASE_URL
  dbCredentials.authToken = process.env.TURSO_AUTH_TOKEN
} else {
  dbCredentials.url = 'file:cloud.db'
}

export default defineConfig({
  schema: './schema.ts',
  out: './migrations',
  dialect: 'turso',
  dbCredentials,
})
