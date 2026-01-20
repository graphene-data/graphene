#!/usr/bin/env zx

import {$, cd} from 'zx'
import fs from 'fs'
import {resolve} from 'path'

const BASE_PORT = 4003
const PORT_INCREMENT = 3
const COMMIT_TOOL = process.env.COMMIT_TOOL || 'fork status'

$.verbose = !!process.env.DEBUG

// Get the top of the repo. We might be in a submodule, in which case we'd like the superproject
let currentWorktree = (await $`git rev-parse --show-superproject-working-tree`).stdout.trim() || (await $`git rev-parse --show-toplevel`).stdout.trim()
let root = resolve(currentWorktree, '..') // folder that contains all the worktrees
let currentName = currentWorktree.split('/').pop() || ''

let args = process.argv.slice(2)
let command = args[0]
let flags = args.filter(a => a.startsWith('--'))
let positional = args.slice(1).filter(a => !a.startsWith('--'))

switch (command) {
  case 'start': await startWorktree(positional[0]); break
  // case 'drop': await dropWorktree(positional[0]); break
  case 'pull': await pullWorktree(); break
  case 'commit': await commitWorktree(); break
  case 'push': await pushWorktree(flags.includes('--updateCore')); break
  case 'up': await upWorktree(currentName); break
  case 'exec': await execWorktree(process.argv.slice(3)); break
  case 'done': await doneWorktree(); break
  default:
    console.log(`
Usage: wt <command>

Commands:
ls                      List all paired worktrees
start <name>            Create a new paired worktree beside main
pull                    Pull down latest changes from main for both repos
push [--updateCore]     Rebase and push both repos. Use --updateCore to update the submodule pointer.
up                      Start the dev container for this worktree
exec [cmd]              Run a command in the container (or bash if no command)
done                    Archive both worktrees
`)
}

async function startWorktree (name: string) {
  if (!name) throw new Error('Please provide a name for the worktree')
  if (name === 'main') throw new Error('Cannot create a worktree named "main"')

  let treePath = resolve(root, name)
  if (fs.existsSync(treePath)) throw new Error(`${treePath} already exists`)
  fs.mkdirSync(treePath)

  // create the worktree and init submodules
  await $`git -C ${root}/main fetch origin main`
  await $`git -C ${root}/main worktree add ${treePath} -b ${name} origin/main`
  await $`git -C ${treePath} submodule update --init --recursive`

  // Submodules start out detached. Create a branch so we can commit/push changes
  await $`git -C ${treePath}/core checkout -b ${name}`

  // Assign unique ports to the worktree, and write it to .env along with copying main's .env
  let basePort = getNextPort()
  let envContent = fs.readFileSync(`${root}/main/.env`) + `\nWT_NAME=${name}\nGRAPHENE_PORT=${basePort}`
  fs.writeFileSync(`${treePath}/.env`, envContent)
  console.log(`Assigned ports → core:${basePort}`)

  await $`mkdir .opencode`
  await $`ln -s ../dev/opencode.jsonc opencode.jsonc`
  await $`ln -s ../dev/skills .opencode/skills`

  // hard-link so that when mounted in a container we can still access it
  await $`ln ${root}/main/core/examples/flights/flights.duckdb ${treePath}/core/examples/flights/flights.duckdb`

  await upWorktree(name)
  await $`zed ${treePath}`

  console.log(`Worktree '${name}' is ready at ${treePath}`)
}

// Start up a container for this worktree
async function upWorktree(name:string) {
  if (!name) throw new Error('Not in a worktree')
  let containerName = `graphene-${name}`
  let treePath = `${root}/${name}`
  let port = readGraphenePort(name)
  if (!port) throw new Error('Couldnt determine ports for worktree')
  let envFile = `${root}/devcontainer.env`

  // Build our image against main, since it shouldn't change for any worktree
  // We could skip this step if the image already exists, but this seems pretty fast, and catches dockerfile changes
  console.log('Building Docker image...')
  await $`docker build -f ${root}/main/scripts/Dockerfile.dev -t graphene-dev ${root}/main`

  await $`docker rm -f ${containerName}`.quiet().nothrow() // Stop existing container if running

  console.log('Starting container...')
  await $`docker run -d --name ${containerName} \
    --env-file ${envFile} \
    -p ${port}:${port} -p ${port + 1}:${port + 1} -p ${port + 2}:${port + 2} \
    --workdir /${name} \
    --mount type=bind,source=${treePath},target=/${name} \
    --mount type=volume,source=pnpm-store,target=/pnpm/store \
    --mount type=bind,source=${root}/main/.git,target=${root}/main/.git \
    graphene-dev \
    tail -f /dev/null`

  console.log('Installing dependencies...')
  await $`docker exec ${containerName} bash -c "(cd cloud && pnpm --force install) && (cd core && pnpm --force install)"`

  console.log(`Container '${containerName}' is running`)
}

