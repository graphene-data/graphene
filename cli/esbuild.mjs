import {build, transform} from 'esbuild'
import {cp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import pkg from './package.json' with {type: 'json'}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let makeAllPackagesExternalPlugin = {
  name: 'make-all-packages-external',
  setup(build) {
    let filter = /^[^./]|^\.[^./]|^\.\.[^/]/ // Must not start with "/" or "./" or "../"
    build.onResolve({filter}, args => ({path: args.path, external: true}))
  },
}

await build({
  // cli build
  entryPoints: [path.resolve(__dirname, 'cli.ts')],
  outdir: path.resolve(__dirname, 'dist/cli'), // the extra `/cli/` keeps deployed dev relative paths the same between cli and ui
  entryNames: '[name]',
  chunkNames: '[name]-[hash]',
  bundle: true,
  splitting: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  minify: false,
  external: Object.keys(pkg.dependencies),
  plugins: [makeAllPackagesExternalPlugin],
})

let distSkillsDir = path.resolve(__dirname, 'dist/skills')
await rm(distSkillsDir, {recursive: true, force: true})
let skillDir = path.resolve(distSkillsDir, 'graphene')
await mkdir(skillDir, {recursive: true})
await writeFile(
  path.resolve(skillDir, 'SKILL.md'),
  `
---
name: graphene
description: How to use Graphene, our framework for data modeling, analysis, and visualization.
allowed-tools: Bash(npx graphene:*) Bash(pnpm graphene:*) Bash(yarn graphene:*) Bash(bun run graphene:*)
---

${await readFile(path.resolve(__dirname, '../docs/base.md'), 'utf8')}
${await readFile(path.resolve(__dirname, '../docs/cli.md'), 'utf8')}
${await readFile(path.resolve(__dirname, '../docs/best-practices.md'), 'utf8')}
# Reference documentation
Consult the reference documentation for more detailed information on using Graphene.
For semantic modeling with GSQL references, read \`references/model-gsql.md\`.

${(await readdir(path.resolve(__dirname, '../docs/references'))).map(f => `- references/${f}`).join('\n')}
`.trimStart(),
)
await cp(path.resolve(__dirname, '../docs/references'), path.resolve(skillDir, 'references'), {recursive: true})
await cp(path.resolve(__dirname, '../ui'), path.resolve(__dirname, 'dist/ui'), {recursive: true})
await mkdir(path.resolve(__dirname, 'dist/lang'), {recursive: true})
await cp(path.resolve(__dirname, '../lang/index.d.ts'), path.resolve(__dirname, 'dist/lang/index.d.ts'))
await transpileSvelteModules(path.resolve(__dirname, 'dist/ui'))
await rm(path.resolve(__dirname, 'dist/ui/node_modules'), {recursive: true, force: true})
await rm(path.resolve(__dirname, 'dist/ui/package.json'))
await rm(path.resolve(__dirname, 'dist/ui/tests'), {recursive: true, force: true})
await rm(path.resolve(__dirname, 'dist/cli/cli.js.map'))

async function transpileSvelteModules(root) {
  let files = await collectFiles(root)
  let svelteModuleFiles = files.filter(file => file.endsWith('.svelte.ts'))

  await Promise.all(
    files.map(async file => {
      let contents = await readFile(file, 'utf8')
      if (!contents.includes('.svelte.ts')) return
      await writeFile(file, contents.replaceAll('.svelte.ts', '.svelte.js'))
    }),
  )

  await Promise.all(
    svelteModuleFiles.map(async file => {
      let contents = await readFile(file, 'utf8')
      let output = await transform(contents, {
        loader: 'ts',
        format: 'esm',
        target: 'es2022',
      })
      await writeFile(file.replace(/\.ts$/, '.js'), output.code)
      await rm(file)
    }),
  )
}

async function collectFiles(root) {
  let entries = await readdir(root, {withFileTypes: true})
  let files = []
  for (let entry of entries) {
    let fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...(await collectFiles(fullPath)))
    else if (entry.isFile()) files.push(fullPath)
  }
  return files
}
