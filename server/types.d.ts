import type {IncomingMessage, ServerResponse} from 'node:http'

export interface AuthContext {
  userId: string
  orgId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext
    cookies: Record<string, string | undefined>
  }

  interface FastifyInstance {
    use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void
  }
}
