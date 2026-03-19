import type {FastifyReply, FastifyRequest} from 'fastify'

import {and, desc, eq} from 'drizzle-orm'

import {type AgentSession, agentSessions} from '../schema.ts'
import {PROD} from './consts.ts'
import {getDb} from './db.ts'

export async function getChatSession(req: FastifyRequest, reply: FastifyReply) {
  let id = (req.params as any).id as string
  let db = getDb()
  let session: AgentSession

  // in dev/test, allow `latest` for easier debugging
  if (id == 'latest' && !PROD) {
    session = await getDb()
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.orgId, req.auth.orgId))
      .orderBy(desc(agentSessions.updatedAt))
      .limit(1)
      .then(rows => rows[0])
  } else {
    session = await db
      .select()
      .from(agentSessions)
      .where(and(eq(agentSessions.orgId, req.auth.orgId), eq(agentSessions.id, id)))
      .then(rows => rows[0])
  }

  if (!session) return reply.code(404).send({error: 'Session not found'})

  reply.send({
    id: session.id,
    repoId: session.repoId,
    updatedAt: session.updatedAt,
    messages: session.messages || [],
  })
}
