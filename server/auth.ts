import type {FastifyReply, FastifyRequest} from 'fastify'
import {eq} from 'drizzle-orm'
import {B2BClient} from 'stytch'
import type {AuthContext} from './types.js'
import {getDb} from './db.ts'
import {orgs} from '../schema.ts'

export type {AuthContext}

let BASE_DOMAIN_FOR_MULTITENTANT = process.env.NODE_ENV == 'prod' ? 'graphenedata.com' : ''

export function setBaseDomainOverride (domain: string) {
  if (process.env.NODE_ENV !== 'test') return
  BASE_DOMAIN_FOR_MULTITENTANT = domain
}

let authOverride: AuthContext | null = null
export function setAuthOverride (auth: AuthContext | null) {
  if (process.env.NODE_ENV !== 'test') return
  authOverride = auth
}

export async function auth (req: FastifyRequest, reply: FastifyReply) {
  (req as any).auth = null

  if (process.env.NODE_ENV === 'test' && authOverride) {
    req.auth = authOverride
  }

  let bearer = req.headers['authorization']
  if (bearer) {
    // TODO: errors here should turn in to 401s
    let claims = await getStytch().idp.introspectTokenLocal(bearer.replace(/^bearer /i, ''))
    req.auth = {userId: claims.subject, orgId: claims.organization.organization_id}
  }

  let session_jwt = req.cookies['stytch_session_jwt']
  if (session_jwt) {
    // TODO: errors here should turn in to 401s
    let auth = await getStytch().sessions.authenticateJwt({session_jwt})
    let session = auth.member_session
    if (!session) return
    req.auth = {userId: session.member_id, orgId: session.organization_id}
  }

  if (!req.auth) {
    reply.code(401).send({error: 'Authentication required'})
    throw new Error('Unauthorized')
  }

  // Validate subdomain matches user's org
  let host = (req.hostname || '').split(':')[0]
  if (BASE_DOMAIN_FOR_MULTITENTANT && host.endsWith(BASE_DOMAIN_FOR_MULTITENTANT)) {
    let subdomain = host.replace('.' + BASE_DOMAIN_FOR_MULTITENTANT, '')
    let org = await getDb().select({slug: orgs.slug}).from(orgs).where(eq(orgs.id, req.auth.orgId)).get()
    if (!org) throw new Error('Missing org for logged in user')
    if (org.slug !== subdomain) {
      reply.code(403).send({error: 'Incorrect subdomain', correctDomain: `${org?.slug}.${BASE_DOMAIN_FOR_MULTITENTANT}`})
      throw new Error('Unauthorized')
    }
  }
}

let stytchClient: B2BClient | undefined

function getStytch (): B2BClient {
  let secret = process.env.STYTCH_SECRET ?? ''

  if (secret.startsWith('{')) { // unpack AWS secret as needed
    secret = JSON.parse(secret)['STYTCH_SECRET']
  }

  stytchClient ||= new B2BClient({
    project_id: process.env.STYTCH_PROJECT_ID ?? '',
    secret,
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
