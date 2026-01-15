#!/usr/bin/env zx

import {$, cd} from 'zx'
import {existsSync, mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync} from 'fs'
import {resolve} from 'path'

const BASE_PORT = 4003
const PORT_INCREMENT = 3
const COMMIT_TOOL = 'fork status'

$.verbose = true
$.quiet = true

// Show command output when a command fails
process.on('unhandledRejection', (error: any) => {
  if (error?.stdout) process.stdout.write(error.stdout)
  if (error?.stderr) process.stderr.write(error.stderr)
  process.exit(error?.exitCode ?? 1)
})

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

  // hard-link so that when mounted in a container we can still access it
  await $`ln ${root}/main/core/examples/flights/flights.duckdb ${treePath}/core/examples/flights/flights.duckdb`

  writeFileSync(`${treePath}/AGENTS.md`, `
    This folder contains the source for Graphene, a project that lets you define a data stack as code.

    There are two main repos, 'core' which contains our open-source package that allows for local development, and 'cloud' which contains a closed-source Graphene hosting platform we're developing.

    You should read @cloud/AGENTS.md and @core/AGENTS.md before doing anything.
  `.trim())
  await $`ln -s ${treePath}/AGENTS.md ${treePath}/CLAUDE.md`

  mkdirSync(`${treePath}/.claude`)
  writeFileSync(`${treePath}/.claude/settings.local.json`, `
    {
      "permissions": {
        "allow": [
          "Bash(xargs cat:*)",
          "Bash(pnpm graphene:*)",
          "Bash(grep:*)",
          "Bash(find:*)",
          "Bash(pnpm generate:*)",
          "Bash(pnpm test:*)",
          "Bash(pnpm lint:*)"
        ]
      }
    }
  `)

  console.log('Opening Zed...')
  await $`zed ${treePath}`

  await $`(cd ${treePath}/core && pnpm install)`
  await $`(cd ${treePath}/cloud && pnpm install)`

  console.log(`Worktree '${name}' is ready at ${treePath}`)
}

async function repoDirty (repo: string): Promise<boolean> {
  let status = (await $`git -C ${currentWorktree}/${repo} status --porcelain`).stdout.trim()
  return !!status
}

async function createWipCommit (repo: string): Promise<boolean> {
  if (!await repoDirty(repo)) return false
  console.log(`Creating WIP commit in ${repo}`)
  await $`git -C ${currentWorktree}/${repo} add -A`
  await $`git -C ${currentWorktree}/${repo} commit -m WIP`
  return true
}

async function resetWipCommit (repo: string): Promise<void> {
  let message = (await $`git -C ${currentWorktree}/${repo} log -1 --format=%s`).stdout.trim()
  if (message === 'WIP' || message.startsWith('WIP ')) {
    console.log(`Resetting WIP commit in ${repo}`)
    await $`git -C ${currentWorktree}/${repo} reset HEAD~1`
  }
}

async function hasWipCommits (repo: string): Promise<boolean> {
  // Check if any commits on the branch (not on origin/main) start with WIP
  let log = (await $`git -C ${currentWorktree}/${repo} log origin/main..HEAD --format=%s`).stdout.trim()
  if (!log) return false
  return log.split('\n').some(msg => msg === 'WIP' || msg.startsWith('WIP '))
}

async function commitWorktree () {
  if (await repoDirty('core')) await $`sh -c ${COMMIT_TOOL + ' ' + currentWorktree + '/core'}`
  if (await repoDirty('cloud')) await $`sh -c ${COMMIT_TOOL + ' ' + currentWorktree + '/cloud'}`
}

async function pullWorktree () {
  let wipCore = await createWipCommit('core')
  let wipCloud = await createWipCommit('cloud')

  let $$ = $({quiet: false})
  await $$`git -C ${currentWorktree}/core fetch origin`
  await $$`git -C ${currentWorktree}/cloud fetch origin`

  // Run both rebases even if one fails
  let coreError: Error | null = null
  let cloudError: Error | null = null

  let [coreResult, cloudResult] = await Promise.allSettled([
    $$`git -C ${currentWorktree}/core rebase origin/main`,
    $$`git -C ${currentWorktree}/cloud rebase origin/main`,
  ])

  if (coreResult.status === 'rejected') coreError = coreResult.reason
  if (cloudResult.status === 'rejected') cloudError = cloudResult.reason

  // Reset WIP commits on successful rebases
  if (!coreError && wipCore) await resetWipCommit('core')
  if (!cloudError && wipCloud) await resetWipCommit('cloud')

  // Print helpful messages if there were conflicts
  if (coreError || cloudError) {
    console.log('\nRebase conflicts detected:')
    if (coreError) console.log('  - core: resolve conflicts and run `git rebase --continue`')
    if (cloudError) console.log('  - cloud: resolve conflicts and run `git rebase --continue`')

    let wipRepos: string[] = []
    if (wipCore && coreError) wipRepos.push('core')
    if (wipCloud && cloudError) wipRepos.push('cloud')

    if (wipRepos.length > 0) {
      console.log(`\nReminder: You had uncommitted changes in ${wipRepos.join(' and ')} saved as WIP commits.`)
      console.log('After resolving conflicts, run `git reset HEAD~1` to restore them as uncommitted changes.')
    }
  }
}

