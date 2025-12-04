import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    testTimeout: process.env.INSPECT ? 0 : 10_000,
    environment: 'node',
    reporters: ['default', 'json'],
    outputFile: 'node_modules/.testResults.json',
    projects: [
      {
        extends: true,
        test: {
          name: 'ui',
          globalSetup: ['ui/tests/globalSetup.ts'],
          include: ['ui/tests/*.test.ts', 'ui/tests/*.spec.ts'],
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
