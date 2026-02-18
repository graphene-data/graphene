#!/usr/bin/env zx

// Worktrees is the script we use to manage local development. Besides handling git worktrees,
// it can push/pull from main, and manages containers to execute code/agents safely.

import {$, cd, quote} from 'zx'
import fs from 'fs'
import net from 'net'
import {resolve} from 'path'
import {spawn} from 'child_process'

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
  case 'status': await statusWorktree(flags.includes('--full')); break
  case 'start': await startWorktree(positional[0]); break
  case 'fetch': await fetchWorktree(); break
  case 'pull': await pullWorktree(); break
  case 'commit': await commitWorktree(); break
  case 'push': await pushWorktree(); break
  case 'up': await upWorktree(currentName); break
  case 'down': await downWorktree(currentName); break
  case 'exec': await execWorktree(process.argv.slice(3)); break
  case 'done': await doneWorktree(flags.includes('--force')); break
  default:
    console.log(`
Usage: wt <command>

Commands:
ls                      List all paired worktrees
status [--full]         Show PR commits and changed files for co and core
start <name>            Create a new paired worktree beside main
fetch                   Pull latest from remote, but don't update current branch
pull                    Pull down latest changes from main for both repos
push                    Push changes: core first (with PR), then cloud (with submodule bump)
up                      Start the dev container for this worktree
exec [cmd]              Run a command in the container (or bash if no command)
done [--force]          Archive both worktrees, or force-drop current worktree
`)
}

// Host commands that the container can invoke via the `host` CLI. Each handler receives an args object and returns a response.
// Its important we use the worktree script from `main`, so agents cant change it to execute stuff on the host.
let mainWtScript = resolve(root, 'main/dev/workTrees.ts')

const HOST_COMMANDS: Record<string, (args: any) => Promise<{ ok: boolean, data?: any, error?: string }>> = {
  'open-browser': async ({url}) => {
    if (!url) return {ok: false, error: 'missing --url'}
    await $`open ${url}`
    return {ok: true}
  },
  'commit': async () => {
    let result = await $`zx ${mainWtScript} commit`.nothrow()
    return {ok: result.exitCode === 0, data: result.stdout + result.stderr}
  },
  'fetch': async () => {
    let result = await $`node ${mainWtScript} fetch`.nothrow()
    return {ok: result.exitCode === 0, data: result.stdout + result.stderr}
  },
  'pull': async () => {
    let result = await $`node ${mainWtScript} pull`.nothrow()
    return {ok: result.exitCode === 0, data: result.stdout + result.stderr}
  },
  'push': async () => {
    // Refuse to push if the branch modifies .github in any way (prevents CI tampering from agents)
    let ghDiff = (await $`git -C ${currentWorktree} diff origin/main --name-only -- .github`.nothrow()).stdout.trim()
    let ghDiffCore = (await $`git -C ${currentWorktree}/core diff origin/main --name-only -- .github`.nothrow()).stdout.trim()
    if (ghDiff || ghDiffCore) return {ok: false, error: 'Push rejected: branch modifies .github. Check the changes and push from the host'}

    let result = await $`zx ${mainWtScript} push`.nothrow()
    return {ok: result.exitCode === 0, data: result.stdout + result.stderr}
  },
}

