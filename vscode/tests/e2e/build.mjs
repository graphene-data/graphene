import {build} from 'esbuild'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

let __filename = fileURLToPath(import.meta.url)
let __dirname = path.dirname(__filename)
let root = path.resolve(__dirname, '../..')

await build({
  entryPoints: [path.join(__dirname, 'extension.e2e.ts')],
  outdir: path.join(root, 'dist', 'e2e'),
  bundle: false,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
})
