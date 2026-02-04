import path from 'node:path'

import {svelte} from '@sveltejs/vite-plugin-svelte'
import {defineConfig} from 'vite'

const frontendDir = __dirname
const repoRoot = path.resolve(frontendDir, '..', '..')

export default defineConfig({
  root: frontendDir,
  publicDir: path.join(repoRoot, 'core/ui/public'),
  plugins: [svelte() as any],
  resolve: {
    conditions: ['svelte', 'browser'],
  },
  server: {
    allowedHosts: ['.ngrok-free.dev'],
    fs: {
      allow: [repoRoot],
    },
  },
  build: {
    outDir: path.join(frontendDir, '../dist'),
    emptyOutDir: true,
  },
  optimizeDeps: {
    // Don't pre-bundle svelte components from core/ui, let vite-plugin-svelte handle them fresh
    exclude: ['svelte'],
  },
})
