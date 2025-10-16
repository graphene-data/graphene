interface AuthContext {
  userId: string | null
  orgId: string | null
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}
