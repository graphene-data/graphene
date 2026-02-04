import type {FastifyReply, FastifyRequest} from 'fastify'
import {eq} from 'drizzle-orm'
import {B2BClient} from 'stytch'
import jwt from 'jsonwebtoken'
import type {AuthContext} from './types.js'
import {getDb} from './db.ts'
import {orgs} from '../schema.ts'
import {DOMAIN, PROD, TEST} from './consts.ts'

export type {AuthContext}

// --- Agent Token Authentication ---

function getAgentTokenSecret () {
  let secret = process.env.AGENT_TOKEN_SECRET
  if (!secret && PROD) {
    throw new Error('AGENT_TOKEN_SECRET must be set in production')
  }
  return secret || 'dev-secret-key'
}

export interface AgentTokenClaims {
  orgId: string
  repoId: string
  purpose: 'agent-render'
}

/**
 * Generate a short-lived JWT for the agent to authenticate with the dynamic endpoint.
 */
export function generateAgentToken (orgId: string, repoId: string): string {
  return jwt.sign(
    {orgId, repoId, purpose: 'agent-render'} satisfies AgentTokenClaims,
    getAgentTokenSecret(),
    {expiresIn: '5m'},
  )
}

/**
 * Verify an agent token and return the claims.
 */
export function verifyAgentToken (token: string): AgentTokenClaims | null {
  try {
    let claims = jwt.verify(token, getAgentTokenSecret()) as AgentTokenClaims
    if (claims.purpose !== 'agent-render') return null
    return claims
  } catch {
    return null
  }
}

let authOverride: AuthContext | null = null
export function setAuthOverride (auth: AuthContext | null) {
  if (!TEST) return
  authOverride = auth
}

export async function auth (req: FastifyRequest, reply: FastifyReply) {
  (req as any).auth = null
  let isAgentAuth = false

  if (TEST && authOverride) {
    req.auth = authOverride
  }

  // Check for agent token cookie first (used by screenshot Lambda for dynamic renders)
  let agentToken = req.cookies['graphene_agent_token']
  if (!req.auth && agentToken) {
    let claims = verifyAgentToken(agentToken)
    if (claims) {
      req.auth = {userId: 'agent', orgId: claims.orgId, slug: ''}
      isAgentAuth = true
    }
  }

  let bearer = req.headers['authorization']
  if (!req.auth && bearer) {
    let claims = await getStytch().idp.introspectTokenLocal(bearer.replace(/^bearer /i, ''))
    req.auth = {userId: claims.subject, orgId: claims.organization.organization_id, slug: ''}
  }

  let session_jwt = req.cookies['stytch_session_jwt']
  if (!req.auth && session_jwt) {
    let auth = await getStytch().sessions.authenticateJwt({session_jwt})
    let session = auth.member_session
    if (session) {
      req.auth = {userId: session.member_id, orgId: session.organization_id, slug: ''}
    }
  }

  if (!req.auth) {
    reply.code(401).send({error: 'Authentication required'})
    throw new Error('Unauthorized')
  }

  // Skip subdomain validation for agent auth (Lambda accesses via ngrok tunnel)
  if (isAgentAuth || !PROD) return

  // Validate subdomain matches user's org
  let host = (req.hostname || '').split(':')[0]
  if (PROD || host.includes('.')) {
    let base = '.localhost'
    if (PROD) base = '.' + DOMAIN
    let subdomain = host.replace(base, '')
    let org = await (getDb()).select({slug: orgs.slug}).from(orgs).where(eq(orgs.id, req.auth.orgId)).then(rows => rows[0])
    if (!org) throw new Error('Missing org for logged in user')
    req.auth.slug = org.slug

    if (org.slug !== subdomain && !['app', 'login'].includes(subdomain)) {
      reply.code(403).send({error: 'Incorrect subdomain', correctDomain: `${org?.slug}${base}`})
      throw new Error('Unauthorized')
    }
  }
}

let stytchClient: B2BClient | undefined

function getStytch (): B2BClient {
  stytchClient ||= new B2BClient({
    project_id: process.env.STYTCH_PROJECT_ID ?? '',
    secret: process.env.STYTCH_SECRET ?? '',
    custom_base_url: process.env.STYTCH_DOMAIN ?? '',
  })
  return stytchClient
}

export async function authTokenExchange (req: FastifyRequest, reply: FastifyReply) {
  let res = await fetch(`${process.env.STYTCH_DOMAIN}/v1/oauth2/token`, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams(req.body as any),
  })
  let json = await res.json()
  reply.code(res.status).send(json)
}
