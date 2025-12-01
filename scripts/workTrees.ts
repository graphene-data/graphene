#!/usr/bin/env zx

import {$, cd} from 'zx'
import {existsSync, mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync} from 'fs'
import {resolve} from 'path'

const BASE_PORT = 4003
const PORT_INCREMENT = 3

$.verbose = true

// root is the path that contains all of the graphene worktrees
let root = resolve(import.meta.dirname, '../../..')

let currentWorktree = ''
if (resolve(process.cwd(), '..') == root) { // if cwd it at the top of the worktree (ie one below the root)
  currentWorktree = process.cwd()
} else { // otherwise, we're somewhere in one of the git repos, so use git to anchor our path
  currentWorktree = (await $`git rev-parse --show-toplevel`).stdout.trim()
  currentWorktree = resolve(currentWorktree, '..')
}

let currentName = currentWorktree.split('/').pop()

function getTreeNames (): string[] {
  return readdirSync(root, {withFileTypes: true})
    .filter(entry => entry.isDirectory() && entry.name !== 'main' && !entry.name.startsWith('.'))
    .map(entry => entry.name)
    .sort()
}

function readGraphenePort (treeName: string): number | null {
  let envPath = resolve(root, treeName, 'core/.env')
  if (!existsSync(envPath)) return null
  let match = readFileSync(envPath, 'utf8').match(/^GRAPHENE_PORT=(\d+)$/m)
  return match ? parseInt(match[1], 10) : null
}

function getNextPort (): number {
  let used = getTreeNames().map(readGraphenePort)
  let port = BASE_PORT
  while (used.includes(port)) {
    port += PORT_INCREMENT
  }
  return port
}

function writeEnvWithPort (sourcePath: string, targetPath: string, name: string, port: number) {
  let content = existsSync(sourcePath) ? readFileSync(sourcePath, 'utf8') : ''
  if (content.length && !content.endsWith('\n')) content += '\n'
  content += `WT_NAME=${name}\nGRAPHENE_PORT=${port}\n`
  writeFileSync(targetPath, content)
}

function listWorktrees () {
  let trees = getTreeNames()
  if (trees.length === 0) console.log('No active worktrees found')

  for (let name of trees) {
    console.log(`  ${name} :${readGraphenePort(name)}`)
  }
}

async function startWorktree (name: string) {
  if (!name) throw new Error('Please provide a name for the worktree')
  if (name === 'main') throw new Error('Cannot create a worktree named "main"')

  let treePath = resolve(root, name)
  if (existsSync(treePath)) throw new Error(`${treePath} already exists`)
  mkdirSync(treePath, {recursive: true})

  await $`git -C ${root}/main/cloud fetch origin main`
  await $`git -C ${root}/main/core fetch origin main`
  await $`git -C ${root}/main/cloud worktree add ${root}/${name}/cloud -b ${name} origin/main`
  await $`git -C ${root}/main/core worktree add ${root}/${name}/core -b ${name} origin/main`

  let basePort = getNextPort()
  writeEnvWithPort(`${root}/main/core/.env`, `${treePath}/core/.env`, name, basePort)
  writeEnvWithPort(`${root}/main/cloud/.env`, `${treePath}/cloud/.env`, name, basePort + 1)

  console.log(`Assigned ports → core:${basePort}`)

  await $`(cd ${treePath}/core && pnpm install)`
  await $`(cd ${treePath}/cloud && pnpm install)`
  await $`ln -sf ${root}/main/core/examples/flights/flights.duckdb ${treePath}/core/examples/flights/flights.duckdb`

  writeFileSync(`${treePath}/AGENTS.md`, `
    This folder contains the source for Graphene, a project that lets you define a data stack as code.

    There are two main repos, 'core' which contains our open-source package that allows for local development, and 'cloud' which contains a closed-source Graphene hosting platform we're developing.

    It's important that you always go read core/AGENTS.md before you do anything, as it provides a lot of the context and coding convetions that are relevant to all Graphene development, not just that of core.
  `.trim())
  await $`ln -s ${treePath}/AGENTS.md ${treePath}/CLAUDE.md`

  console.log('Opening Zed...')
  await $`zed ${treePath}`

  console.log(`Worktree '${name}' is ready at ${treePath}`)
}

