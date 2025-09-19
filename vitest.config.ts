import {defineConfig} from 'vitest/config'
import {svelte} from '@sveltejs/vite-plugin-svelte'

function grapheneTestStubs () {
  return {
    name: 'graphene-test-stubs',
    resolveId (id: string) {
      if (['$evidence/config', '$app/environment', '$app/navigation', '$app/forms', '$app/stores'].includes(id)) return '\0' + id
      if (id.startsWith('@duckdb/node-bindings')) return '\0duckdb-node-stub'
      if (id.includes('@duckdb/duckdb-wasm')) return '\0duckdb-wasm-stub'
      if (id === '@evidence-dev/core-components') return '/workspace/ui/test/stubs/core-components.js'
      return null
    },
    load (id: string) {
      if (id === '\0$evidence/config') return 'export const config = {}'
      if (id === '\0$app/environment') return 'export const browser = true; export const version = 0; export const dev = true; export const building = false;'
      if (id === '\0$app/navigation') return 'export const browser = true; export const afterNavigate = () => {}; export function goto () {}; export function preloadData() {};'
      if (id === '\0$app/forms') return 'export const enhance = () => {}'
      if (id === '\0$app/stores') return 'export const page = {}; export const navigating = false;'
      if (id === '\0duckdb-node-stub') return 'export default {}'
      if (id === '\0duckdb-wasm-stub') return 'export default {}'
      return null
    },
  }
}

export default defineConfig({
  plugins: [svelte(), grapheneTestStubs()],
  projects: [
    // Browser project for component tests
    {
      test: {
        name: 'ui-browser',
        globals: true,
        include: ['/workspace/ui/components/**/*.test.ts'],
        setupFiles: [],
        browser: {
          enabled: true,
          name: 'chromium',
          provider: 'playwright',
          headless: true,
          screenshotFailures: false,
        },
        resolveSnapshotPath: (testPath) => testPath + '.snap',
      },
      resolve: {
        alias: [
          {find: /^@evidence-dev\/core-components(.*)?$/, replacement: '/workspace/ui/test/stubs/core-components.js'},
          {find: /^\$app\/environment$/, replacement: '/workspace/ui/test/stubs/app-environment.js'},
          {find: /^\$app\/navigation$/, replacement: '/workspace/ui/test/stubs/app-navigation.js'},
          {find: /^\$app\/forms$/, replacement: '/workspace/ui/test/stubs/app-forms.js'},
          {find: /^\$app\/stores$/, replacement: '/workspace/ui/test/stubs/app-stores.js'},
          {find: /^\$evidence\/config$/, replacement: '/workspace/ui/test/stubs/evidence-config.js'},
          {find: /^\$evidence\/themes$/, replacement: '/workspace/ui/test/stubs/evidence-themes.js'},
          {find: /^@duckdb\/node-bindings(.*)?$/, replacement: '/workspace/ui/test/stubs/duckdb-node.js'},
          {find: /^@duckdb\/duckdb-wasm(.*)?$/, replacement: '/workspace/ui/test/stubs/duckdb-wasm.js'},
        ],
      },
    },
    // Node project for e2e tests using Playwright programmatically
    {
      test: {
        name: 'ui-e2e',
        globals: true,
        environment: 'node',
        include: ['/workspace/ui/e2e/**/*.test.ts'],
        setupFiles: ['/workspace/ui/test/e2eSetup.ts'],
      },
    },
  ],
})
