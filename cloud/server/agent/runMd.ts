import {LambdaClient, InvokeCommand} from '@aws-sdk/client-lambda'
import {eq} from 'drizzle-orm'
import {getDb} from '../db.ts'
import {repos, orgs} from '../../schema.ts'
import {generateAgentToken} from './tokens.ts'

let lambda = new LambdaClient({region: process.env.AWS_REGION || 'us-east-1'})

export interface RenderResult {
  success: boolean
  screenshot?: string
  error?: string
}

/** Render markdown to an image via the screenshot Lambda */
export async function renderMd (markdown: string, repoId: string): Promise<RenderResult> {
  let repo = await getDb().select({orgId: repos.orgId}).from(repos).where(eq(repos.id, repoId)).get()
  if (!repo) return {success: false, error: 'Repo not found'}

  let org = await getDb().select({slug: orgs.slug}).from(orgs).where(eq(orgs.id, repo.orgId)).get()
  if (!org) return {success: false, error: 'Org not found'}

  let token = generateAgentToken(repo.orgId, repoId)
  let baseUrl = `https://${org.slug}.graphenedata.com`

  let response = await lambda.send(new InvokeCommand({
    FunctionName: 'graphene-screenshot',
    Payload: JSON.stringify({type: 'renderMd', markdown, token, baseUrl}),
  }))

  if (response.FunctionError || !response.Payload) {
    let msg = response.Payload ? JSON.parse(Buffer.from(response.Payload).toString()).errorMessage : 'Unknown'
    return {success: false, error: `Lambda error: ${msg}`}
  }

  return JSON.parse(Buffer.from(response.Payload).toString())
}
