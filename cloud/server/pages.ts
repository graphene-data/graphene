import type {FastifyReply, FastifyRequest} from 'fastify'
import {and, eq, or} from 'drizzle-orm'
import {getDb} from './db.ts'
import {compile as mdsvexCompile} from 'mdsvex'
import {compile as svelteCompile} from 'svelte/compiler'
import {files, repos} from '../schema.ts'
import {componentNames, rehypePlugins, remarkPlugins} from '../../core/cli/mdCompile.ts'
import {PROD} from './consts.ts'

const defaultIgnoredFiles = ['agents.md', 'claude.md']

export async function listNavFiles(req: FastifyRequest, reply: FastifyReply) {
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

export async function renderPage(req: FastifyRequest, reply: FastifyReply) {
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

  let code = await compileMd(page.content, `${page.path}.md`, repo.id)
  reply.type('text/javascript').send(code)
}

async function compileMd(markdown: string, filename: string, repoId: string): Promise<string> {
  let svelteSource = await mdsvexCompile(markdown, {
    filename,
    extensions: ['.md'],
    remarkPlugins,
    rehypePlugins,
  })
  if (!svelteSource) throw new Error('Failed to compile')

  let compiled = svelteCompile(svelteSource.code, {generate: 'client', dev: !PROD})
  let componentCode = rewriteSvelteImports(compiled.js.code, repoId)
  return componentCode
}

// The generated Svelte component imports Svelte internals and visualization components.
// Because we're compiling at runtime without a bundler, rewrite those imports to the frontend runtime globals.
function rewriteSvelteImports(code: string, repoId: string) {
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

  code = code.replace(/import\s+["']svelte\/internal\/disclose-version["'];?\s*/m, '')
  code = code.replace(/import\s+["']svelte\/internal\/flags\/legacy["'];?\s*/m, '')
  code = code.replace(/\w+\[\$\.FILENAME\]\s*=\s*['"][^'"]*['"];?\s*/gm, '')
  code = code.replace(/(\w+)\[\$\.FILENAME\]/g, '"dynamic.md"')

  return code
}

export async function renderDynamicModule(req: FastifyRequest, reply: FastifyReply) {
  let query = req.query as {md?: string; repoId?: string}
  let markdown = Buffer.from(query.md || '', 'base64').toString('utf-8')
  let code = await compileMd(markdown, 'dynamic.md', query.repoId || '')
  reply.type('text/javascript').send(code)
}