async function startWorktree (name: string) {
  if (!name) throw new Error('Please provide a name for the worktree')
  if (name === 'main') throw new Error('Cannot create a worktree named "main"')

  let treePath = resolve(root, name)
  if (fs.existsSync(treePath)) throw new Error(`${treePath} already exists`)
  fs.mkdirSync(treePath)

  // create the worktree
  await $`git -C ${root}/main fetch origin main`
  await $`git -C ${root}/main worktree add ${treePath} -b ${name} origin/main`
  await $`git -C ${treePath} branch --unset-upstream` // so that `git push` creates the correct branch on github

  // Init submodules. They start detached, create a branch so we can commit/push changes
  await $`git -C ${treePath} submodule update --init --recursive`
  await $`git -C ${treePath}/core checkout -b ${name}`

  // Assign unique ports to the worktree, and write it to .env along with copying main's .env
  let basePort = getNextPort()
  let envContent = fs.readFileSync(`${root}/main/.env`) + `\nWT_NAME=${name}\nGRAPHENE_PORT=${basePort}`
  fs.writeFileSync(`${treePath}/.env`, envContent)
  console.log(`Assigned ports → core:${basePort}`)

  await $`mkdir ${treePath}/.opencode`
  await $`ln -s dev/opencode.jsonc ${treePath}/opencode.jsonc`
  await $`ln -s ../dev/skills ${treePath}/.opencode/skills`
  await $`ln -s ../dev/agents ${treePath}/.opencode/agents`
  await $`ln -s ../dev/commands ${treePath}/.opencode/commands`

  // hard-link so that when mounted in a container we can still access it
  await $`ln ${root}/main/core/examples/flights/flights.duckdb ${treePath}/core/examples/flights/flights.duckdb`

  await $`zed ${treePath}`
  await upWorktree(name)

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

  await downWorktree(name) // stop container if running

  // Ensure shared opencode config dir exists so sessions/auth are shared across containers
  fs.mkdirSync(`${root}/.opencode`, {recursive: true})
  fs.mkdirSync(`${root}/.pi`, {recursive: true})

  // Build our image against main, since it shouldn't change for any worktree
  // We could skip this step if the image already exists, but this seems pretty fast, and catches dockerfile changes
  console.log('Building Docker image...')
  await $`docker build -f ${root}/main/dev/Dockerfile.dev -t graphene-dev ${root}/main`

  console.log('Starting container...')
  // We mount main/.git at its absolute host path (for the superproject .git file which uses an absolute gitdir)
  // AND at /main/.git (for the core submodule .git file which uses a relative gitdir like ../../main/.git/...)
  await $`docker run -d --name ${containerName} \
    --env-file ${envFile} \
    -p ${port}:${port} -p ${port + 1}:${port + 1} -p ${port + 2}:${port + 2} \
    --workdir /${name} \
    --mount type=bind,source=${treePath},target=/${name} \
    --mount type=volume,source=pnpm-store,target=/pnpm/store \
    --mount type=bind,source=${root}/main/.git,target=${root}/main/.git \
    --mount type=bind,source=${root}/main/.git,target=/main/.git \
    --mount type=bind,source=${root}/.opencode,target=/root/.local/share/opencode \
    --mount type=bind,source=${root}/.pi,target=/root/.pi \
    graphene-dev \
    tail -f /dev/null`

  console.log('Running containerStart.sh...')
  await $`docker exec ${containerName} bash -lc "dev/containerStart.sh"`

  console.log(`Container '${containerName}' is running`)
}

