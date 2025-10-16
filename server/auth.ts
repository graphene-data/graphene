import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify'
import {B2BClient} from 'stytch'

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

  let jwt = req.cookies['stytch_session_jwt']
  if (!jwt) return

  let auth = await getStytch().sessions.authenticateJwt({session_jwt: jwt})
  let session = auth.member_session

  // TODO check org matches subdomain
  // TODO check user belongs to org

  if (!session) req.auth = null
  else req.auth = {userId: session.member_id, orgId: session.organization_id}
}

// export function authPlugin (server: FastifyInstance) {
//   console.log('auth hook')
//   server.addHook('onRequest', async (req, reply) => {

//   })

//   server.post('/_api/authenticate', (req, reply) => {
//   })

//   server.post('/_api/login', (req, reply) => {

//   })

//   server.post('/_api/signup', (req, reply) => {

//   })
// }

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
  })
  return stytchClient
}
