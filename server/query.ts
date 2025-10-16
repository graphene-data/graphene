import type {FastifyInstance} from 'fastify'
import {and, eq} from 'drizzle-orm'

import {ensureUser} from './auth.ts'
import {getDb, schema} from '../db/client.ts'

export const registerQuery = (app: FastifyInstance) => {
  let db = getDb()

  app.post('/_query', async (request, reply) => {
    let context = ensureUser(request, reply)
    if (!context) return

    let body = request.body as { connection?: string; sql?: string }
    if (!body?.connection || !body.sql) {
      return reply.code(400).send({error: 'connection and sql are required'})
    }

    let [connection] = await db
      .select()
      .from(schema.connections)
      .where(
        and(
          eq(schema.connections.orgId, context.org.id),
          eq(schema.connections.label, body.connection),
        ),
      )
      .limit(1)

    if (!connection) {
      return reply.code(404).send({error: 'Connection not found'})
    }

    return reply.code(501).send({
      error: 'Query execution not yet implemented',
      connection: {
        kind: connection.kind,
        config: JSON.parse(connection.configJson),
      },
      sql: body.sql,
    })
  })
}
