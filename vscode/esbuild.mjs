import {build} from 'esbuild'
import {cp} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const aliasPlugin = {
  name: 'alias-lang-analyze',
  setup(b) {
    b.onResolve({filter: /^@graphene\/lang$/}, _args => {
      return {path: path.resolve(__dirname, '../lang/core.ts')}
    })
  },
}

await build({
  entryPoints: [path.resolve(__dirname, 'src/extension.ts')],
  outfile: path.resolve(__dirname, 'dist/extension.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  external: ['vscode'],
  plugins: [aliasPlugin],
})

await build({
  entryPoints: [path.resolve(__dirname, 'src/languageServer.ts')],
  outfile: path.resolve(__dirname, 'dist/server.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  external: ['vscode'],
  plugins: [aliasPlugin],
})

cp(path.resolve(__dirname, '../cli/LICENSE.md'), path.resolve(__dirname, 'LICENSE.md'))
