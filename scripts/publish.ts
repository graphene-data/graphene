#!/usr/bin/env zx

import {$, fs} from 'zx'

// CI release entrypoint.
// The workflow checks out the PR merge commit SHA before invoking this script,
// so every side effect here (tag, package publish, GitHub release) is tied to that exact commit.

$.verbose = true
$.shell = 'bash'

// Require all credentials up front so we fail before creating tags or publishing anything.
if (!process.env.VSCE_PAT) throw new Error('VSCE_PAT required')
if (!process.env.OVSX_PAT) throw new Error('OVSX_PAT required')

// package.json is authoritative for release version; published packages must match exactly.
let rootVersion = await readVersion('package.json')
let cliVersion = await readVersion('cli/package.json')
let vscodeVersion = await readVersion('vscode/package.json')
let createVersion = await readVersion('create/package.json')
if (rootVersion !== cliVersion || rootVersion !== vscodeVersion || rootVersion !== createVersion) {
  throw new Error(`Version mismatch: package=${rootVersion}, cli=${cliVersion}, vscode=${vscodeVersion}, create=${createVersion}`)
}

let tag = `v${rootVersion}`

// Guard rails for retries and partial runs.
// We intentionally fail on existing tag/release so we never publish two different artifacts for one version.
await $`git fetch origin --tags --quiet`
let localTagExists = (await $`git rev-parse --verify refs/tags/${tag}`.nothrow()).exitCode === 0
if (localTagExists) throw new Error(`Tag ${tag} already exists locally`)

let remoteTag = (await $`git ls-remote --tags origin refs/tags/${tag}`.nothrow()).stdout.trim()
if (remoteTag) throw new Error(`Tag ${tag} already exists on origin`)

let existingRelease = (await $`gh release view ${tag}`.nothrow()).exitCode === 0
if (existingRelease) throw new Error(`GitHub release ${tag} already exists`)

let existingCreatePackage = (await $`npm view create-graphene@${rootVersion} version`.nothrow()).exitCode === 0
if (existingCreatePackage) throw new Error(`create-graphene@${rootVersion} already exists on npm`)

// Tag first so package registries and GitHub release all point to the same immutable version marker.
await $`git tag ${tag}`
await $`git push origin ${tag}`

// Publish package artifacts.
await $`pnpm -C cli build`
await $`npm publish cli/dist/npm --access public`
await $`pnpm -C create build`
await $`npm publish ./create`
await $`(cd vscode && npx vsce publish --no-dependencies)`
await $`(cd vscode && npx ovsx publish --no-dependencies)`

// Publish GitHub release notes from the matching changelog section.
let changelog = await fs.readFile('CHANGELOG.md', 'utf8')
let releaseNotes = getChangelogSection(changelog, rootVersion)
await fs.writeFile('.release-notes.md', releaseNotes)
await $`gh release create ${tag} --title ${tag} --notes-file .release-notes.md`

console.log(`Published ${tag}`)

async function readVersion(path: string) {
  // Read and validate strict semver from a package manifest.
  let json = JSON.parse(await fs.readFile(path, 'utf8'))
  let version = json.version
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid semver in ${path}: ${version}`)
  return version
}

function getChangelogSection(changelog: string, version: string) {
  // Extract the exact markdown block under "## <version>" until the next top-level version heading.
  let targetHeader = `## ${version}`
  let lines = changelog.split('\n')
  let start = lines.findIndex(line => line.trim() === targetHeader)
  if (start === -1) throw new Error(`Missing changelog section for ${version}`)

  let end = lines.findIndex((line, idx) => idx > start && /^##\s+/.test(line))
  let section = lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim()
  if (!section) throw new Error(`Changelog section for ${version} is empty`)

  return `## ${version}\n\n${section}`
}
