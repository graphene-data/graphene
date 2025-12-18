import type {FastifyReply, FastifyRequest} from 'fastify'
import {and, eq} from 'drizzle-orm'
import crypto from 'node:crypto'
import {App} from '@octokit/app'
import {Octokit} from '@octokit/rest'
import {auth} from './auth.ts'
import {getDb} from './db.ts'
import {vcsInstallations, repos, files} from '../schema.ts'

let app: App | null = null
function getGitHubApp () {
  if (app) return app
  let appId = process.env.GITHUB_APP_ID
  let privateKey = process.env.GITHUB_APP_PRIVATE_KEY
  let clientId = process.env.GITHUB_APP_CLIENT_ID
  let clientSecret = process.env.GITHUB_APP_CLIENT_SECRET
  if (!appId || !privateKey || !clientId || !clientSecret) throw new Error('GitHub App credentials not configured')
  app = new App({appId, privateKey, oauth: {clientId, clientSecret}, Octokit: Octokit.defaults({})})
  return app
}

async function getInstallationOctokit (installationId: string): Promise<Octokit> {
  let ghApp = getGitHubApp()
  return await ghApp.getInstallationOctokit(Number(installationId)) as unknown as Octokit
}

// Redirect to GitHub App installation with nonce in state
export async function githubInstall (req: FastifyRequest, reply: FastifyReply) {
  await auth(req, reply)
  let appSlug = process.env.GITHUB_APP_SLUG
  if (!appSlug) return reply.code(500).send({error: 'GitHub App not configured'})

  // Generate nonce and store orgId mapping in cookie
  let nonce = crypto.randomBytes(16).toString('hex')
  let cookieValue = JSON.stringify({nonce, orgId: req.auth.orgId})
  reply.setCookie('github_install_state', cookieValue, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  })

  reply.redirect(`https://github.com/apps/${appSlug}/installations/new?state=${nonce}`)
}

// GitHub redirects here after app installation (Setup URL)
export async function githubSetup (req: FastifyRequest, reply: FastifyReply) {
  await auth(req, reply)

  let query = req.query as {installation_id?: string; setup_action?: string; state?: string}

  if (!query.installation_id || !query.state) {
    return reply.code(400).send({error: 'Missing installation_id or state'})
  }

  // Verify nonce and get orgId from cookie
  let {nonce, orgId} = JSON.parse(req.cookies.github_install_state || '{}') as {nonce: string; orgId: string}
  if (nonce !== query.state || orgId !== req.auth.orgId) {
    return reply.code(400).send({error: 'Invalid state'})
  }

  reply.clearCookie('github_install_state', {path: '/'}) // clear so the cookie cant be reused
  await getDb().insert(vcsInstallations).values({orgId, type: 'github', id: query.installation_id})
  reply.redirect('/settings/repos')
}

// List repos accessible to the GitHub installation for this org
export async function listAvailableRepos (req: FastifyRequest, reply: FastifyReply) {
  await auth(req, reply)

  let installation = await getDb().select().from(vcsInstallations)
    .where(and(eq(vcsInstallations.orgId, req.auth.orgId), eq(vcsInstallations.type, 'github'))).get()
  if (!installation) return reply.send({repos: [], hasInstallation: false})

  let octokit = await getInstallationOctokit(installation.id)
  let {data} = await octokit.rest.apps.listReposAccessibleToInstallation({per_page: 100})

  // Get already-added repos to mark them
  let addedRepos = await getDb().select({id: repos.id, vcsRepoId: repos.vcsRepoId}).from(repos)
    .where(eq(repos.vcsInstallationId, installation.id)).all()
  let addedMap = new Map(addedRepos.map(r => [r.vcsRepoId, r.id]))

  let available = data.repositories.map(r => ({
    id: String(r.id),
    name: r.name,
    fullName: r.full_name,
    url: r.clone_url,
    defaultBranch: r.default_branch,
    added: addedMap.has(String(r.id)),
    repoId: addedMap.get(String(r.id)) ?? null,  // internal repo ID for removal
  }))

  reply.send({repos: available, hasInstallation: true})
}

// Add a repo from GitHub to this org
export async function addRepo (req: FastifyRequest, reply: FastifyReply) {
  await auth(req, reply)

  let body = req.body as {vcsRepoId: string; slug: string; folder?: string}
  if (!body.vcsRepoId || !body.slug) {
    return reply.code(400).send({error: 'Missing vcsRepoId or slug'})
  }

  let installation = await getDb().select().from(vcsInstallations)
    .where(and(eq(vcsInstallations.orgId, req.auth.orgId), eq(vcsInstallations.type, 'github'))).get()
  if (!installation) return reply.code(400).send({error: 'No GitHub installation'})

  // Get repo details from GitHub
  let octokit = await getInstallationOctokit(installation.id)
  let {data} = await octokit.rest.apps.listReposAccessibleToInstallation({per_page: 100})
  let ghRepo = data.repositories.find(r => String(r.id) === body.vcsRepoId)
  if (!ghRepo) return reply.code(400).send({error: 'Repo not accessible'})

  // Create the repo record
  let directory = body.folder?.replace(/^\/|\/$/g, '') || null  // trim leading/trailing slashes
  let [repo] = await getDb().insert(repos).values({
    orgId: req.auth.orgId,
    slug: body.slug,
    url: ghRepo.clone_url,
    directory,
    vcsInstallationId: installation.id,
    vcsRepoId: body.vcsRepoId,
  }).returning()

  await fullSyncRepo(repo.id)
  reply.send({repo})
}

