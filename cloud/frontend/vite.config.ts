import {svelte} from '@sveltejs/vite-plugin-svelte'
import path from 'node:path'
import {defineConfig} from 'vite'

const frontendDir = __dirname
const repoRoot = path.resolve(frontendDir, '..', '..')
const isTest = process.env.NODE_ENV == 'test'

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
    // In tests, we don't want to optimize, as test workers would conflict on the dep cache dir
    optimizeDeps: {
      noDiscovery: isTest,
      force: false,
      include: isTest ? ['svelte', 'svelte/internal/client', 'svelte/internal/disclose-version'] : undefined,
      exclude: isTest ? [] : ['svelte'],
    },
  }
}

export default defineConfig(createFrontendViteConfig())

// Svelte tries to force optimization on startup, but we really don't want this to happen
// for tests, since workers would conflict with each other. This hackily undoes the svelte plugins
// forced dep optimization.
function fixSvelteDepsInTests() {
  let viteConfig: any
  let isTestMode = false

  function configResolved(cfg: any) {
    viteConfig = cfg
    isTestMode = cfg.mode == 'test' || process.env.NODE_ENV == 'test'
  }

  function buildStart() {
    if (!isTestMode) return
    viteConfig.optimizeDeps.force = false
  }

  buildStart.sequential = true
  return {name: 'fix-svelte-deps', enforce: 'post' as const, configResolved, buildStart}
}
