import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    testTimeout: process.env.GRAPHENE_DEBUG ? 0 : 10_000,
    maxWorkers: process.env.CI ? 1 : 4, // as this gets higher, the first test in each worker takes longer until it exceeds the timeout
    pool: process.env.GRAPHENE_DEBUG ? 'threads' : 'forks', // otherwise, cmd+c when debugging will zombie the worker
    environment: 'node',
    include: ['tests/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    reporters: ['default', 'json'],
    outputFile: 'node_modules/.testResults.json',
    onConsoleLog (log) {
      // silence some expected logs that aren't helpful in tests
      if (log.startsWith('Pulling schema from database...')) return false
    },
    fileParallelism: false,
  },
})