// Remove a repo
export async function removeRepo (req: FastifyRequest, reply: FastifyReply) {
  await auth(req, reply)

  let params = req.params as {id?: string}
  if (!params.id) return reply.code(400).send({error: 'Missing repo id'})

  // Verify repo belongs to this org
  let repo = await getDb().select().from(repos)
    .where(and(eq(repos.id, params.id), eq(repos.orgId, req.auth.orgId))).get()
  if (!repo) return reply.code(404).send({error: 'Repo not found'})

  // Delete repo (files cascade due to FK)
  await getDb().delete(repos).where(eq(repos.id, params.id))

  reply.send({ok: true})
}

// Handle GitHub webhook events
export async function githubWebhook (req: FastifyRequest, reply: FastifyReply) {
  let signature = req.headers['x-hub-signature-256'] as string
  let event = req.headers['x-github-event'] as string
  let body = JSON.stringify(req.body)

  if (!verifyWebhookSignature(body, signature)) {
    return reply.code(401).send({error: 'Invalid signature'})
  }

  let payload = req.body as any

  if (event === 'push') {
    let ref = payload.ref as string
    let defaultBranch = payload.repository?.default_branch

    // Only sync pushes to the default branch for repos we've added
    if (ref === `refs/heads/${defaultBranch}`) {
      let repo = await getDb().select().from(repos).where(eq(repos.vcsRepoId, String(payload.repository?.id))).get()
      if (repo) {
        await fullSyncRepo(repo.id)
      }
    }
  }

  reply.send({ok: true})
}

function verifyWebhookSignature (payload: string, signature: string): boolean {
  let secret = process.env.GITHUB_APP_WEBHOOK_SECRET
  if (!secret) return false
  let expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

// Full sync of all .md and .gsql files from a repo
export async function fullSyncRepo (repoId: string) {
  let gRepo = await getDb().select().from(repos).where(eq(repos.id, repoId)).get()
  if (!gRepo || !gRepo.url || !gRepo.vcsInstallationId) throw new Error('Missing repo or VCS config')

  let {owner, repo} = parseGitHubUrl(gRepo.url)
  let octokit = await getInstallationOctokit(gRepo.vcsInstallationId)
  let directory = gRepo.directory  // optional subfolder to sync from

  // Get repo details for default branch
  let {data: ghRepo} = await octokit.rest.repos.get({owner, repo})
  let defaultBranch = ghRepo.default_branch

  // Get the tree for the default branch (recursive)
  let {data: refData} = await octokit.rest.git.getRef({owner, repo, ref: `heads/${defaultBranch}`})
  let {data: tree} = await octokit.rest.git.getTree({owner, repo, tree_sha: refData.object.sha, recursive: 'true'})

  // Filter to .md and .gsql files, optionally within directory
  let syncableFiles = tree.tree.filter(f => {
    if (f.type !== 'blob' || !f.path) return false
    if (!f.path.endsWith('.md') && !f.path.endsWith('.gsql')) return false
    if (directory && !f.path.startsWith(directory + '/')) return false
    return true
  })

  // Fetch content for each file
  for (let file of syncableFiles) {
    if (!file.path) continue
    let {data} = await octokit.rest.repos.getContent({owner, repo, path: file.path, ref: defaultBranch})

    if ('content' in data && data.type === 'file') {
      let content = Buffer.from(data.content, 'base64').toString('utf-8')
      let extension = file.path.endsWith('.gsql') ? 'gsql' : 'md'
      // Strip directory prefix and extension from path
      let path = file.path.replace(/\.(md|gsql)$/, '')
      if (directory) path = path.slice(directory.length + 1)

      await getDb().insert(files)
        .values({repoId: gRepo.id, path, extension, content})
        .onConflictDoUpdate({
          target: [files.repoId, files.path],
          set: {content, updatedAt: new Date()},
        })
    }
  }

  // Delete files that no longer exist in the repo
  let existingPaths = new Set(syncableFiles.map(f => {
    let path = f.path?.replace(/\.(md|gsql)$/, '') ?? ''
    if (directory) path = path.slice(directory.length + 1)
    return path
  }))
  let dbFiles = await getDb().select({path: files.path}).from(files).where(eq(files.repoId, gRepo.id)).all()
  for (let dbFile of dbFiles) {
    if (!existingPaths.has(dbFile.path)) {
      await getDb().delete(files).where(and(eq(files.repoId, gRepo.id), eq(files.path, dbFile.path)))
    }
  }

  await getDb().update(repos).set({
    lastSyncedAt: new Date(),
    lastSyncCommit: refData.object.sha,
    syncResult: 'success',
  }).where(eq(repos.id, gRepo.id))
}

// Parse owner and repo name from a GitHub URL
// e.g., "https://github.com/graphene-data/example-ecommerce.git" → {owner: "graphene-data", repo: "example-ecommerce"}
function parseGitHubUrl (url: string): {owner: string; repo: string} {
  let match = url.match(/github\.com\/([^/]+)\/([^/.]+)/)
  if (!match) throw new Error('Couldnt parse github url')
  return {owner: match[1], repo: match[2]}
}
