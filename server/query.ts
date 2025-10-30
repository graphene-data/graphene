import type {FastifyReply, FastifyRequest} from 'fastify'
import {and, eq} from 'drizzle-orm'
import {ensureUser} from './auth.ts'
import {getDb} from './db.ts'
import {connections, files, type Connection} from '../schema.ts'
import {updateFile, clearWorkspace, analyze, getDiagnostics, toSql} from '../../core/lang/core.ts'
import {setConfig} from '../../core/lang/config.ts'

export async function proxyQuery (req: FastifyRequest, reply: FastifyReply) {
  if (!ensureUser(req, reply)) return

  let connInfo = await getDb().query.connections.findFirst({where: eq(connections.orgId, req.auth.orgId)})
  if (!connInfo) return reply.code(400).send({error: 'No connection configured'})

  // Load up all gsql files into a graphene workspace
  let gsqlFiles = await getDb().query.files.findMany({where: and(eq(files.orgId, req.auth.orgId), eq(files.extension, 'gsql'))})
  clearWorkspace()
  setConfig({dialect: connInfo.kind, namespace: connInfo.namespace ?? undefined, root: '/dev/null'})
  gsqlFiles.forEach(f => updateFile(f.content, `${f.path}.gsql`))
  let queries = analyze(req.body.gsql, 'gsql')

  if (queries.length > 1) throw new Error('Found multiple queries, which could be a parsing error')
  if (getDiagnostics().length) {
    return reply.code(400).send(JSON.stringify(getDiagnostics()))
  }

  // Then, turn the requested query into sql, and execute against the db
  let sql = toSql(queries[0], req.body.params)
  let conn = await getConnection(connInfo)
  let queryResults = await conn.runQuery(sql)

  let totalRows = queryResults.totalRows ?? queryResults.rows.length
  if (totalRows > queryResults.rows.length) throw new Error('Query returns too many rows')
  let fields = queries[0].fields.map(f => ({name: f.name, type: f.type}))
  reply.send({rows: queryResults.rows, fields, sql})
}

async function getConnection (connInfo: Connection) {
  let cfg = JSON.parse(decryptSecret(connInfo.configJson))

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

export function decryptSecret (cipher:string): string {
  // TODO once we set up KMS
  return cipher
}

export function encryptSecret (body: string): string {
  // TODO once we set up KMS
  return body
}
