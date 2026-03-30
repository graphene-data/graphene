import {svelte} from '@sveltejs/vite-plugin-svelte'
import path from 'path'
import {defineConfig} from 'vite'
import {viteSingleFile} from 'vite-plugin-singlefile'

const frontendDir = __dirname
const isDevelopment = process.env.NODE_ENV === 'development'

export default defineConfig({
  plugins: [svelte() as any, viteSingleFile()],
  build: {
    sourcemap: isDevelopment ? 'inline' : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: {input: path.join(frontendDir, 'mcp.html')},
    outDir: path.join(frontendDir, '../distMcp'),
    emptyOutDir: false,
  },
})
