#!/usr/bin/env zx

import {$, question} from 'zx'
import {existsSync, mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync} from 'fs'
import {basename, resolve} from 'path'

const BASE_PORT = 4003
const PORT_INCREMENT = 3

// Root that contains all worktrees, along with `main`
async function getGrapheneRoot (): Promise<string> {
  let toplevel = await $`git rev-parse --show-toplevel`
  return resolve(toplevel.stdout.trim(), '../..')
}

function getTreePath (root: string, name: string): string {
  return resolve(root, name)
}

function getCloudMainPath (root: string): string {
  return resolve(root, 'main', 'cloud')
}

function getCoreMainPath (root: string): string {
  return resolve(root, 'main', 'core')
}

function getCloudWorktreePath (root: string, name: string): string {
  return resolve(root, name, 'cloud')
}

function getCoreWorktreePath (root: string, name: string): string {
  return resolve(root, name, 'core')
}

async function currentTreeName (): Promise<string | null> {
  try {
    let toplevel = await $`git rev-parse --show-toplevel`
    return basename(resolve(toplevel.stdout.trim(), '..'))
  } catch {
    return null
  }
}

function getTreeNames (root: string): string[] {
  return readdirSync(root, {withFileTypes: true})
    .filter(entry => entry.isDirectory() && entry.name !== 'main' && !entry.name.startsWith('.'))
    .map(entry => entry.name)
    .sort()
}

function readGraphenePort (envPath: string): number | null {
  if (!existsSync(envPath)) return null
  let match = readFileSync(envPath, 'utf8').match(/^GRAPHENE_PORT=(\d+)$/m)
  return match ? parseInt(match[1], 10) : null
}

function getUsedPorts (root: string): Set<number> {
  let used = new Set<number>()
  for (let name of getTreeNames(root)) {
    let corePort = readGraphenePort(resolve(getCoreWorktreePath(root, name), '.env'))
    if (corePort != null) {
      used.add(corePort)
      continue
    }
    let cloudPort = readGraphenePort(resolve(getCloudWorktreePath(root, name), '.env'))
    if (cloudPort != null) used.add(cloudPort - 1)
  }
  return used
}

