import {LambdaClient, InvokeCommand} from '@aws-sdk/client-lambda'
import {eq} from 'drizzle-orm'
import {getDb} from '../db.ts'
import {repos, orgs} from '../../schema.ts'
import {generateAgentToken} from '../auth.ts'
import {DOMAIN} from '../consts.ts'

let lambda = new LambdaClient({region: process.env.AWS_REGION || 'us-east-1'})

export interface RenderResult {
  success: boolean
  screenshot?: string
  error?: string
}

/** Build the URL for the dynamic render endpoint */
export function buildRenderUrl (markdown: string, token: string, baseUrl: string): string {
  let md = Buffer.from(markdown).toString('base64')
  return `${baseUrl}/_api/dynamic?md=${encodeURIComponent(md)}&token=${encodeURIComponent(token)}`
}

/** Render markdown to an image via the screenshot Lambda */
export async function renderMd (markdown: string, repoId: string, baseUrlOverride?: string): Promise<RenderResult> {
  let db = getDb()
  let repo = await db.select({orgId: repos.orgId}).from(repos).where(eq(repos.id, repoId)).then(rows => rows[0])
  if (!repo) return {success: false, error: 'Repo not found'}

  let org = await db.select({slug: orgs.slug}).from(orgs).where(eq(orgs.id, repo.orgId)).then(rows => rows[0])
  if (!org) return {success: false, error: 'Org not found'}

  let token = generateAgentToken(repo.orgId, repoId)
  let baseUrl = baseUrlOverride || `https://${org.slug}.${DOMAIN}`
  let url = buildRenderUrl(markdown, token, baseUrl)

  let response = await lambda.send(new InvokeCommand({
    FunctionName: 'graphene-screenshot',
    Payload: JSON.stringify({url, token}),
  }))

  let payload = response.Payload && JSON.parse(Buffer.from(response.Payload).toString())

  if (response.FunctionError || !payload) {
    let msg = payload.errorMessage || payload || 'Unknown'
    return {success: false, error: `Lambda error: ${msg}`}
  }

  return payload
}
