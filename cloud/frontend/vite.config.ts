import path from 'node:path'

import {svelte} from '@sveltejs/vite-plugin-svelte'
import {defineConfig} from 'vite'

const frontendDir = __dirname
const repoRoot = path.resolve(frontendDir, '..', '..')

export function createFrontendViteConfig() {
  return {
    root: frontendDir,
    publicDir: path.join(repoRoot, 'core/ui/public'),
    plugins: [svelte() as any, fixSvelteDepsInTests()],
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
      exclude: ['svelte'],
    },
  }
}

export default defineConfig(createFrontendViteConfig())

function fixSvelteDepsInTests() {
  let viteConfig: any
  let isTest = false

  function configResolved(cfg: any) {
    viteConfig = cfg
    isTest = cfg.mode == 'test' || !!process.env.VITEST || process.env.NODE_ENV == 'test'
  }

  function buildStart() {
    if (!isTest) return
    viteConfig.optimizeDeps.force = false
  }

  buildStart.sequential = true
  return {name: 'fix-svelte-deps', enforce: 'post' as const, configResolved, buildStart}
}
