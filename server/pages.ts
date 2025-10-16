import type {FastifyReply, FastifyRequest} from 'fastify'
import {and, eq} from 'drizzle-orm'
import {ensureUser} from './auth.ts'
import {getDb} from './db.ts'
import {compile as mdsvexCompile} from 'mdsvex'
import {compile as svelteCompile} from 'svelte/compiler'
import {visit} from 'unist-util-visit'
import {files} from '../schema.ts'
import fs from 'node:fs/promises'
import path from 'node:path'

let componentNames: string[] | undefined

export async function renderPage (req: FastifyRequest, reply: FastifyReply) {
  if (!ensureUser(req, reply)) return

  let slug = (req.params as any).slug || 'index'
  let page = getDb().select().from(files).where(
    and(
      eq(files.orgId, req.auth.orgId),
      eq(files.path, slug),
      eq(files.extension, 'md'),
    ),
  ).limit(1).all()[0]

  if (!page) return reply.code(404).send({error: 'Page not found'})

  let svelteSource = await mdsvexCompile(page.content, {
    filename: `${page.path}.md`,
    extensions: ['.md'],
    remarkPlugins: [extractQueries],
  })
  if (!svelteSource) return reply.code(500).send({error: 'Failed to compile page'})

  let compiled = svelteCompile(svelteSource.code, {
    generate: 'dom',
    dev: process.env.NODE_ENV !== 'production',
  })
  let code = await rewriteSvelteImports(compiled.js.code)

  reply.type('text/javascript')
  reply.send(code)
}

function extractQueries () {
  function escapeHtml (str: string) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  return function transformer (tree) {
    visit(tree, 'code', (node, index, parent) => {
      if (index === null) return
      let name = typeof node.meta === 'string' ? node.meta : ''
      let code = typeof node.value === 'string' ? node.value.trim() : ''
      parent.children[index] = {type: 'html', value: `<GrapheneQuery name="${escapeHtml(name)}" code="${escapeHtml(code)}" />`}
    })
  }
}

// The generated Svelte component is going to import a bunch of Svelte internals and visualization components.
// Because we're doing this at runtime and we don't have a bundler, we need to figure out a way to make these imports work.
// For now just do the simple thing and rewrite them to import from a global that we set in main.ts
async function rewriteSvelteImports (code: string) {
  let runtimeImportPattern = /import\s*\{\s*([^}]*)\}\s*from\s*["']svelte\/internal["'];?\s*/m
  let runtimeMatch = code.match(runtimeImportPattern)

  if (!runtimeMatch) throw new Error('Couldnt find expected imports in generated svelte')

  if (!componentNames) {
    let files = await fs.readdir(path.join(import.meta.dirname, '../../core/ui/components'))
    componentNames = files.map(f => path.basename(f, '.svelte')).filter(f => !f.startsWith('_'))
  }

  let svelteInternalImports = runtimeMatch[1].split(',').map(s => s.trim()).filter(Boolean)
  let prelude = [
    'const __svelte = window.$GRAPHENE?.svelte;',
    "if (!__svelte) throw new Error('Graphene runtime is missing Svelte internals');",
    `const {${svelteInternalImports.join(', ')}} = __svelte;`,
    `const {${componentNames.join(', ')}} = window.$GRAPHENE.components`,
    '',
  ].join('\n')

  code = code.replace(runtimeImportPattern, `${prelude}`)

  // not sure what this is, or if we need it, so just removing for now
  code = code.replace(/import\s+["']svelte\/internal\/disclose-version["'];?\s*/m, '')

  return code
}
