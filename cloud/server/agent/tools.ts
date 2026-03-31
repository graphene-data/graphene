import {eq, like, or, and} from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {z} from 'zod'

import {files} from '../../schema.ts'
import {getDb} from '../db.ts'
import {compileMd} from '../pages.ts'
import {proxyQuery, type QueryBody} from '../query.ts'

let rootDir = path.resolve(fileURLToPath(import.meta.url), '../../..')

// Shared tool definitions. These are framework-agnostic and adapted by AI/MCP wrappers.
export interface SharedTool {
  name: string
  description: string
  inputSchema?: z.ZodType | z.ZodRawShape
  outputSchema?: z.ZodType | z.ZodRawShape
  fn: (repoId:string, args: any) => Promise<any> | any
  toModelOutput?: (args: any) => any
  _meta?: any
}

export const readDocs = {
  name: 'read-docs',
  description: 'Provides a quick description of how to use Graphene. Run this once before using any Graphene tools',
  fn: async function readDocs() {
    // read graphene docs
  },
}

export const listDirTool = {
  name: 'list-dir',
  description: 'List files and directories at a path in the repository',
  inputSchema: z.object({path: z.string()}),
  outputSchema: z.array(z.string()),
  fn: async function listDir(repoId: string, {path}: {path: string}) {
    let prefix = path ? `${path}/` : ''
    let allFiles = await getDb()
      .select({path: files.path, extension: files.extension})
      .from(files)
      .where(eq(files.repoId, repoId))
      .then(rows => rows)

    let entries = new Set<string>()
    for (let file of allFiles) {
      let fullPath = `${file.path}.${file.extension}`
      if (!fullPath.startsWith(prefix)) continue

      let remainder = fullPath.slice(prefix.length)
      let slashIndex = remainder.indexOf('/')
      if (slashIndex === -1) entries.add(remainder)
      else entries.add(remainder.slice(0, slashIndex) + '/')
    }

    return Array.from(entries).sort()
  },
} satisfies SharedTool

export const readFileTool = {
  name: 'read-file',
  description: 'Read the contents of a file',
  inputSchema: z.object({path: z.string()}),
  fn: async function readFile(repoId: string, {path: filePath}: {path: string}) {
    if (filePath.endsWith('docs/graphene.md') || filePath.endsWith('docs/graphene')) {
      let docsPath = path.resolve(rootDir, '../core/docs/graphene.md')
      if (fs.existsSync(docsPath)) return {content: fs.readFileSync(docsPath, 'utf-8'), extension: 'md'}
    }

    let cleanPath = filePath.replace(/\.(md|gsql)$/, '')

    let file = await getDb()
      .select({content: files.content, extension: files.extension})
      .from(files)
      .where(and(eq(files.repoId, repoId), eq(files.path, cleanPath)))
      .then(rows => rows[0])

    if (!file) return {error: `File not found: ${filePath}`}
    return {content: file.content, extension: file.extension}
  },
} satisfies SharedTool

export const searchTool = {
  name: 'search-files',
  description: 'Search for files containing a string in their path or content',
  inputSchema: z.object({query: z.string().describe('Search query string')}),
  fn: async function search(repoId: string, {query}: {query: string}) {
    let pattern = `%${query}%`
    let results = await getDb()
      .select({path: files.path, extension: files.extension, content: files.content})
      .from(files)
      .where(and(eq(files.repoId, repoId), or(like(files.path, pattern), like(files.content, pattern))))
      .limit(20)
      .then(rows => rows)

    return results.map(r => ({path: `${r.path}.${r.extension}`, preview: extractPreview(r.content, query)}))
  },
} satisfies SharedTool

// Allows the agent to explicitly respond to the user, referencing a particular render to show
export const respondToUserTool = {
  name: 'respond',
  description: 'Finalize your response to the user. Call this exactly once when you are done. Include mdId to attach the matching renderMd screenshot in Slack.',
  inputSchema: z.object({
    text: z.string().describe('Final user-facing response text'),
    mdId: z.string().optional().describe('Optional markdown render id from renderMd output to attach its screenshot'),
  }),
  fn: function respondToUser(_repoId: string, {text, mdId}: {text: string; mdId?: string}) {
    return {text, mdId}
  },
} satisfies SharedTool

export const renderDynamicMd = {
  name: 'render-md',
  description: 'Render inline markdown with Graphene dynamic rendering.',
  inputSchema: z.object({markdown: z.string()}),
  fn: async function renderDynamicMd(repoId: string, {markdown}: {markdown: string}) {
    let compiledModule = await compileMd(markdown, 'dynamic.md', repoId)
    return {
      content: [{type: 'text' as const, text: 'Queued render in Graphene viewer.'}],
      structuredContent: {ok: true},
      _meta: {graphene: {kind: 'dynamic', repoId, compiledModule}},
    }
  },
} satisfies SharedTool

export const renderPage = {
  name: 'render-page',
  description: 'Render an existing markdown page from the repository.',
  inputSchema: z.object({path: z.string()}),
  fn: async function renderPage(repoId: string, {path}: {path: string}) {
    // normalize path
    path = (path || '').trim().replace(/^\/+/, '').replace(/\/+$/, '')
    if (!path) path = 'index'
    if (!path.endsWith('.md')) return null
    path = path.replace(/\.md$/, '')

    let page = await getDb()
      .select({path: files.path, content: files.content})
      .from(files)
      .where(and(eq(files.repoId, repoId), eq(files.extension, 'md'), or(eq(files.path, path), eq(files.path, `${path}/index`))))
      .then(rows => rows[0] || null)
    if (!page) return {isError: true, content: [{type: 'text' as const, text: `Markdown page not found: ${path}`}]}

    let compiledModule = await compileMd(page.content, `${page.path}.md`, repoId)
    return {
      content: [{type: 'text' as const, text: `Queued render for ${page.path}.md`}],
      structuredContent: {ok: true, path: `${page.path}.md`},
      _meta: {graphene: {kind: 'page', repoId, path: `${page.path}.md`, compiledModule}},
    }
  },
} satisfies SharedTool

export const runQuery = {
  name: 'run-query',
  description: 'Runs a given GSQL query and returns results',
  inputSchema: z.object({
    gsql: z.string().describe('GSQL query to execute'),
    params: z.record(z.string(), z.any()).optional(),
  }),
  fn: async function runQuery(body) {
    try {
      let res = await proxyQuery('organization-test-fe0fbae3-a479-4b60-8e80-7a76e76cc35d', body as QueryBody)
      return {
        content: [{type: 'text', text: 'Query results'}],
        structuredContent: res as any,
      }
    } catch (e: any) {
      let err = e?.cause || e
      return {
        isError: true,
        content: [{type: 'text', text: err?.message || 'Query error'}],
        structuredContent: err,
      }
    }
  },
}

function extractPreview(content: string, query: string, contextChars = 100): string {
  let lowerContent = content.toLowerCase()
  let lowerQuery = query.toLowerCase()
  let index = lowerContent.indexOf(lowerQuery)

  if (index === -1) return content.slice(0, 200) + (content.length > 200 ? '...' : '')

  let start = Math.max(0, index - contextChars)
  let end = Math.min(content.length, index + query.length + contextChars)

  let preview = content.slice(start, end)
  if (start > 0) preview = '...' + preview
  if (end < content.length) preview = preview + '...'

  return preview
}
