// import type {IncomingMessage, ServerResponse} from 'node:http'
import '@fastify/static'

export interface AuthContext {
  userId: string
  orgId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext
  }
}
