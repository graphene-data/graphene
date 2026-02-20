import {defineConfig} from 'vitest/config'
import dotenv from 'dotenv'
import path from 'path'
import {isExpectedLine, unexpectedLineError} from './ui/tests/logWatcher.ts'

dotenv.config({path: path.resolve(import.meta.dirname, '..', '.env'), quiet: true})

export default defineConfig({
  test: {
    globals: true,
    testTimeout: process.env.GRAPHENE_DEBUG ? 0 : 10_000,
    maxWorkers: 4, // more than this, I start getting timeouts on the first test
    environment: 'node',
    reporters: ['default', 'json'],
    outputFile: 'node_modules/.testResults.json',
    slowTestThreshold: 5_000,
    onConsoleLog (log, type) {
      if (isExpectedLine(log, [x => x.startsWith('Server running at http://'), x => x.startsWith('manually calling optimizeDeps is deprecated.')])) return false
      throw unexpectedLineError(type, log)
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
    ],
  },
})
