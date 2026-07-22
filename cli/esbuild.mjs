import {build as esbuild, transform} from 'esbuild'
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

await esbuild({
  // cli build
  entryPoints: {
    cli: path.resolve(__dirname, 'cli.ts'),
    // installBrowser is also a standalone postinstall target in the published package.
    installBrowser: path.resolve(__dirname, 'installBrowserEntry.ts'),
  },
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

// Keep the generated skill's reference list useful for agents, and fail the build when a new reference lacks a description.
let referenceDocs = {
  'config.md': 'Project package.json configuration, including database connections, ignored files, env files, telemetry, and dev server settings.',
  'echarts.md': 'ECharts component usage for custom charts beyond the built-in Graphene chart components.',
  'gsql.md': 'GSQL query syntax reference for pages, including selects, filters, joins, aggregations, parameters, and SQL passthrough.',
  'model-gsql.md': 'Semantic model GSQL reference for tables, dimensions, measures, joins, namespaces, and database-specific types.',
  'table.md': 'Table component options for rendering query results in pages.',
}
let referencesDir = path.resolve(__dirname, '../docs/references')
let referenceFiles = (await readdir(referencesDir)).sort()
let missingDescriptions = referenceFiles.filter(f => !referenceDocs[f])
if (missingDescriptions.length) throw new Error(`Missing Graphene skill reference descriptions for: ${missingDescriptions.join(', ')}`)
let missingFiles = Object.keys(referenceDocs).filter(f => !referenceFiles.includes(f))
if (missingFiles.length) throw new Error(`Graphene skill reference descriptions point at missing files: ${missingFiles.join(', ')}`)

let distSkillsDir = path.resolve(__dirname, 'dist/skills')
await rm(distSkillsDir, {recursive: true, force: true})
let skillDir = path.resolve(distSkillsDir, 'graphene')
await mkdir(skillDir, {recursive: true})
await writeFile(
  path.resolve(skillDir, 'SKILL.md'),
  `
---
name: graphene
description: How to use Graphene, our framework for data modeling, analysis, and visualization. Read this before querying the data warehouse or editing any files within the Graphene project.
allowed-tools: Bash(npx graphene:*) Bash(pnpm graphene:*) Bash(yarn graphene:*) Bash(bun run graphene:*)
---

${await readFile(path.resolve(__dirname, '../docs/base.md'), 'utf8')}
${await readFile(path.resolve(__dirname, '../docs/cli.md'), 'utf8')}
${await readFile(path.resolve(__dirname, '../docs/best-practices.md'), 'utf8')}
# Reference documentation
Consult the reference documentation for more detailed information on using Graphene.
For semantic modeling with GSQL references, read \`references/model-gsql.md\`.

${referenceFiles.map(f => `- references/${f} — ${referenceDocs[f]}`).join('\n')}
`.trimStart(),
)
await cp(referencesDir, path.resolve(skillDir, 'references'), {recursive: true})
await cp(path.resolve(__dirname, '../ui'), path.resolve(__dirname, 'dist/ui'), {recursive: true})
await mkdir(path.resolve(__dirname, 'dist/lang'), {recursive: true})
await cp(path.resolve(__dirname, '../lang/index.d.ts'), path.resolve(__dirname, 'dist/index.d.ts'))
await cp(path.resolve(__dirname, '../lang/index.d.ts'), path.resolve(__dirname, 'dist/lang/index.d.ts'))
await cp(path.resolve(__dirname, '../lang/csv.ts'), path.resolve(__dirname, 'dist/lang/csv.ts'))
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
