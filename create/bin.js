#!/usr/bin/env node

import {access} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const devCli = join(__dirname, 'cli.ts')

let hasDevCli = await access(devCli).then(
  () => true,
  () => false,
)
if (hasDevCli) {
  await import('./cli.ts')
} else {
  await import('./dist/cli.js')
}
