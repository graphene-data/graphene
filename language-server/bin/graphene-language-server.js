#!/usr/bin/env node

if (process.argv.includes('--version')) {
  const {
    default: {version},
  } = await import('../package.json', {
    with: {type: 'json'},
  })
  console.log(version)
} else {
  await import('../src/index.ts')
}
