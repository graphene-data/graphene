import {defineConfig} from '@vscode/test-cli'
import {mkdirSync, rmSync, writeFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

let __filename = fileURLToPath(import.meta.url)
let __dirname = path.dirname(__filename)
let workspaceRoot = path.join(__dirname, '.vscode-test', 'workspace')

rmSync(workspaceRoot, {recursive: true, force: true})
mkdirSync(workspaceRoot, {recursive: true})
writeFileSync(path.join(workspaceRoot, 'package.json'), JSON.stringify({name: 'graphene-vscode-e2e', version: '0.0.0', type: 'module', graphene: {duckdb: {}}}, null, 2))
writeFileSync(path.join(workspaceRoot, 'query.gsql'), 'from users select id\n')

export default defineConfig({
  files: 'dist/e2e/**/*.js',
  workspaceFolder: workspaceRoot,
  launchArgs: ['--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes'],
  env: {
    GRAPHENE_VSCODE_E2E_WORKSPACE: workspaceRoot,
  },
})
