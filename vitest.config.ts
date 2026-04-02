import dotenv from 'dotenv'
import path from 'path'
import {defineConfig} from 'vitest/config'

dotenv.config({path: path.resolve(import.meta.dirname, '..', '.env'), quiet: true})

export default defineConfig({
  test: {
    globals: true,
    testTimeout: process.env.GRAPHENE_DEBUG ? 0 : 10_000,
    maxWorkers: process.env.CI ? 1 : 4, // as this gets higher, the first test in each worker takes longer until it exceeds the timeout
    environment: 'node',
    reporters: ['default', 'json'],
    outputFile: 'node_modules/.testResults.json',
    slowTestThreshold: 5_000,
    onConsoleLog(log) {
      // silence some expected logs that aren't helpful in tests
      if (log.startsWith('Server running at http://')) return false
      if (log.startsWith('manually calling optimizeDeps is deprecated.')) return false
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'ui',
          globalSetup: ['ui/tests/globalSetup.ts'],
          setupFiles: ['ui/tests/setup.ts'],
          include: ['ui/tests/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'cli',
          include: ['cli/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'lang',
          setupFiles: ['lang/testHelpers.ts'],
          include: ['lang/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'vscode',
          include: ['vscode/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'language-server',
          include: ['language-server/**/*.test.ts'],
        },
      },
    ],
  },
})
