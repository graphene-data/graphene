import {build} from 'esbuild'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {cp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises'
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

let skillDir = path.resolve(__dirname, 'dist/skills/graphene')
await rm(skillDir, {recursive: true, force: true})
await mkdir(skillDir, {recursive: true})
await writeFile(path.resolve(skillDir, 'SKILL.md'), `
---
name: graphene
description: How to use Graphene, our framework for data modeling, analysis, and visualization.
---

${await readFile(path.resolve(__dirname, '../docs/base.md'), 'utf8')}
${await readFile(path.resolve(__dirname, '../docs/cli.md'), 'utf8')}
${await readFile(path.resolve(__dirname, '../docs/best-practices.md'), 'utf8')}
# Reference documentation
Consult the reference documentation for more detailed information on using Graphene.

${(await readdir(path.resolve(__dirname, '../docs/references'))).map(f => `- references/${f}`).join('\n')}
`)
await cp(path.resolve(__dirname, '../docs/references'), path.resolve(skillDir, 'references'), {recursive: true})
await cp(path.resolve(__dirname, '../ui'), path.resolve(__dirname, 'dist/ui'), {recursive: true})
await rm(path.resolve(__dirname, 'dist/ui/node_modules'), {recursive: true, force: true})
await rm(path.resolve(__dirname, 'dist/ui/package.json'))
await rm(path.resolve(__dirname, 'dist/ui/tests'), {recursive: true, force: true})
await rm(path.resolve(__dirname, 'dist/cli/cli.js.map'))
