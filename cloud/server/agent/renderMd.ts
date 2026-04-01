import {LambdaClient, InvokeCommand} from '@aws-sdk/client-lambda'
import {eq} from 'drizzle-orm'
import crypto from 'node:crypto'
import z from 'zod'

import {repos, orgs} from '../../schema.ts'
import {generateAgentToken} from '../auth.ts'
import {DOMAIN, PROD} from '../consts.ts'
import {getDb} from '../db.ts'
import {type SharedTool} from './tools.ts'

let lambda = new LambdaClient({region: process.env.AWS_REGION || 'us-east-1'})

export interface RenderResult {
  success: boolean
  mdId?: string
  screenshot?: string
  queryData?: Record<string, {rows: any[]; fields?: {name: string; type?: string}[]}>
  errors?: {message: string; id?: string}[]
  error?: string
}

export const renderMdScreenshot = {
  name: 'render-md',
  description: 'Render markdown containing a chart to an image. Returns a screenshot and the underlying tabular data. Use this when the user wants to see a visualization.',
  inputSchema: z.object({markdown: z.string().describe('Markdown content with graphene chart blocks to render')}),
  fn: async function renderMd(repoId: string, {markdown}: {markdown: string}) {
    return await captureScreenshot(repoId, markdown)
  },
  toModelOutput,
} satisfies SharedTool

/** Render markdown to an image via the screenshot Lambda */
export async function captureScreenshot(repoId: string, markdown: string): Promise<RenderResult> {
  let mdId = crypto.createHash('sha256').update(markdown).digest('hex')
  let db = getDb()
  let repo = await db.query.repos.findFirst({where: eq(repos.id, repoId)})
  if (!repo) return {success: false, mdId, error: 'Repo not found'}

  let org = await db.query.orgs.findFirst({where: eq(orgs.id, repo.orgId)})
  if (!org) return {success: false, mdId, error: 'Org not found'}

  let token = generateAgentToken(repo.orgId)
  let baseUrl = !PROD ? ((globalThis as any).__GRAPHENE_DEV_NGROK_URL as string) : undefined
  baseUrl ||= `https://${org.slug}.${DOMAIN}`
  let md = Buffer.from(markdown).toString('base64')
  let url = `${baseUrl}/dynamic?md=${encodeURIComponent(md)}&repoId=${encodeURIComponent(repoId)}`

  // Log the render URL so we can debug screenshot failures in staging logs.
  console.log('[renderMd] invoking screenshot lambda', {repoId, mdId, url})

  let response = await lambda.send(
    new InvokeCommand({
      FunctionName: 'graphene-screenshot',
      Payload: JSON.stringify({url, token}),
    }),
  )

  let payload = response.Payload && JSON.parse(Buffer.from(response.Payload).toString())

  if (response.FunctionError || !payload) {
    let msg = payload.errorMessage || payload || 'Unknown'
    return {success: false, mdId, error: `Lambda error: ${msg}`}
  }

  return {...payload, mdId}
}

// Convert results to multi-modal content for the model.
// If there are query errors, skip the screenshot and just return the errors so the agent can fix them.
function toModelOutput({
  output,
}: {
  output: {success: boolean; mdId?: string; screenshot?: string; queryData?: Record<string, {rows: any[]}>; errors?: {message: string; id?: string}[]; error?: string}
}) {
  if (output.success && output.errors?.length) {
    let errText = output.errors.map(e => (e.id ? `${e.id}: ${e.message}` : e.message)).join('\n')
    let mdIdText = output.mdId ? `Rendered markdown id: ${output.mdId}\n` : ''
    return {type: 'content' as const, value: [{type: 'text' as const, text: `${mdIdText}Query errors:\n${errText}`}]}
  }
  if (output.success && output.screenshot) {
    let content: any[] = []
    if (output.mdId) content.push({type: 'text' as const, text: `Rendered markdown id: ${output.mdId}`})
    content.push({type: 'media' as const, data: output.screenshot, mediaType: 'image/png' as const})
    if (output.queryData && Object.keys(output.queryData).length > 0) {
      let dataSummary = Object.entries(output.queryData)
        .map(([name, {rows}]) => {
          let header = rows.length > 0 ? Object.keys(rows[0]).join(' | ') : '(no columns)'
          let dataRows = rows.slice(0, 50).map(r => Object.values(r).join(' | '))
          let truncated = rows.length > 50 ? `\n... (${rows.length - 50} more rows)` : ''
          return `Query "${name}" (${rows.length} rows):\n${header}\n${dataRows.join('\n')}${truncated}`
        })
        .join('\n\n')
      content.push({type: 'text' as const, text: `Underlying data:\n\n${dataSummary}`})
    }
    return {type: 'content' as const, value: content}
  }
  return {type: 'json' as const, value: output}
}
