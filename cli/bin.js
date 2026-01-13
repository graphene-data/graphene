#!/usr/bin/env node

import {fileURLToPath} from 'url'
import {dirname, join} from 'path'
import {existsSync} from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const devCli = join(__dirname, 'cli.ts')

// If Graphene has been npm-linked in, we can run cli.ts directly to avoid the build step
if (existsSync(devCli)) {
  await import('./cli.ts')
} else {
  await import('./dist/cli/cli.js')
}
