import type {FastifyReply, FastifyRequest} from 'fastify'
import {and, eq, or} from 'drizzle-orm'
import {auth} from './auth.ts'
import {getDb} from './db.ts'
import {compile as mdsvexCompile} from 'mdsvex'
import {compile as svelteCompile} from 'svelte/compiler'
import {files, repos} from '../schema.ts'
import {componentNames, escapeAngles, extractQueries, sanitizeMarkdown} from '../../core/cli/mdCompile.ts'
import {PROD} from './consts.ts'
import jwt from 'jsonwebtoken'

function getTokenSecret () {
  return process.env.AGENT_TOKEN_SECRET || process.env.CONNECTION_ENCRYPTION_KEY || 'dev-secret-key'
}

interface TokenClaims {
  orgId: string
  repoId: string
  purpose: 'agent-render'
}

function verifyToken (token: string): TokenClaims | null {
  try {
    return jwt.verify(token, getTokenSecret()) as TokenClaims
  } catch {
    return null
  }
}

const defaultIgnoredFiles = ['agents.md', 'claude.md']

export async function listNavFiles (req: FastifyRequest, reply: FastifyReply) {
  await auth(req, reply)

  let repoSlug = (req.params as any)['repoSlug']
  let repo = await getDb().select({id: repos.id}).from(repos).where(and(
    eq(repos.orgId, req.auth.orgId),
    eq(repos.slug, repoSlug),
  )).get()
  if (!repo) return reply.send([])

  let pages = await getDb().select({path: files.path}).from(files).where(
    and(
      eq(files.repoId, repo.id),
      eq(files.extension, 'md'),
    ),
  ).all()

  let paths = pages
    .map(p => `${p.path}.md`)
    .filter(p => !defaultIgnoredFiles.includes(p.split('/').pop()?.toLowerCase() || ''))
  reply.send(paths)
}

export async function renderPage (req: FastifyRequest, reply: FastifyReply) {
  await auth(req, reply)

  let segments = (req.params as any)['*'].split('/')
  let orgRepos = await getDb().select({id: repos.id, slug: repos.slug}).from(repos).where(eq(repos.orgId, req.auth.orgId)).all()

  let repo = orgRepos.find(r => r.slug == segments[0])
  if (!repo) {
    if (orgRepos.length === 1 && segments[0] === '') {
      return reply.send({redirect: '/' + orgRepos[0].slug})
    }
    return reply.code(404).send({error: 'Repo not found'})
  }


  let path = segments.slice(1).join('/') || 'index'
  let page = await getDb().select().from(files).where(
    and(
      eq(files.repoId, repo.id),
      eq(files.extension, 'md'),
      or(eq(files.path, path), eq(files.path, path + '/index')),
    ),
  ).get()
  if (!page) return reply.code(404).send({error: 'Page not found'})

  let svelteSource = await mdsvexCompile(page.content, {
    filename: `${page.path}.md`,
    extensions: ['.md'],
    remarkPlugins: [extractQueries, escapeAngles],
    rehypePlugins: [sanitizeMarkdown],
  })
  if (!svelteSource) return reply.code(500).send({error: 'Failed to compile page'})

  let compiled = svelteCompile(svelteSource.code, {
    generate: 'dom',
    dev: !PROD,
  })
  let code = rewriteSvelteImports(compiled.js.code, repo.id)

  reply.type('text/javascript')
  reply.send(code)
}

// The generated Svelte component is going to import a bunch of Svelte internals and visualization components.
// Because we're doing this at runtime and we don't have a bundler, we need to figure out a way to make these imports work.
// For now just do the simple thing and rewrite them to import from a global that we set in main.ts
function rewriteSvelteImports (code: string, repoId: string) {
  let runtimeImportPattern = /import\s*\{\s*([^}]*)\}\s*from\s*["']svelte\/internal["'];?\s*/m
  let runtimeMatch = code.match(runtimeImportPattern)
  if (!runtimeMatch) throw new Error('Couldnt find expected imports in generated svelte')

  let svelteInternalImports = runtimeMatch[1].split(',').map(s => s.trim()).filter(Boolean)
  let prelude = [
    'const __svelte = window.$GRAPHENE?.svelte;',
    "if (!__svelte) throw new Error('Graphene runtime is missing Svelte internals');",
    `const {${svelteInternalImports.join(', ')}} = __svelte;`,
    `const {${componentNames().join(', ')}} = window.$GRAPHENE.components`,
    `window.$GRAPHENE.repoId = ${JSON.stringify(repoId)};`,
    '',
  ].join('\n')

  code = code.replace(runtimeImportPattern, `${prelude}`)

  // not sure what this is, or if we need it, so just removing for now
  code = code.replace(/import\s+["']svelte\/internal\/disclose-version["'];?\s*/m, '')

  return code
}

export async function renderDynamic (req: FastifyRequest, reply: FastifyReply) {
  let body = req.body as {
    markdown: string
    token: string
  }

  let claims = verifyToken(body.token || '')
  if (!claims) return reply.code(401).send({error: 'Invalid token'})

  // Compile markdown to svelte component
  let svelteSource = await mdsvexCompile(body.markdown, {
    filename: 'dynamic.md',
    extensions: ['.md'],
    remarkPlugins: [extractQueries, escapeAngles],
    rehypePlugins: [sanitizeMarkdown],
  })
  if (!svelteSource) return reply.code(500).send({error: 'Failed to compile markdown'})

  let compiled = svelteCompile(svelteSource.code, {generate: 'dom', dev: !PROD})
  let componentCode = rewriteSvelteImports(compiled.js.code, claims.repoId)

  // Return HTML page that loads the frontend and mounts the component
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Graphene Dynamic</title>
  <style>
    body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; }
    #content { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="content"></div>
  <script type="module">
    // Load runtime (sets up $GRAPHENE without mounting App)
    await import('/main.ts');

    // Component code
    ${componentCode}

    // Mount component
    new Component({ target: document.getElementById('content') });
  </script>
</body>
</html>`

  reply.type('text/html')
  reply.send(html)
}
