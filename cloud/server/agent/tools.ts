import {tool} from 'ai'
import {z} from 'zod'
import {eq, like, or, and} from 'drizzle-orm'
import {getDb} from '../db.ts'
import {files} from '../../schema.ts'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {renderMd} from './runMd.ts'

let rootDir = path.resolve(fileURLToPath(import.meta.url), '../../..')

export function listDirTool (repoId: string) {
  return tool({
    description: 'List files and directories at a path in the repository',
    inputSchema: z.object({
      path: z.string().describe('Directory path to list (use "" for root)'),
    }),
    execute: async ({path}) => {
      let prefix = path ? `${path}/` : ''
      let allFiles = await getDb()
        .select({path: files.path, extension: files.extension})
        .from(files)
        .where(eq(files.repoId, repoId))
        .all()

      // Filter to files that start with the prefix and extract immediate children
      let entries = new Set<string>()
      for (let file of allFiles) {
        let fullPath = `${file.path}.${file.extension}`
        if (!fullPath.startsWith(prefix)) continue

        let remainder = fullPath.slice(prefix.length)
        let slashIndex = remainder.indexOf('/')
        if (slashIndex === -1) {
          entries.add(remainder) // It's a file in this directory
        } else {
          entries.add(remainder.slice(0, slashIndex) + '/') // It's a subdirectory
        }
      }

      return Array.from(entries).sort()
    },
  })
}

export function readFileTool (repoId: string) {
  return tool({
    description: 'Read the contents of a file',
    inputSchema: z.object({
      path: z.string().describe('File path to read (without extension)'),
    }),
    execute: async ({path: filePath}) => {
      // Special case: docs/graphene.md is a core documentation file
      if (filePath.endsWith('docs/graphene.md') || filePath.endsWith('docs/graphene')) {
        let docsPath = path.resolve(rootDir, '../core/docs/graphene.md')
        if (fs.existsSync(docsPath)) {
          return {content: fs.readFileSync(docsPath, 'utf-8'), extension: 'md'}
        }
      }

      // Remove extension if provided
      let cleanPath = filePath.replace(/\.(md|gsql)$/, '')

      let file = await getDb()
        .select({content: files.content, extension: files.extension})
        .from(files)
        .where(and(eq(files.repoId, repoId), eq(files.path, cleanPath)))
        .get()

      if (!file) return {error: `File not found: ${filePath}`}
      return {content: file.content, extension: file.extension}
    },
  })
}

export function searchTool (repoId: string) {
  return tool({
    description: 'Search for files containing a string in their path or content',
    inputSchema: z.object({
      query: z.string().describe('Search query string'),
    }),
    execute: async ({query}) => {
      let pattern = `%${query}%`
      let results = await getDb()
        .select({path: files.path, extension: files.extension, content: files.content})
        .from(files)
        .where(and(
          eq(files.repoId, repoId),
          or(like(files.path, pattern), like(files.content, pattern)),
        ))
        .limit(20)
        .all()

      return results.map(r => {
        let preview = extractPreview(r.content, query)
        return {path: `${r.path}.${r.extension}`, preview}
      })
    },
  })
}

function extractPreview (content: string, query: string, contextChars = 100): string {
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

export function renderMdTool (repoId: string) {
  return tool({
    description: 'Render markdown containing a chart to an image. Returns a screenshot or errors. Use this when the user wants to see a visualization.',
    inputSchema: z.object({
      markdown: z.string().describe('Markdown content with graphene chart blocks to render'),
    }),
    execute: async ({markdown}) => {
      return await renderMd(markdown, repoId)
    },
  })
}