async function repoDirty (subdir?: string): Promise<boolean> {
  let path = subdir ? `${currentWorktree}/${subdir}` : currentWorktree
  let exclude = subdir ? [] : ['core']
  let status = (await $`git -C ${path} status --porcelain`).stdout.trim()

  // in the co repo, we ignore outstanding change to submodules
  let lines = status.split('\n').filter(l => {
    return !exclude.some(e => l == `M ${e}`) && !!l
  })
  return lines.length > 0
}

async function hasWipCommits (subdir?: string): Promise<boolean> {
  // Check if any commits on the branch (not on origin/main) start with WIP
  let path = subdir ? `${currentWorktree}/${subdir}` : currentWorktree
  let log = (await $`git -C ${path} log origin/main..HEAD --format=%s`).stdout.trim()
  if (!log) return false
  return log.split('\n').some(msg => msg === 'WIP' || msg.startsWith('WIP '))
}

async function commitWorktree () {
  if (await repoDirty('core')) await $`sh -c ${COMMIT_TOOL + ' ' + currentWorktree + '/core'}`
  if (await repoDirty()) await $`sh -c ${COMMIT_TOOL + ' ' + currentWorktree}`
}

async function rebaseRepo (subdir?: string, onto?: string): Promise<boolean> {
  let path = subdir ? `${currentWorktree}/${subdir}` : currentWorktree
  let label = subdir || 'co'

  // Check for in-progress rebase
  let rebaseMerge = resolve(path, '.git', 'rebase-merge')
  let rebaseApply = resolve(path, '.git', 'rebase-apply')
  if (fs.existsSync(rebaseMerge) || fs.existsSync(rebaseApply)) {
    console.log(`${label} rebase still in progress. Resolve conflicts and run \`git rebase --continue\`, then run \`wt pull\` again.`)
    return false
  }

  // Create WIP commit if dirty (excluding submodule pointer in superproject to avoid conflicts)
  if (await repoDirty(subdir)) {
    console.log(`Creating WIP commit in ${label}`)
    if (subdir) {
      await $`git -C ${path} add -A`
    } else {
      // In superproject, add everything except the submodule pointer
      await $`git -C ${path} add -A -- . :!core`
    }
    // Only commit if we actually staged something
    let hasStagedChanges = (await $`git -C ${path} diff --cached --quiet`.nothrow()).exitCode !== 0
    if (hasStagedChanges) {
      await $`git -C ${path} commit -m WIP`
    }
  }

  await $`git -C ${path} fetch origin`

  try {
    await $`git -C ${path} rebase ${onto || 'origin/main'}`
  } catch (e) {
    console.log(`\n${label} rebase conflicts detected. Resolve conflicts and run \`git rebase --continue\`, then run \`wt pull\` again.`)
    return false
  }

  // Reset WIP commit if HEAD is one
  let message = (await $`git -C ${path} log -1 --format=%s`).stdout.trim()
  if (message === 'WIP' || message.startsWith('WIP ')) {
    console.log(`Resetting WIP commit in ${label}`)
    await $`git -C ${path} reset HEAD~1`
  }

  return true
}

async function pullWorktree (): Promise<boolean> {
  // Rebase cloud first, then core (both onto origin/main)
  if (!await rebaseRepo()) return false

  // Before rebasing core, check if all local commits already exist on origin/main (with different SHAs from rebase-merge).
  // Use cherry to compare by patch content: - means equivalent exists, + means unique to our branch.
  await $`git -C ${currentWorktree}/core fetch origin`
  let cherryOutput = (await $`git -C ${currentWorktree}/core cherry origin/main`.nothrow()).stdout.trim()
  let hasUnmergedCommits = cherryOutput.split('\n').some(line => line.startsWith('+ '))
  if (!hasUnmergedCommits) {
    // All our commits (if any) have been merged, just move to origin/main
    let originMain = (await $`git -C ${currentWorktree}/core rev-parse origin/main`).stdout.trim()
    let currentCore = (await $`git -C ${currentWorktree}/core rev-parse HEAD`).stdout.trim()
    if (originMain !== currentCore) {
      console.log('Updating core submodule to origin/main (local commits already merged)')
      await $`git -C ${currentWorktree}/core checkout origin/main`
    }
  } else {
    // We have local commits to preserve, rebase them onto origin/main
    if (!await rebaseRepo('core', 'origin/main')) return false
  }

  return true
}

