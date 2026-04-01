import type {FastifyReply, FastifyRequest} from 'fastify'

import {and, eq} from 'drizzle-orm'

import {analyzeWorkspace} from '../../core/lang/analyze.ts'
import {type GrapheneError, toSql} from '../../core/lang/core.ts'
import {type QueryResult} from '../../core/ui/component-utilities/types.ts'
import {connections, files, repos, type Connection} from '../schema.ts'
import {getDb} from './db.ts'
import {decryptSecret} from './secrets.ts'

export interface QueryBody {
  sql?: string
  gsql?: string
  params?: Record<string, any>
  repoId: string
}

class UserFacingError extends Error {}
class DiagnosticError extends Error {
  constructor(g: GrapheneError) {
    super(g.message)
    this.cause = g
  }
}

export async function queryEndpoint(req: FastifyRequest, reply: FastifyReply) {
  try {
    let res = await proxyQuery(req.auth.orgId, req.body as QueryBody)
    reply.send(res)
  } catch (e) {
    if (e instanceof UserFacingError) reply.status(400).send({message: e.message})
    else if (e instanceof DiagnosticError) reply.status(400).send(e.cause)
    else throw e
  }
}

export async function proxyQuery(orgId: string, body: QueryBody): Promise<QueryResult> {
  let db = getDb()

  let connInfo = await db.query.connections.findFirst({where: eq(connections.orgId, orgId)})
  if (!connInfo) throw new UserFacingError('No connection configured')
  if (!body.repoId) {
    let repo = await db.query.repos.findFirst({where: eq(connections.orgId, orgId)})
    body.repoId = repo?.id || ''
  }

  let sql = body.sql
  let fields = [] as any[]

  // We can proxy either sql or gsql. If it's gsql, we need to load up the workspace to render out the sql
  if (body.gsql) {
    let repo = await db
      .select()
      .from(repos)
      .where(and(eq(repos.id, body.repoId), eq(repos.orgId, orgId)))
      .then(rows => rows[0])
    if (!repo) throw new UserFacingError('No repo configured')

    // Load up all gsql files into a graphene workspace
    let gsqlFiles = await db.query.files.findMany({where: and(eq(files.repoId, repo.id), eq(files.extension, 'gsql'))})
    let {files: resultFiles, diagnostics} = analyzeWorkspace({
      config: {dialect: connInfo.kind, defaultNamespace: connInfo.namespace ?? undefined},
      files: [...gsqlFiles.map(f => ({contents: f.content, path: f.path + '.gsql'})), {path: 'input', contents: body.gsql}],
    })
    let queries = resultFiles.find(f => f.path == 'input')?.queries || []

    if (diagnostics.length) throw diagnostics[0]
    if (queries.length > 1) throw new Error('Found multiple queries, which could be a parsing error')

    // Then, turn the requested query into sql, and execute against the db
    sql = toSql(queries[0], body.params)
    fields = queries[0].fields.map(f => ({name: f.name, type: f.type}))
  }

  if (!sql) throw new UserFacingError('No sql or gsql provided')

  let conn = await getConnection(connInfo)
  let queryResults = await conn.runQuery(sql)

  let totalRows = queryResults.totalRows ?? queryResults.rows.length
  if (totalRows > queryResults.rows.length) throw new Error('Query returns too many rows')
  return {rows: queryResults.rows, fields, sql}
}

async function getConnection(connInfo: Connection) {
  let cfg = JSON.parse(await decryptSecret(connInfo.configJson))

  if (connInfo.kind == 'bigquery') {
    let mod = await import('../../core/cli/connections/bigQuery.ts')
    return new mod.BigQueryConnection({credentials: cfg, projectId: cfg.project_id})
  } else if (connInfo.kind === 'duckdb') {
    let mod = await import('../../core/cli/connections/duckdb.ts')
    return new mod.DuckDBConnection({path: cfg.dbPath})
  } else {
    throw new Error('Unsupported cloud database ' + connInfo.kind)
  }
}