function getNextPort (root: string): number {
  let used = getUsedPorts(root)
  let port = BASE_PORT
  while (used.has(port) || used.has(port + 1)) {
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

async function listWorktrees () {
  let root = await getGrapheneRoot()
  let trees = getTreeNames(root)

  if (trees.length === 0) {
    console.log('No active worktrees found')
    return
  }

  for (let name of trees) {
    let corePort = readGraphenePort(resolve(getCoreWorktreePath(root, name), '.env'))
    let cloudPort = readGraphenePort(resolve(getCloudWorktreePath(root, name), '.env'))
    let portInfo: string[] = []
    if (corePort != null) portInfo.push(`core:${corePort}`)
    if (cloudPort != null) portInfo.push(`cloud:${cloudPort}`)
    let suffix = portInfo.length ? ` (${portInfo.join(', ')})` : ''
    console.log(`  ${name}${suffix}`)
  }
}

async function startWorktree (name: string) {
  if (!name) throw new Error('Please provide a name for the worktree')
  if (name === 'main') throw new Error('Cannot create a worktree named "main"')

  let root = await getGrapheneRoot()
  let treePath = getTreePath(root, name)

  if (existsSync(treePath)) throw new Error(`${treePath} already exists`)
  mkdirSync(treePath, {recursive: true})

  let basePort = getNextPort(root)
  let corePort = basePort
  let cloudPort = basePort + 1

  await $`git -C ${root}/main/cloud worktree add ${getCloudWorktreePath(root, name)} -b ${name}`
  await $`git -C ${root}/main/core worktree add ${getCoreWorktreePath(root, name)} -b ${name}`

  writeEnvWithPort(
    resolve(root, 'main', 'cloud', '.env'),
    resolve(getCloudWorktreePath(root, name), '.env'),
    name,
    cloudPort,
  )
  writeEnvWithPort(
    resolve(root, 'main', 'core', '.env'),
    resolve(getCoreWorktreePath(root, name), '.env'),
    name,
    corePort,
  )
  console.log(`Assigned ports → core:${corePort}, cloud:${cloudPort}`)

  await $`(cd ${treePath}/core && pnpm install)`
  await $`(cd ${treePath}/cloud && pnpm install)`
  await $`ln -sf ${root}/main/core/examples/flights/flights.duckdb ${treePath}/core/examples/flights/flights.duckdb`

  writeFileSync(`${root}/AGENTS.md`, `
    This folder contains the source for Graphene, a project that lets you define a data stack as code.

    There are two main folders, 'core' which contains our open-source package that allows for local development, and 'cloud' which contains a closed-source Graphene hosting platform we're developing.

    It's important that you always go read core/AGENTS.md before you do anything, as it provides a lot of the context and coding convetions that are relevant to all Graphene development, not just that of core.
  `.trim())

  console.log('Opening Zed...')
  await $`zed ${treePath}`

  console.log(`Worktree '${name}' is ready at ${treePath}`)
}

async function repoDirty (repo: string): boolean {

}

async function commitWorktree () {
  if (repoDirty('core')) await $`gitx -c ${worktreeCorePath}`
  if (repoDirty('cloud')) await $`gitx -c ${worktreeCloudPath}`
}

async function mergeWorktree () {
  if (repoDirty('core') || repoDirty('cloud')) return commitWorktree()

  let currentBranch = await $`git branch --show-current`
  let branchName = currentBranch.stdout.trim()

  console.log(`Merging branch '${branchName}' to main...`)
  await $`git fetch origin`
  await $`git rebase origin/main`

  let res = await $`git merge-base --is-ancestor origin/main HEAD`
  if (res.exitCode) {
    console.error('Not a fast-forward, refusing to push.')
    process.exit(1)
  }

  await $`git push origin HEAD:main`
}

async function doneWorktree (name?: string) {
  name ||= await currentTreeName() || undefined
  if (!name) throw new Error('Please provide the worktree name to remove')
  if (name === 'main') throw new Error('Cannot mark main as done')

  let root = await getGrapheneRoot()
  let treePath = getTreePath(root, name)
  let cloudPath = getCloudWorktreePath(root, name)
  let corePath = getCoreWorktreePath(root, name)

  if (!existsSync(treePath)) throw new Error(`Worktree '${name}' not found`)

  let dirtyReports: Array<{repo: string, status: string}> = []

  if (existsSync(cloudPath)) {
    let status = (await $`git -C ${cloudPath} status --porcelain`).stdout.trim()
    if (status) dirtyReports.push({repo: 'cloud', status})
  }

  if (existsSync(corePath)) {
    let status = (await $`git -C ${corePath} status --porcelain`).stdout.trim()
    if (status) dirtyReports.push({repo: 'core', status})
  }

  let force = false
  if (dirtyReports.length > 0) {
    console.log(`Outstanding changes in '${name}':`)
    for (let report of dirtyReports) {
      console.log(`--- ${report.repo} ---`)
      console.log(report.status)
    }
    let answer = (await question('Force remove these worktrees (discard changes)? [y/N] ')).trim().toLowerCase()
    if (answer === 'y' || answer === 'yes') force = true
    else {
      console.log('Aborted.')
      return
    }
  }

  if (existsSync(cloudPath)) {
    console.log(`Removing cloud worktree${force ? ' (force)' : ''}`)
    if (force) {
      await $`git -C ${getCloudMainPath(root)} worktree remove --force ${cloudPath}`
    } else {
      await $`git -C ${getCloudMainPath(root)} worktree remove ${cloudPath}`
    }
    await $`git -C ${getCloudMainPath(root)} tag archive/${name} ${name}`
    await $`git -C ${getCloudMainPath(root)} branch -d ${name}`
  }

  if (existsSync(corePath)) {
    console.log(`Removing core worktree${force ? ' (force)' : ''}`)
    if (force) {
      await $`git -C ${getCoreMainPath(root)} worktree remove --force ${corePath}`
    } else {
      await $`git -C ${getCoreMainPath(root)} worktree remove ${corePath}`
    }
    await $`git -C ${getCoreMainPath(root)} tag archive/${name} ${name}`
    await $`git -C ${getCoreMainPath(root)} branch -d ${name}`
  }

  rmSync(treePath, {recursive: true, force: true})
}

async function main () {
  let command = process.argv[2]
  let arg = process.argv[3]

  switch (command) {
    case 'ls':
      await listWorktrees()
      break
    case 'start':
      await startWorktree(arg)
      break
    case 'pull':
      await $`git stash`
      await $`git fetch`
      await $`git rebase origin/main`
      await $`git stash pop`
      break
    case 'push':
    case 'commit':
    case 'merge':
      await mergeWorktree()
      break
    case 'done':
      await doneWorktree(arg)
      break
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
}

main().catch(console.error)
