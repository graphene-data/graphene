import {build} from 'esbuild'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import pkg from './package.json' with {type: 'json'}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let makeAllPackagesExternalPlugin = {
  name: 'make-all-packages-external',
  setup(buildContext) {
    let filter = /^[^./]|^\.[^./]|^\.\.[^/]/
    buildContext.onResolve({filter}, args => ({path: args.path, external: true}))
  },
}

await build({
  entryPoints: [path.resolve(__dirname, 'cli.ts')],
  outfile: path.resolve(__dirname, 'dist/cli.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: false,
  minify: false,
  external: Object.keys(pkg.dependencies),
  plugins: [makeAllPackagesExternalPlugin],
})
