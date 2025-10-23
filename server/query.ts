import type {FastifyReply, FastifyRequest} from 'fastify'
import {and, eq} from 'drizzle-orm'
import {ensureUser} from './auth.ts'
import { getDb } from './db.ts'
import {connections, files, type Connection} from '../schema.ts'
import { updateFile, clearWorkspace, analyze, getDiagnostics, toSql } from '../../core/lang/core.ts'
import { setConfig } from '../../core/lang/config.ts'

type DuckConnectionConfig = {
  datasetRoot: string
  databaseFile?: string
}

export async function proxyQuery (req: FastifyRequest, reply: FastifyReply) {
  if (!ensureUser(req, reply)) return

  let cfg = await getDb().query.connections.findFirst({where: eq(connections.orgId, req.auth.orgId)})
  if (!cfg) return reply.code(400).send({error: 'No connection configured'})

  let decryptedConfig = decryptSecret(cfg.configJson)
  let connectionConfig: DuckConnectionConfig | undefined
  if (cfg.kind === 'duckdb') {
    try {
      connectionConfig = JSON.parse(decryptedConfig)
      if (typeof connectionConfig.datasetRoot !== 'string') {
        throw new Error('datasetRoot is missing')
      }
    } catch (error) {
      throw new Error('Invalid duckdb connection configuration: ' + (error as Error).message)
    }
  }

  let gsqlFiles = await getDb().query.files.findMany({where: and(eq(files.orgId, req.auth.orgId), eq(files.extension, 'gsql'))})
  clearWorkspace()
  setConfig({
    dialect: cfg.kind,
    namespace: cfg.namespace ?? undefined,
    root: connectionConfig?.datasetRoot ?? '',
  })
  gsqlFiles.forEach(f => updateFile(f.content, `${f.path}.gsql`))
  let queries = analyze(req.body.gsql, 'gsql')

  if (queries.length > 1) throw new Error('Found multiple queries, which could be a parsing error')
  if (getDiagnostics().length) {
    return reply.code(400).send(JSON.stringify(getDiagnostics()))
  }

  let sql = toSql(queries[0], req.body.params)

  let conn = await getConnection(cfg, decryptedConfig, connectionConfig)
  let queryResults = await conn.runQuery(sql)

  let totalRows = queryResults.totalRows ?? queryResults.rows.length
  if (totalRows > queryResults.rows.length) throw new Error('Query returns too many rows')
  let fields = queries[0].fields.map(f => ({name: f.name, type: f.type}))
  reply.send({rows: queryResults.rows, fields, sql})
}

async function getConnection (cfg: Connection, configJson: string, connectionConfig?: DuckConnectionConfig) {
  if (cfg.kind == 'bigquery') {
    let parsed = JSON.parse(configJson)
    let mod = await import('../../core/cli/connections/bigQuery.ts')
    return new mod.BigQueryConnection({keyFile: configJson, projectId: parsed.project_id})
  } else if (cfg.kind === 'duckdb') {
    if (!connectionConfig || typeof connectionConfig.datasetRoot !== 'string') {
      throw new Error('DuckDB connection missing datasetRoot')
    }
    let mod = await import('../../core/cli/connections/duckdb.ts')
    return new mod.DuckDBConnection()
  } else {
    throw new Error('Unsupported cloud database ' + cfg.kind)
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
