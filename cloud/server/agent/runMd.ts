import {LambdaClient, InvokeCommand} from '@aws-sdk/client-lambda'
import crypto from 'node:crypto'
import {eq} from 'drizzle-orm'
import {getDb} from '../db.ts'
import {repos, orgs} from '../../schema.ts'
import {generateAgentToken} from '../auth.ts'
import {DOMAIN} from '../consts.ts'

let lambda = new LambdaClient({region: process.env.AWS_REGION || 'us-east-1'})

export interface RenderResult {
  success: boolean
  mdId?: string
  screenshot?: string
  queryData?: Record<string, {rows: any[], fields?: {name: string, type?: string}[]}>
  errors?: {message: string, id?: string}[]
  error?: string
}

/** Render markdown to an image via the screenshot Lambda */
export async function renderMd (markdown: string, repoId: string, baseUrlOverride?: string): Promise<RenderResult> {
  let mdId = crypto.createHash('sha256').update(markdown).digest('hex')
  let db = getDb()
  let repo = await db.select({orgId: repos.orgId}).from(repos).where(eq(repos.id, repoId)).then(rows => rows[0])
  if (!repo) return {success: false, mdId, error: 'Repo not found'}

  let org = await db.select({slug: orgs.slug}).from(orgs).where(eq(orgs.id, repo.orgId)).then(rows => rows[0])
  if (!org) return {success: false, mdId, error: 'Org not found'}

  let token = generateAgentToken(repo.orgId)
  let baseUrl = baseUrlOverride || `https://${org.slug}.${DOMAIN}`
  let md = Buffer.from(markdown).toString('base64')
  let url = `${baseUrl}/_api/dynamic?md=${encodeURIComponent(md)}&repoId=${encodeURIComponent(repoId)}`

  let response = await lambda.send(new InvokeCommand({
    FunctionName: 'graphene-screenshot',
    Payload: JSON.stringify({url, token, selector: 'canvas'}),
  }))

  let payload = response.Payload && JSON.parse(Buffer.from(response.Payload).toString())

  if (response.FunctionError || !payload) {
    let msg = payload.errorMessage || payload || 'Unknown'
    return {success: false, mdId, error: `Lambda error: ${msg}`}
  }

  return {...payload, mdId}
}
