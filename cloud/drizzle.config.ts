import {defineConfig} from 'drizzle-kit'
import 'drizzle-orm'

let dbCredentials: any = {
  url: process.env.DATABASE_URL || 'postgresql://localhost/graphene_dev',
}

export default defineConfig({
  schema: './schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials,
})