async function repoDirty (repo: string): Promise<boolean> {
  let status = (await $`git -C ${currentWorktree}/${repo} status --porcelain`).stdout.trim()
  return !!status
}

async function commitWorktree () {
  if (await repoDirty('core')) await $`osascript -e 'do shell script "cd ${currentWorktree}/core && gitx -c"'`
  if (await repoDirty('cloud')) await $`osascript -e 'do shell script "cd ${currentWorktree}/cloud && gitx -c"'`
}

async function pullWorktree () {
  let stashCore = false, stashCloud = false
  if (await repoDirty('core')) {
    stashCore = true
    console.log('Stashing core')
    await $`git -C ${currentWorktree}/core stash -m 'pulling onto ${currentName}'`
  }
  if (await repoDirty('cloud')) {
    stashCloud = true
    console.log('Stashing cloud')
    await $`git -C ${currentWorktree}/cloud stash -m 'pulling onto ${currentName}'`
  }

  await $`git -C ${currentWorktree}/core fetch origin`
  await $`git -C ${currentWorktree}/cloud fetch origin`

  await $`git -C ${currentWorktree}/core rebase origin/main`
  await $`git -C ${currentWorktree}/cloud rebase origin/main`

  if (stashCore) await $`git -C ${currentWorktree}/core stash pop`
  if (stashCloud) await $`git -C ${currentWorktree}/cloud stash pop`
}

async function pushWorktree () {
  if (await repoDirty('core') || await repoDirty('cloud')) return commitWorktree()

  await pullWorktree()
  await $`git -C ${currentWorktree}/core push origin HEAD:main`
  await $`git -C ${currentWorktree}/cloud push origin HEAD:main`
}

async function doneWorktree () {
  console.log('Archiving worktree ' + currentName)
  if (currentName === 'main') throw new Error('Cannot mark main as done')

  if (await repoDirty('core') || await repoDirty('cloud')) {
    return console.log('Repos have uncommited changes. Consider committing first')
  }

  try {
    await $`git -C ${currentWorktree}/core merge-base --is-ancestor ${currentName} origin/main`
  } catch {
    return console.error(`core branch '${currentName}' has not been merged into main. Merge it before running 'wt done'.`)
  }

  try {
    await $`git -C ${currentWorktree}/cloud merge-base --is-ancestor ${currentName} origin/main`
  } catch {
    return console.error(`cloud branch '${currentName}' has not been merged into main. Merge it before running 'wt done'.`)
  }

  cd(root) // cd to root, since we might be about to delete the cwd
  await $`git -C ${root}/main/core worktree remove ${currentWorktree}/core`
  await $`git -C ${root}/main/cloud worktree remove ${currentWorktree}/cloud`
  rmSync(currentWorktree, {recursive: true, force: true})

  // archive the branches for both worktrees
  await $`git -C ${root}/main/core tag archive/${currentName} ${currentName}`
  await $`git -C ${root}/main/core branch -D ${currentName}`
  await $`git -C ${root}/main/cloud tag archive/${currentName} ${currentName}`
  await $`git -C ${root}/main/cloud branch -D ${currentName}`
}

let command = process.argv[2]
let arg = process.argv[3]

switch (command) {
  case 'ls': listWorktrees(); break
  case 'start': await startWorktree(arg); break
  case 'pull': await pullWorktree(); break
  case 'commit': await commitWorktree(); break
  case 'push': await pushWorktree(); break
  case 'done': await doneWorktree(); break
  default:
    console.log(`
Usage: wt <command>

Commands:
ls              List all paired worktrees
start <name>    Create a new paired worktree beside main
pull            Pull down latest changes from main for both repos
push            Rebase and push both repos
done            Archive both worktrees
`)
}
