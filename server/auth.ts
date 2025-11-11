import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify'
import {B2BClient} from 'stytch'

export interface AuthContext {
  userId: string
  orgId: string
}

let authOverride: AuthContext | null = null
export function setAuthOverride (auth: AuthContext | null) {
  if (process.env.NODE_ENV !== 'test') return
  authOverride = auth
}

export async function checkAuth (req: FastifyRequest) {
  req.auth = null

  if (process.env.NODE_ENV === 'test' && authOverride) {
    req.auth = authOverride
    return
  }

  let bearer = req.headers['authorization']
  if (bearer) {
    let claims = await getStytch().idp.introspectTokenLocal(bearer.replace(/^bearer /i, ''))
    req.auth = {userId: claims.subject, orgId: claims.organization.organization_id}
  }

  let session_jwt = req.cookies['stytch_session_jwt']
  if (session_jwt) {
    let auth = await getStytch().sessions.authenticateJwt({session_jwt: jwt})
    let session = auth.member_session
    if (!session) return
    req.auth = {userId: session.member_id, orgId: session.organization_id}
  }

  // TODO check org matches subdomain
}

export function ensureUser (req: FastifyRequest, reply: FastifyReply) {
  if (!req.auth) {
    reply.code(401).send({error: 'Authentication required'})
    return false
  }
  return true
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
