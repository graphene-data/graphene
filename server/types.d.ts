import type {IncomingMessage, ServerResponse} from 'node:http'
import '@fastify/static'

export interface AuthContext {
  userId: string
  orgId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext
    cookies: Record<string, string | undefined>
  }

  interface FastifyReply {
    setCookie: (name: string, value: string, options?: {path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: 'strict' | 'lax' | 'none'; maxAge?: number}) => FastifyReply
    clearCookie: (name: string, options?: {path?: string}) => FastifyReply
  }

  interface FastifyInstance {
    use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void
  }
}
