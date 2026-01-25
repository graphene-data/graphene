import type {FastifyReply, FastifyRequest} from 'fastify'
import {and, eq} from 'drizzle-orm'
import {auth} from './auth.ts'
import {getDb} from './db.ts'
import {decryptSecret} from './secrets.ts'
import {connections, files, repos, type Connection} from '../schema.ts'
import {updateFile, clearWorkspace, analyze, getDiagnostics, toSql} from '../../core/lang/core.ts'
import {setConfig} from '../../core/lang/config.ts'

interface QueryBody {
  sql?: string
  gsql?: string
  params?: Record<string, any>
  repoId: string
}

export async function proxyQuery (req: FastifyRequest, reply: FastifyReply) {
  await auth(req, reply)
  let body = req.body as QueryBody
  let db = getDb()

  let connInfo = await db.query.connections.findFirst({where: eq(connections.orgId, req.auth.orgId)})
  if (!connInfo) return reply.code(400).send({error: 'No connection configured'})
  let sql = body.sql
  let fields = [] as any[]

  // We can proxy either sql or gsql. If it's gsql, we need to load up the workspace to render out the sql
  if (body.gsql) {
    let repo = await db.select().from(repos).where(and(eq(repos.id, body.repoId), eq(repos.orgId, req.auth.orgId))).then(rows => rows[0])
    if (!repo) return reply.code(404).send({error: 'No repo configured'})

    // Load up all gsql files into a graphene workspace
    let gsqlFiles = await db.query.files.findMany({where: and(eq(files.repoId, repo.id), eq(files.extension, 'gsql'))})
    clearWorkspace()
    setConfig({dialect: connInfo.kind, namespace: connInfo.namespace ?? undefined, root: '/dev/null'})
    gsqlFiles.forEach(f => updateFile(f.content, `${f.path}.gsql`))
    let queries = analyze(body.gsql, 'gsql')

    if (queries.length > 1) throw new Error('Found multiple queries, which could be a parsing error')
    if (getDiagnostics().length) {
      return reply.code(400).send(JSON.stringify(getDiagnostics()))
    }

    // Then, turn the requested query into sql, and execute against the db
    sql = toSql(queries[0], body.params)
    fields = queries[0].fields.map(f => ({name: f.name, type: f.type}))
  }

  if (!sql) return reply.code(400).send({error: 'No sql or gsql provided'})

  let conn = await getConnection(connInfo)
  let queryResults = await conn.runQuery(sql)

  let totalRows = queryResults.totalRows ?? queryResults.rows.length
  if (totalRows > queryResults.rows.length) throw new Error('Query returns too many rows')
  reply.send({rows: queryResults.rows, fields, sql})
}

async function getConnection (connInfo: Connection) {
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
