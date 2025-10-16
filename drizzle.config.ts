import {defineConfig} from 'drizzle-kit'

export default defineConfig({
  schema: './schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.CLOUD_DB_PATH ?? './cloud.db',
  },
})