async function pushWorktree () {
  if (await repoDirty('core') || await repoDirty('cloud')) return commitWorktree()

  // Check for WIP commits that shouldn't be pushed
  let coreHasWip = await hasWipCommits('core')
  let cloudHasWip = await hasWipCommits('cloud')
  if (coreHasWip || cloudHasWip) {
    let repos = [coreHasWip && 'core', cloudHasWip && 'cloud'].filter(Boolean).join(' and ')
    console.error(`Cannot push: ${repos} has commits starting with "WIP". Please squash or rename them first.`)
    return
  }

  await pullWorktree()
  await $`(cd ${currentWorktree}/core && pnpm lint && pnpm test)`
  await $`(cd ${currentWorktree}/cloud && pnpm lint && pnpm test)`
  let $$ = $({quiet: false})
  await $$`git -C ${currentWorktree}/core push origin HEAD:main`
  await $$`git -C ${currentWorktree}/cloud push origin HEAD:main`
}

// Start up a container for this worktree
async function upWorktree () {
  let name = currentName
  if (!name) throw new Error('Can only containerize named worktrees')
  let containerName = `graphene-${name}`
  let port = readGraphenePort(name)
  if (!port) throw new Error(`Could not read port for worktree '${name}'`)

  let envFile = `${root}/devcontainer.env`
  if (!existsSync(envFile)) throw new Error(`Missing ${envFile} - create it with your API keys`)

  writeFileSync(`${root}/${name}/Dockerfile.dev`, `
    FROM node:24-bookworm-slim

    # https://stackoverflow.com/questions/67732260/how-to-fix-hash-sum-mismatch-in-docker-on-mac
    RUN rm -rf /var/lib/apt/lists/*
    RUN apt-get clean
    RUN apt-get update -o Acquire::CompressionTypes::Order::=gz
    RUN echo 'Acquire::http::Pipeline-Depth 0;\\nAcquire::http::No-Cache true;\\nAcquire::BrokenProxy true;\\n' > /etc/apt/apt.conf.d/99fixbadproxy

    ENV PNPM_HOME="/pnpm"
    ENV PNPM_STORE_DIR="/pnpm/store"
    ENV PATH="$PNPM_HOME:$PATH"
    RUN corepack enable && corepack prepare pnpm@latest --activate
    pnpm config set store-dir /pnpm/store

    RUN npx -y playwright@1.54.2 install chromium --with-deps

    RUN apt-get install -y curl git git-lfs

    RUN npm install -g @anthropic-ai/claude-code
    RUN curl -fsSL https://opencode.ai/install | bash

    WORKDIR /${name}
  `)

  console.log('Building Docker image...')
  await $`docker build -f ${currentWorktree}/Dockerfile.dev -t graphene-dev ${currentWorktree}`

  // Stop existing container if running
  await $`docker rm -f ${containerName}`.nothrow()

  console.log('Starting container...')
  await $`docker run -d --name ${containerName} \
    --env-file ${envFile} \
    -p ${port}:${port} -p ${port + 1}:${port + 1} \
    --mount type=bind,source=${currentWorktree},target=/${name} \
    --mount type=volume,source=pnpm-store,target=/pnpm/store \
    --mount type=bind,source=${root}/main/cloud/.git,target=${root}/main/cloud/.git \
    --mount type=bind,source=${root}/main/core/.git,target=${root}/main/core/.git \
    graphene-dev \
    tail -f /dev/null`

  console.log('Installing dependencies...')
  await $`docker exec ${containerName} bash -c "(cd cloud && pnpm --force install) && (cd core && pnpm --force install)"`

  console.log(`Container '${containerName}' is running`)
}

// Run a command in the container. If no command is specified, open a shell
async function execWorktree (args: string[]) {
  let containerName = `graphene-${currentName}`

  // Check if container is running
  let running = await $`docker ps -q -f name=${containerName}`.nothrow()
  if (!running.stdout.trim()) {
    throw new Error(`Container '${containerName}' is not running. Run 'wt up' first.`)
  }

  if (args.length === 0) {
    // Interactive shell - use spawnSync to properly inherit TTY
    let {spawnSync} = await import('child_process')
    let result = spawnSync('docker', ['exec', '-it', containerName, 'bash'], {stdio: 'inherit'})
    if (result.status !== 0) process.exit(result.status ?? 1)
  } else {
    // Non-interactive command
    let $$ = $({quiet: false})
    await $$`docker exec ${containerName} ${args}`
  }
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
  case 'up': await upWorktree(); break
  case 'exec': await execWorktree(process.argv.slice(3)); break
  case 'done': await doneWorktree(); break
  default:
    console.log(`
Usage: wt <command>

Commands:
ls              List all paired worktrees
start <name>    Create a new paired worktree beside main
pull            Pull down latest changes from main for both repos
push            Rebase and push both repos
up              Start the dev container for this worktree
exec [cmd]      Run a command in the container (or bash if no command)
done            Archive both worktrees
`)
}
