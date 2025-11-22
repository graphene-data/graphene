#!/usr/bin/env zx

import {$, argv, fs, question} from 'zx'

// You'll need a env file that has the following tokens: VSCE_PAT, OVSX_PAT
// node --env-file ../publish.env scripts/publish.ts patch

$.verbose = true

const bumpLevel = argv._[0]
if (!['major', 'minor', 'patch'].includes(bumpLevel)) {
  throw new Error('Must provide major|minor|patch')
}

if (!process.env.VSCE_PAT) throw new Error('VSCE_PAT required')
if (!process.env.OVSX_PAT) throw new Error('OVSX_PAT required')

const branch = (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim()
if (branch !== 'main') throw new Error('Publishing must run on main')

const status = (await $`git status --porcelain`).stdout.trim()
if (status.length > 0) throw new Error('Working tree must be clean before publishing')

await $`git fetch origin main --quiet`
const tracking = (await $`git status -sb`).stdout.split('\n')[0]
if (tracking.includes('behind')) {
  if (!(await confirm('Repo is behind origin/main. Continue anyway? (y/N) '))) process.exit(1)
}

await $`pnpm lint`
await $`pnpm test`
await $`pnpm check-examples`


await $`(cd cli && npm version ${bumpLevel} --no-git-tag-version)`
await $`(cd vscode && npm version ${bumpLevel} --no-git-tag-version)`

await $`(cd cli && npm publish --access public --dry-run)`
if (!(await confirm('Does the npm publish dry run look right? (y/N) '))) process.exit(1)

await $`(cs vscode && npx vsce package --no-dependencies)`
if (!(await confirm('Does the vsce package look right? (y/N) '))) process.exit(1)

await $`(cd vscode && npx vsce publish)`
await $`(cd vscode && npx ovsx publish)`

const version = JSON.parse(await fs.readFile('cli/package.json', 'utf8')).version
await $`git add -a .`
await $`git commit -m ${`Release v${version}`}`
await $`git tag v${version}`

await $`git push origin main`
await $`git push origin v${version}`


async function confirm (prompt: string) {
  let answer = (await question(prompt)).trim().toLowerCase()
  return answer === 'y' || answer === 'yes'
}
