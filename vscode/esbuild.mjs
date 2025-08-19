import {build, context} from 'esbuild'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execSync} from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isWatch = process.argv.includes('--watch')

const aliasPlugin = {
  name: 'alias-lang-analyze',
  setup(b) {
    b.onResolve({filter: /^@graphene\/lang\/analyze$/}, args => {
      return {path: path.resolve(__dirname, '../lang/analyze.ts')}
    })
    b.onResolve({filter: /^@graphene\/lang\/autocomplete$/}, args => {
      return {path: path.resolve(__dirname, '../lang/autocomplete.ts')}
    })
  },
}

const options = {
  entryPoints: [path.resolve(__dirname, 'src/extension.ts')],
  outfile: path.resolve(__dirname, 'out/extension.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  external: ['vscode'],
  plugins: [aliasPlugin],
}

if (isWatch) {
  const ctx = await context(options)
  await ctx.watch()
  console.log('esbuild watching...')
} else {
  await build(options)
}