async function pushWorktree (updateCore: boolean) {
  // Check for uncommitted changes (excluding core submodule pointer from cloud check)
  if (await repoDirty('core') || await repoDirty()) return commitWorktree()

  let pullOk = await pullWorktree()
  if (!pullOk) return

  // Check that the submodule points to a commit that exists on origin/main
  // This can happen if you rebase-merge a PR in GitHub, which creates a new commit SHA
  let submoduleCommit = (await $`git -C ${currentWorktree} ls-tree HEAD core`).stdout.trim().split(/\s+/)[2]
  let isOnOriginMain = (await $`git -C ${currentWorktree}/core branch -r --contains ${submoduleCommit}`.nothrow()).stdout.includes('origin/main')
  if (!isOnOriginMain) {
    console.error(`Cannot push: submodule 'core' points to commit ${submoduleCommit.slice(0, 8)} which is not on origin/main.`)
    console.error(`This often happens after rebase-merging a PR in GitHub.`)
    console.error(`Fix with: cd core && git fetch origin && git checkout origin/main && cd .. && git add core && git commit --amend --no-edit`)
    return
  }

  // Check for WIP commits that shouldn't be pushed
  let coreHasWip = await hasWipCommits('core')
  let cloudHasWip = await hasWipCommits()
  if (coreHasWip || cloudHasWip) {
    let repos = [coreHasWip && 'core', cloudHasWip && 'cloud'].filter(Boolean).join(' and ')
    console.error(`Cannot push: ${repos} has commits starting with "WIP". Please squash or rename them first.`)
    return
  }

  // ensure tests/lint pass before pushing
  let containerName = `graphene-${currentName}`
  await $`docker exec ${containerName} bash -c "cd cloud && pnpm lint && pnpm test"`
  await $`docker exec ${containerName} bash -c "cd core && pnpm lint && pnpm test"`

  // Push core first (so the commit exists on remote for the submodule reference)
  await $`git -C ${currentWorktree}/core push origin HEAD:main`

  if (updateCore) {
    // Stage the updated submodule reference and amend the last commit
    await $`git -C ${currentWorktree} add core`
    let submoduleDirty = (await $`git -C ${currentWorktree} diff --cached --quiet`.nothrow()).exitCode !== 0
    if (submoduleDirty) {
      await $`git -C ${currentWorktree} commit --amend --no-edit`
    }
  }

  await $`git -C ${currentWorktree} push origin HEAD:main`
}

// Run a command in the container. If no command is specified, open a shell
async function execWorktree (args: string[]) {
  let { spawnSync } = await import('child_process') // use spawnSync to properly inherit TTY
  args = args.length > 0 ? ['bash', '-c', ...args] : ['bash']
  let result = spawnSync('docker', ['exec', '-it', `graphene-${currentName}`, ...args], {stdio: 'inherit'})
  process.exit(result.status ?? 0)
}

async function doneWorktree () {
  if (currentName === 'main') throw new Error('Cannot mark main as done')
  if (await repoDirty('core') || await repoDirty()) throw new Error('Repos have uncommitted changes')
  console.log('Archiving worktree ' + currentName)

  // Check that both branches have been merged into main
  try {
    await $`git -C ${currentWorktree}/core merge-base --is-ancestor ${currentName} origin/main`
  } catch {
    return console.error(`core branch '${currentName}' has not been merged into main. Merge it before running 'wt done'.`)
  }

  try {
    await $`git -C ${currentWorktree} merge-base --is-ancestor ${currentName} origin/main`
  } catch {
    return console.error(`cloud branch '${currentName}' has not been merged into main. Merge it before running 'wt done'.`)
  }

  // Stop the container
  await $`docker rm -f graphene-${currentName}`.nothrow()

  cd(root) // cd to root, since we might be about to delete the cwd

  // Remove the worktree (superproject, which contains core as submodule)
  await $`git -C ${root}/main worktree remove ${currentWorktree}`

  // Archive the branches
  await $`git -C ${root}/main/core tag archive/${currentName} ${currentName}`
  await $`git -C ${root}/main/core branch -D ${currentName}`
  await $`git -C ${root}/main tag archive/${currentName} ${currentName}`
  await $`git -C ${root}/main branch -D ${currentName}`
}

// useful when hacking on the workTree script itself, but otherwise kinda dangerous
async function dropWorktree(name:string) {
  await $`docker rm -f graphene-${name}`.nothrow()
  await $`git -C ${root}/main worktree remove --force ${root}/${name}`
  await $`git -C ${root}/main branch -D ${name}`
}

function getTreeNames (): string[] {
  return fs.readdirSync(root, {withFileTypes: true})
    .filter(entry => entry.isDirectory() && entry.name !== 'main' && !entry.name.startsWith('.'))
    .map(entry => entry.name)
    .sort()
}

function readGraphenePort(treeName: string): number | null {
  if (treeName == 'main') return 4000
  let envPath = resolve(root, treeName, '.env')
  if (!fs.existsSync(envPath)) return null
  let match = fs.readFileSync(envPath, 'utf8').match(/^GRAPHENE_PORT=(\d+)$/m)
  if (!match) throw new Error('couldnt find port for worktree')
  return parseInt(match[1], 10)
}

function getNextPort (): number {
  let used = getTreeNames().map(readGraphenePort)
  let port = BASE_PORT
  while (used.includes(port)) {
    port += PORT_INCREMENT
  }
  return port
}