async function downWorktree(name: string) {
  await $`docker rm -f graphene-${name}`.quiet().nothrow() // Stop existing container if running
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

// Check if branch has commits not yet on origin/main, using git cherry to compare by patch content.
// This handles rebase-merge where commit SHAs change but the patch content is the same.
// Returns true if there are local commits that haven't been merged.
async function hasUnmergedCommits (subdir?: string): Promise<boolean> {
  let path = subdir ? `${currentWorktree}/${subdir}` : currentWorktree
  await $`git -C ${path} fetch origin`
  // git cherry outputs: '-' for commits with equivalent patches on upstream, '+' for unique commits
  let cherryOutput = (await $`git -C ${path} cherry origin/main`.nothrow()).stdout.trim()
  return cherryOutput.split('\n').some(line => line.startsWith('+ '))
}

function runCommitTool (cwd: string) {
  let script = `cd ${quote(cwd)} && ${COMMIT_TOOL}`
  return $`sh -lc ${script}`
}

async function commitWorktree () {
  if (await repoDirty('core')) await runCommitTool(`${currentWorktree}/core`)
  if (await repoDirty()) await runCommitTool(currentWorktree)
}

async function statusWorktree (full = false) {
  if (fs.existsSync('/.dockerenv')) {
    await $`host fetch`
  } else {
    await fetchWorktree()
  }

  let repos = [
    {label: 'co', path: currentWorktree},
    // {label: 'core', path: `${currentWorktree}/core`},
  ] as const

  let details = [] as {label: 'co' | 'core', branch: string, commits: string, status: string}[]
  for (let repo of repos) {
    let branch = (await $`git -C ${repo.path} rev-parse --abbrev-ref HEAD`).stdout.trim()
    let commits = (await $`git -C ${repo.path} log origin/main..HEAD ${full ? '--stat' : '--oneline'}`.nothrow()).stdout.trim()
    commits = ''
    let statusRaw = (await $`git -C ${repo.path} status --porcelain`).stdout.trim()
    let status = statusRaw.split('\n').filter(line => line && !(repo.label === 'co' && line.match(/^.. core$/))).join('\n')
    details.push({label: repo.label, branch, commits, status})
  }

  console.log(chalk.bold(`Worktree status: ${currentName}`))
  console.log('')
  for (let repo of details) {
    console.log(chalk.cyan(`${repo.label} commits (${repo.branch}):`))
    console.log(repo.commits || '(none)')
    console.log('')
  }

  for (let repo of details) {
    console.log(chalk.cyan(`${repo.label} status (${repo.branch}):`))
    console.log(repo.status || chalk.green('(clean)'))
    console.log('')
  }
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
    // In superproject, add everything except the submodule pointer
    if (subdir) {
      await $`git -C ${path} add -A`
    } else {
      await $`git -C ${path} add -A -- . :!core`
    }
    await $`git -C ${path} commit -m WIP`
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

async function fetchWorktree() {
  await $`git -C ${currentWorktree} fetch origin`
  await $`git -C ${currentWorktree}/core fetch origin`
}

async function pullWorktree (): Promise<boolean> {
  let success = true
  for (let subdir of [undefined, 'core'] as const) {
    success = success && await rebaseRepo(subdir, 'origin/main')
  }
  return success
}

// Ensure a PR exists for the given branch. If one already exists, return its URL without modifying it.
async function ensurePR (repoPath: string, branch: string): Promise<string> {
  // Check if a PR already exists for this branch
  let existing = (await $`gh pr list --repo ${getGhRepo(repoPath)} --head ${branch} --json url --jq .[0].url`.nothrow()).stdout.trim()
  if (existing) return existing

  // Use last commit message as title and body
  let title = (await $`git -C ${repoPath} log -1 --format=%s`).stdout.trim()
  let body = (await $`git -C ${repoPath} log -1 --format=%b`).stdout.trim()

  let url = (await $`gh pr create --repo ${getGhRepo(repoPath)} --head ${branch} --base main --title ${title} --body ${body} --reviewer kevinmarr`).stdout.trim()
  await $`(cd ${repoPath} && gh pr merge --auto --rebase)`
  return url
}

// Get the GitHub owner/repo slug from git remote
function getGhRepo (repoPath: string): string {
  // We know our remotes are git@github.com:org/repo.git - just hardcode based on path
  return repoPath.endsWith('/core') || repoPath.endsWith('/core/') ? 'graphene-data/graphene' : 'graphene-data/co'
}

async function pushWorktree() {
  if (!await pullWorktree()) return console.error('Pull failed. Resolve before pushing')
  if (await repoDirty('core')) return commitWorktree()
  if (await hasWipCommits('core')) return console.error('Core has WIP commits that must be squashed')

  let cloudHasCommits = await hasUnmergedCommits()

  // If there are commits on core, we're going to wait until they're fully merged before pushing cloud.
  // This ensures we never merge something to cloud without having the submodule point at the correct commit.
  if (await hasUnmergedCommits('core')) {
    console.log('Pushing core...')
    await $`git -C ${currentWorktree}/core push -f -u origin ${currentName}`
    let url = await ensurePR(`${currentWorktree}/core`, currentName)
    console.log('core PR: ' + url)

    if (cloudHasCommits) return console.log('Once merged, run `wt push` again to push cloud')
  }

  if (await repoDirty()) return commitWorktree()
  if (await hasWipCommits()) return console.error('co has WIP commits that must be squashed')


  if (cloudHasCommits) {
    console.log('Pushing cloud...')
    await $`git -C ${currentWorktree} push -f -u origin ${currentName}`
    let url = await ensurePR(currentWorktree, currentName)
    console.log('co PR: ' + url)
    return
  }

  console.log('All changes pushed')
}

// Start a simple server that allows containers to execute HOST_COMMANDS
// Protocol: client sends newline-delimited JSON, server responds with the same.
function startHostIPC (): Promise<number> {
  return new Promise(resolve => {
    let server = net.createServer({allowHalfOpen: true}, conn => {
      let buf = ''
      conn.on('data', chunk => {
        buf += chunk
        if (!buf.includes('\n')) return
        let {command, args} = JSON.parse(buf.slice(0, buf.indexOf('\n')))
        let handler = HOST_COMMANDS[command]
        let respond = (res: object) => conn.end(JSON.stringify(res) + '\n')
        if (!handler) return respond({ok: false, error: `unknown command: ${command}`})
        handler(args || {}).then(respond).catch((e: any) => respond({ok: false, error: e.message}))
      })
    })
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

// Run a command in the container. If no command is specified, open a shell.
// Starts a per-session TCP server so the container can send commands back to the host.
async function execWorktree (args: string[]) {
  let port = await startHostIPC()
  args = args.length > 0 ? ['zsh', '-lc', ...args] : ['zsh']
  let child = spawn('docker', ['exec', '-it', '-e', `HOST_IPC_PORT=${port}`, `graphene-${currentName}`, ...args], {stdio: 'inherit'})

  child.on('exit', (code) => process.exit(code ?? 0))
}

async function doneWorktree (force = false) {
  if (currentName === 'main') throw new Error('Cannot mark main as done')

  if (!force) {
    if (await repoDirty('core') || await repoDirty()) throw new Error('Repos have uncommitted changes')
    if (await hasUnmergedCommits('core')) return console.error(`core branch '${currentName}' has not been merged into main. Merge it before running 'wt done'.`)
    if (await hasUnmergedCommits()) return console.error(`cloud branch '${currentName}' has not been merged into main. Merge it before running 'wt done'.`)
  }

  console.log('Archiving worktree ' + currentName)
  cd(root) // cd to root, since we might be about to delete the cwd
  await $`docker rm -f graphene-${currentName}`.nothrow() // Stop the container, if running
  await $`git -C ${root}/main worktree remove --force ${currentName}`
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
