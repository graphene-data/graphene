import process from 'node:process'

import {runCreate} from './create.ts'

await runCreate({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  env: process.env,
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
})
