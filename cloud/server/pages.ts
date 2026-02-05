import type {FastifyReply, FastifyRequest} from 'fastify'
import {and, eq, or} from 'drizzle-orm'
import {getDb} from './db.ts'
import {compile as mdsvexCompile} from 'mdsvex'
import {compile as svelteCompile} from 'svelte/compiler'
import {files, repos} from '../schema.ts'
import {componentNames, escapeAngles, extractQueries, sanitizeMarkdown} from '../../core/cli/mdCompile.ts'
import {PROD} from './consts.ts'
import {auth} from './auth.ts'

const defaultIgnoredFiles = ['agents.md', 'claude.md']

export async function listNavFiles (req: FastifyRequest, reply: FastifyReply) {
  await auth(req, reply)
  let db = getDb()

  let repoSlug = (req.params as any)['repoSlug']
  let repo = await db.select({id: repos.id}).from(repos).where(and(
    eq(repos.orgId, req.auth.orgId),
    eq(repos.slug, repoSlug),
  )).then(rows => rows[0])
  if (!repo) return reply.send([])

  let pages = await db.select({path: files.path}).from(files).where(
    and(
      eq(files.repoId, repo.id),
      eq(files.extension, 'md'),
    ),
  ).then(rows => rows)

  let paths = pages
    .map(p => `${p.path}.md`)
    .filter(p => !defaultIgnoredFiles.includes(p.split('/').pop()?.toLowerCase() || ''))
  reply.send(paths)
}

export async function renderPage (req: FastifyRequest, reply: FastifyReply) {
  await auth(req, reply)
  let db = getDb()

  let segments = (req.params as any)['*'].split('/')
  let orgRepos = await db.select({id: repos.id, slug: repos.slug}).from(repos).where(eq(repos.orgId, req.auth.orgId)).then(rows => rows)

  let repo = orgRepos.find(r => r.slug == segments[0])
  if (!repo) {
    if (orgRepos.length === 1 && segments[0] === '') {
      return reply.send({redirect: '/' + orgRepos[0].slug})
    }
    return reply.code(404).send({error: 'Repo not found'})
  }


  let path = segments.slice(1).join('/') || 'index'
  let page = await db.select().from(files).where(
    and(
      eq(files.repoId, repo.id),
      eq(files.extension, 'md'),
      or(eq(files.path, path), eq(files.path, path + '/index')),
    ),
  ).then(rows => rows[0])
  if (!page) return reply.code(404).send({error: 'Page not found'})

  let svelteSource = await mdsvexCompile(page.content, {
    filename: `${page.path}.md`,
    extensions: ['.md'],
    remarkPlugins: [extractQueries, escapeAngles],
    rehypePlugins: [sanitizeMarkdown],
  })
  if (!svelteSource) return reply.code(500).send({error: 'Failed to compile page'})

  let compiled = svelteCompile(svelteSource.code, {
    generate: 'client',
    dev: !PROD,
  })
  let code = rewriteSvelteImports(compiled.js.code, repo.id)

  reply.type('text/javascript')
  reply.send(code)
}

// The generated Svelte component is going to import a bunch of Svelte internals and visualization components.
// Because we're doing this at runtime and we don't have a bundler, we need to figure out a way to make these imports work.
// For now just do the simple thing and rewrite them to import from a global that we set in main.ts
function rewriteSvelteImports (code: string, repoId: string, inline = false) {
  // Svelte 5 uses 'svelte/internal/client' with namespace import
  let runtimeImportPattern = /import\s*\*\s*as\s*(\$)\s*from\s*["']svelte\/internal\/client["'];?\s*/m
  let runtimeMatch = code.match(runtimeImportPattern)
  if (!runtimeMatch) throw new Error('Couldnt find expected imports in generated svelte')

  let prelude = [
    'const $ = window.$GRAPHENE?.svelte;',
    "if (!$) throw new Error('Graphene runtime is missing Svelte internals');",
    `const {${componentNames().join(', ')}} = window.$GRAPHENE.components`,
    `window.$GRAPHENE.repoId = ${JSON.stringify(repoId)};`,
    '',
  ].join('\n')

  code = code.replace(runtimeImportPattern, `${prelude}`)

  // Remove version disclosure imports (Svelte 5)
  code = code.replace(/import\s+["']svelte\/internal\/disclose-version["'];?\s*/m, '')
  // Remove legacy flags import (Svelte 5)
  code = code.replace(/import\s+["']svelte\/internal\/flags\/legacy["'];?\s*/m, '')
  // Remove filename metadata lines (pattern like: ComponentName[$.FILENAME] = 'filename';)
  // This line tries to set a property on the component before it's defined
  code = code.replace(/\w+\[\$\.FILENAME\]\s*=\s*['"][^'"]*['"];?\s*/gm, '')

  if (inline) {
    // For inline use: Convert 'export default function ComponentName' to 'const Component = function ComponentName'
    // This allows the component to be used inline without ES module exports
    code = code.replace(/export\s+default\s+function\s+(\w+)/m, 'const Component = function $1')
  }
  // Keep 'export default' for dynamic import via blob URL (non-inline case)

  // Handle the case where add_locations references the FILENAME
  // Replace ComponentName[$.FILENAME] with a simple string in add_locations calls
  code = code.replace(/(\w+)\[\$\.FILENAME\]/g, '"dynamic.md"')

  return code
}

export async function renderDynamic (req: FastifyRequest, reply: FastifyReply) {
  await auth(req, reply)
  let query = req.query as {md?: string; repoId?: string}

  if (!query.repoId) return reply.code(400).send({error: 'Missing repoId parameter'})

  // Decode base64 markdown from query param
  let markdown: string
  try {
    markdown = Buffer.from(query.md || '', 'base64').toString('utf-8')
  } catch {
    return reply.code(400).send({error: 'Invalid base64 markdown'})
  }
  if (!markdown) return reply.code(400).send({error: 'Missing md parameter'})

  // Compile markdown to svelte component
  let svelteSource = await mdsvexCompile(markdown, {
    filename: 'dynamic.md',
    extensions: ['.md'],
    remarkPlugins: [extractQueries, escapeAngles],
    rehypePlugins: [sanitizeMarkdown],
  })
  if (!svelteSource) return reply.code(500).send({error: 'Failed to compile markdown'})

  let compiled = svelteCompile(svelteSource.code, {generate: 'client', dev: !PROD})
  let componentCode = rewriteSvelteImports(compiled.js.code, query.repoId, true)

  // Return HTML page that loads the frontend and mounts the component
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Graphene Dynamic</title>
</head>
<body>
  <main id="content"></main>
  <script type="module">
    await import('/main.ts')
    ${componentCode}
    window.$GRAPHENE.mount(Component, { target: document.getElementById('content') });
  </script>
</body>
</html>`

  reply.type('text/html')
  reply.send(html)
}
