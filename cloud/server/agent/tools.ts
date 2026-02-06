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
      let allFiles = await (getDb())
        .select({path: files.path, extension: files.extension})
        .from(files)
        .where(eq(files.repoId, repoId))
        .then(rows => rows)

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

      let file = await (getDb())
        .select({content: files.content, extension: files.extension})
        .from(files)
        .where(and(eq(files.repoId, repoId), eq(files.path, cleanPath)))
        .then(rows => rows[0])

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
      let results = await (getDb())
        .select({path: files.path, extension: files.extension, content: files.content})
        .from(files)
        .where(and(
          eq(files.repoId, repoId),
          or(like(files.path, pattern), like(files.content, pattern)),
        ))
        .limit(20)
        .then(rows => rows)

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

export function renderMdTool (repoId: string, baseUrl?: string) {
  // Using 'as any' because toModelOutput is a runtime feature not yet in TypeScript types
  return tool({
    description: 'Render markdown containing a chart to an image. Returns a screenshot and the underlying tabular data. Use this when the user wants to see a visualization.',
    inputSchema: z.object({
      markdown: z.string().describe('Markdown content with graphene chart blocks to render'),
    }),
    execute: async ({markdown}) => {
      return await renderMd(markdown, repoId, baseUrl)
    },
    // Convert results to multi-modal content for the model.
    // If there are query errors, skip the screenshot and just return the errors so the agent can fix them.
    toModelOutput ({output}: {output: {success: boolean, screenshot?: string, queryData?: Record<string, {rows: any[]}>, errors?: {message: string, id?: string}[], error?: string}}) {
      if (output.success && output.errors?.length) {
        let errText = output.errors.map(e => e.id ? `${e.id}: ${e.message}` : e.message).join('\n')
        return {type: 'content' as const, value: [{type: 'text' as const, text: `Query errors:\n${errText}`}]}
      }
      if (output.success && output.screenshot) {
        let content: any[] = [
          {type: 'media' as const, data: output.screenshot, mediaType: 'image/png' as const},
        ]
        if (output.queryData && Object.keys(output.queryData).length > 0) {
          let dataSummary = Object.entries(output.queryData).map(([name, {rows}]) => {
            let header = rows.length > 0 ? Object.keys(rows[0]).join(' | ') : '(no columns)'
            let dataRows = rows.slice(0, 50).map(r => Object.values(r).join(' | '))
            let truncated = rows.length > 50 ? `\n... (${rows.length - 50} more rows)` : ''
            return `Query "${name}" (${rows.length} rows):\n${header}\n${dataRows.join('\n')}${truncated}`
          }).join('\n\n')
          content.push({type: 'text' as const, text: `Underlying data:\n\n${dataSummary}`})
        }
        return {type: 'content' as const, value: content}
      }
      return {type: 'json' as const, value: output}
    },
  } as any)
}
