import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    testTimeout: process.env.GRAPHENE_DEBUG ? 0 : 10_000,
    pool: process.env.GRAPHENE_DEBUG ? 'threads' : 'forks', // otherwise, cmd+c when debugging will zombie the worker
    environment: 'node',
    include: ['tests/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    reporters: ['default', 'json'],
    outputFile: 'node_modules/.testResults.json',
    onConsoleLog (log) {
      if (log.includes('Pulling schema from database...')) return false
    },
    fileParallelism: false,
  },
})
