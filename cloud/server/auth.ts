import type {FastifyReply, FastifyRequest} from 'fastify'

import {eq} from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import {B2BClient} from 'stytch'
import {origin} from './utils.ts'
import type {AuthContext} from './types.js'

import {orgs} from '../schema.ts'
import {DOMAIN, PROD, TEST} from './consts.ts'
import {getDb} from './db.ts'

export type {AuthContext}

let authOverride: AuthContext | null = null
export function setAuthOverride(auth: AuthContext | null) {
  if (!TEST) return
  authOverride = auth
}

// Generate a short-lived JWT for the agent to authenticate with the dynamic endpoint.
export function generateAgentToken(orgId: string): string {
  return jwt.sign({orgId}, getAgentTokenSecret(), {expiresIn: '5m'})
}

export async function auth(req: FastifyRequest, reply: FastifyReply) {
  ;(req as any).auth = null
  let isAgentAuth = false

  if (TEST && authOverride) {
    req.auth = authOverride
  }

  // Check for agent token cookie first (used by screenshot Lambda for dynamic renders)
  let agentToken = req.cookies['graphene_agent_token']
  if (!req.auth && agentToken) {
    let claims = jwt.verify(agentToken, getAgentTokenSecret()) as {orgId: string}
    req.auth = {userId: 'agent', orgId: claims.orgId, slug: ''}
    isAgentAuth = true
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
    let authMetaUrl = `${origin(req)}/.well-known/oauth-protected-resource/_api/mcp`
    reply.header('WWW-Authenticate', `Bearer error="invalid_token", error_description="Authentication required", resource_metadata="${authMetaUrl}"`)
    reply.code(401).send({error: 'Authentication required'})
    return
  }

  // Skip subdomain validation for agent auth in dev (Lambda accesses via ngrok tunnel)
  if (isAgentAuth && !PROD) return

  // Validate subdomain matches user's org
  let host = (req.hostname || '').split(':')[0]
  if (PROD || host.includes('.')) {
    let base = '.localhost'
    if (PROD) base = '.' + DOMAIN
    let subdomain = host.replace(base, '')
    let org = await getDb()
      .select({slug: orgs.slug})
      .from(orgs)
      .where(eq(orgs.id, req.auth.orgId))
      .then(rows => rows[0])
    if (!org) throw new Error('Missing org for logged in user')
    req.auth.slug = org.slug

    if (org.slug !== subdomain && !['app', 'login'].includes(subdomain)) {
      reply.code(403).send({error: 'Incorrect subdomain', correctDomain: `${org?.slug}${base}`})
      return
    }
  }
}

let stytchClient: B2BClient | undefined

function getStytch(): B2BClient {
  stytchClient ||= new B2BClient({
    project_id: process.env.STYTCH_PROJECT_ID ?? '',
    secret: process.env.STYTCH_SECRET ?? '',
    custom_base_url: process.env.STYTCH_DOMAIN ?? '',
  })
  return stytchClient
}

function getAgentTokenSecret() {
  let secret = process.env.AGENT_TOKEN_SECRET
  if (!secret && PROD) {
    throw new Error('AGENT_TOKEN_SECRET must be set in production')
  }
  return secret || 'dev-secret-key'
}

export async function authTokenExchange(req: FastifyRequest, reply: FastifyReply) {
  let res = await fetch(`${process.env.STYTCH_DOMAIN}/v1/oauth2/token`, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams(req.body as any),
  })
  let json = await res.json()
  reply.code(res.status).send(json)
}

// Dynamic client registration shim backed by Graphene's connected-app client id.
export function oauthRegister(req: FastifyRequest, reply: FastifyReply) {
  let metadata = (req.body || {}) as Record<string, unknown>
  reply.type('application/json').send({
    ...metadata,
    client_id: process.env.AUTH_CLIENT_ID_MCP,
    token_endpoint_auth_method: 'none',
  })
}
