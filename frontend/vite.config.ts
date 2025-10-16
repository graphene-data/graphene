import path from 'node:path'

import {svelte} from '@sveltejs/vite-plugin-svelte'
import {defineConfig} from 'vite'

const frontendDir = __dirname
const repoRoot = path.resolve(frontendDir, '..', '..')

export default defineConfig({
  root: frontendDir,
  plugins: [svelte()],
  resolve: {
    conditions: ['svelte', 'browser'],
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  build: {
    outDir: path.join(frontendDir, '../dist'),
    emptyOutDir: true,
  },
})
