#!/usr/bin/env node
import {argv} from 'node:process'

if (argv.includes('--version')) {
  let {
    default: {version},
  } = await import('../package.json', {
    with: {type: 'json'},
  })
  console.log(version)
} else {
  await import('../src/index.ts')
}
