#!/usr/bin/env zx

import {$, question} from 'zx'
import {readFileSync, existsSync, writeFileSync, readdirSync} from 'fs'
import {resolve} from 'path'

// Helper to find the main repository root
async function getMainRepoRoot (): Promise<string> {
  try {
    let toplevel = await $`git rev-parse --git-common-dir`
    return resolve(toplevel.stdout.trim(), '..')
  } catch {
    console.error('Error: Not in a git repository')
    process.exit(1)
  }
}

// Helper to get all active worktrees and their metadata
async function getActiveWorktrees (): Promise<Array<{name: string, port: number, path: string}>> {
  let mainRoot = await getMainRepoRoot()
  let wtDir = resolve(mainRoot, '.wt')

  if (!existsSync(wtDir)) {
    return []
  }

  let worktrees: any[] = []
  let entries = readdirSync(wtDir, {withFileTypes: true})

  for (let entry of entries) {
    if (entry.isDirectory()) {
      let envPath = resolve(wtDir, entry.name, '.env')
      if (existsSync(envPath)) {
        let envContent = readFileSync(envPath, 'utf8')
        let port = envContent.match(/^GRAPHENE_PORT=(\d+)$/m)

        worktrees.push({
          name: entry.name,
          port: port ? parseInt(port[1]) : null,
          path: resolve(wtDir, entry.name),
        })
      }
    }
  }

  return worktrees.sort((a, b) => a.port - b.port)
}

// Helper to find the next available port
async function getNextAvailablePort (): Promise<number> {
  let worktrees = await getActiveWorktrees()
  let usedPorts = worktrees.map(wt => wt.port)

  let port = 4003
  while (usedPorts.includes(port)) {
    port += 3
  }

  return port
}

// Command: wt ls
async function listWorktrees () {
  let worktrees = await getActiveWorktrees()

  if (worktrees.length === 0) {
    console.log('No active worktrees found')
    return
  }

  for (let wt of worktrees) {
    console.log(`  ${wt.name} (port ${wt.port}) - ${wt.path}`)
  }
}

// Command: wt start <name>
async function startWorktree (name: string) {
  if (!name) {
    console.error('Error: Please provide a name for the worktree')
    process.exit(1)
  }

  let mainRoot = await getMainRepoRoot()
  let wtDir = resolve(mainRoot, '.wt')
  let worktreePath = resolve(wtDir, name)

  // Check if worktree already exists
  if (existsSync(worktreePath)) {
    console.error(`Error: Worktree '${name}' already exists`)
    process.exit(1)
  }

  try {
    // Create worktree
    await $`git worktree add ${worktreePath} -b ${name}`
    console.log(`Created worktree: ${worktreePath}`)

    // Get next available port
    let port = await getNextAvailablePort()

    // Create .env file
    let envContent = `WT_NAME=${name}\nGRAPHENE_PORT=${port}\n`
    writeFileSync(resolve(worktreePath, '.env'), envContent)
    console.log(`Assigned port: ${port}`)

    // Run pnpm install
    console.log('Installing dependencies...')
    await $`cd ${worktreePath} && pnpm install`

    await $`ln -s ${mainRoot}/examples/flights/flights.duckdb ${worktreePath}/examples/flights/flights.duckdb`

    // Open Zed
    console.log('Opening Zed...')
    await $`zed ${worktreePath}`

    console.log(`Worktree '${name}' is ready!`)
  } catch (error) {
    console.error(`Error creating worktree: ${error}`)
    process.exit(1)
  }
}

// Command: wt merge
async function mergeWorktree () {
  // Get current branch name
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

// Command: wt done <name>
async function doneWorktree (name?: string) {
  name = name || (await $`git branch --show-current`).stdout.trim()
  if (name == 'main') throw new Error('Cant mark main as done')

  let mainRoot = await getMainRepoRoot()
  let worktreePath = resolve(mainRoot, '.wt', name)

  if (!existsSync(worktreePath)) {
    console.error(`Error: Worktree '${name}' not found`)
    process.exit(1)
  }

  // Check for outstanding changes using a single porcelain status; prompt if any
  let statusRaw = (await $`git -C ${worktreePath} status --porcelain`).stdout
  let hasChanges = statusRaw.trim().length > 0

  let forceFlag = false
  if (hasChanges) {
    console.log(`Outstanding changes in '${name}':`)
    console.log(statusRaw.trim())
    let answer = (await question('Force remove this worktree (discard changes)? [y/N] ')).trim().toLowerCase()
    if (answer === 'y' || answer === 'yes') forceFlag = true
    else {
      console.log('Aborted.')
      process.exit(1)
    }
  }

  console.log(`Removing worktree${forceFlag ? ' (force)' : ''}`)
  if (forceFlag) {
    await $`git worktree remove --force ${worktreePath}`
  } else {
    await $`git worktree remove ${worktreePath}`
  }
  console.log('Archiving ')
  await $`git tag archive/${name} ${name}`
  await $`git branch -d ${name}`
}

// Main CLI handler
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
    case 'merge':
      await mergeWorktree()
      await doneWorktree()
      break
    case 'done':
      await doneWorktree(arg)
      break
    default:
      console.log(`
Usage: wt <command>

Commands:
  ls              List all active worktrees
  start <name>    Create a new worktree
  merge           Rebase, squash merge, and push current branch
  done <name>     Archive a worktree
`)
  }
}

main().catch(console.error)
