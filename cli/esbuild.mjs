import {build} from 'esbuild'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {cp, rm} from 'node:fs/promises'
import pkg from './package.json' with {type: 'json'}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let makeAllPackagesExternalPlugin = {
  name: 'make-all-packages-external',
  setup (build) {
    let filter = /^[^./]|^\.[^./]|^\.\.[^/]/ // Must not start with "/" or "./" or "../"
    build.onResolve({filter}, args => ({path: args.path, external: true}))
  },
}

await build({ // cli build
  entryPoints: [path.resolve(__dirname, 'cli.ts')],
  outfile: path.resolve(__dirname, 'dist/cli/cli.js'), // the extra `/cli/` keeps deployed dev relative paths the same between cli and ui
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  minify: false,
  external: Object.keys(pkg.dependencies),
  plugins: [makeAllPackagesExternalPlugin],
})

await cp(path.resolve(__dirname, '../docs'), path.resolve(__dirname, 'dist/docs'), {recursive: true})
await cp(path.resolve(__dirname, '../ui'), path.resolve(__dirname, 'dist/ui'), {recursive: true})
await rm(path.resolve(__dirname, 'dist/ui/node_modules'), {recursive: true, force: true})
await rm(path.resolve(__dirname, 'dist/ui/package.json'))
await rm(path.resolve(__dirname, 'dist/ui/tests'), {recursive: true, force: true})
await rm(path.resolve(__dirname, 'dist/cli/cli.js.map'))
