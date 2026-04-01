import process from 'node:process'

import {runCreate} from './index.ts'

await runCreate({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
})
