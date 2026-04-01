import {eq, like, or, and} from 'drizzle-orm'
import {z} from 'zod'

import {files} from '../../schema.ts'
import {getDb} from '../db.ts'

// Shared tool definitions. These are framework-agnostic and adapted by AI/MCP wrappers.
export interface SharedTool {
  name: string
  description: string
  inputSchema?: z.ZodType | z.ZodRawShape
  outputSchema?: z.ZodType | z.ZodRawShape
  fn: (repoId: string, args: any) => Promise<any> | any
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
    let prefix = path ? `${path.replace(/\/$/, '')}/` : ''
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
    let parts = filePath.split('.')
    let ext = parts.pop()
    let fileName = parts.join('.')
    console.log('looking for', parts, ext)

    let file = await getDb().query.files.findFirst({
      where: and(eq(files.repoId, repoId), eq(files.path, fileName), eq(files.extension, ext)),
    })
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

// Allows the agent to explicitly respond to the user, referencing a particular render to show. Used by the slackbot
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
