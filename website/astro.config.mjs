// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const fallbackDevPort = 4321;
const configDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(configDir, '..');
const rootEnvPath = resolve(repoRoot, '.env');

function readRootGraphenePort() {
  if (!existsSync(rootEnvPath)) return null;
  const match = readFileSync(rootEnvPath, 'utf8').match(/^GRAPHENE_PORT=(\d+)$/m);
  return match ? Number.parseInt(match[1], 10) : null;
}

const envGraphenePort = Number.parseInt(process.env.GRAPHENE_PORT ?? '', 10);
const graphenePort = Number.isFinite(envGraphenePort) ? envGraphenePort : readRootGraphenePort();
const devPort = Number.isFinite(graphenePort) ? graphenePort + 2 : fallbackDevPort;

// https://astro.build/config
export default defineConfig({
  site: 'https://graphenedata.com',
  server: {
    port: devPort,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
