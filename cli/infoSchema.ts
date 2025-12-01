import {config} from '../lang/config.ts'
import {runQuery} from './connections/index.ts'

export interface SchemaTable {
  schema?: string
  name: string
}

export interface SchemaColumn {
  name: string
  dataType: string
}

export async function listSchemaTables (): Promise<SchemaTable[]> {
  let sql = ''
  switch (config.dialect) {
    case 'duckdb':
      sql = `select table_schema as table_schema, table_name as table_name
        from information_schema.tables
        where table_type in ('BASE TABLE', 'VIEW') and table_schema not in ('information_schema', 'pg_catalog')
        order by table_schema, table_name
      `.trim()
      break
    case 'bigquery': {
      let dataset = getBigQueryDatasetRef()
      sql = `select table_schema as table_schema, table_name as table_name
        from \`${dataset}.INFORMATION_SCHEMA.TABLES\`
        where table_type in ('BASE TABLE', 'VIEW')
        order by table_name
      `.trim()
      break
    }
    case 'snowflake': {
      let {database, schema} = getSnowflakeNamespace()
      let tablesRef = `${snowflakeIdent(database)}.${snowflakeIdent('INFORMATION_SCHEMA')}.${snowflakeIdent('TABLES')}`
      sql = `select table_schema as "table_schema", table_name as "table_name"
        from ${tablesRef}
        where upper(table_schema) = upper(${sqlStringLiteral(schema)})
        order by table_name
      `.trim()
      break
    }
    default:
      throw new Error(`schema command is not supported for dialect "${config.dialect}"`)
  }


  let res = await runQuery(sql)
  return res.rows.map(row => {
    return {schema: String(row['table_schema'] || ''), name: String(row['table_name'])}
  })
}

export async function describeSchemaTable (target: string): Promise<SchemaColumn[]> {
  let parts = target.split('.')
  let table = parts.pop() || ''
  let schema = parts.join('.')
  let sql = ''
  switch (config.dialect) {
    case 'duckdb': {
      let schemaFilter = schema
        ? `lower(table_schema) = lower(${sqlStringLiteral(schema)})`
        : 'table_schema not in (\'information_schema\', \'pg_catalog\')'
      sql = `
        select column_name as column_name, data_type as data_type, ordinal_position as ordinal_position
        from information_schema.columns
        where lower(table_name) = lower(${sqlStringLiteral(table)}) and ${schemaFilter}
        order by ordinal_position
      `.trim()
      break
    }
    case 'bigquery': {
      let dataset = getBigQueryDatasetRef()
      sql = `
        select column_name as column_name, data_type as data_type, ordinal_position as ordinal_position
        from \`${dataset}.INFORMATION_SCHEMA.COLUMNS\`
        where lower(table_name) = lower(${sqlStringLiteral(table)})
        order by ordinal_position
      `.trim()
      break
    }
    case 'snowflake': {
      let {database, schema} = getSnowflakeNamespace()
      let columnsRef = `${snowflakeIdent(database)}.${snowflakeIdent('INFORMATION_SCHEMA')}.${snowflakeIdent('COLUMNS')}`
      sql = `
        select column_name as "column_name", data_type as "data_type", ordinal_position as ordinal_position
        from ${columnsRef}
        where upper(table_schema) = upper(${sqlStringLiteral(schema)}) and upper(table_name) = upper(${sqlStringLiteral(table)})
        order by ordinal_position
      `.trim()
      break
    }
    default:
      throw new Error(`schema command is not supported for dialect "${config.dialect}"`)
  }

  let res = await runQuery(sql)
  return res.rows.map(row => {
    return {name: String(row['column_name']), dataType: String(row['data_type'])}
  })
}

function sqlStringLiteral (value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function getBigQueryDatasetRef (): string {
  if (!config.namespace) {
    throw new Error('Set "namespace" to "<project>.<dataset>" to use the schema command with BigQuery')
  }
  let parts = config.namespace.split('.').filter(Boolean)
  if (!parts.length) throw new Error('Invalid namespace for BigQuery connection')
  if (parts.length === 1) {
    if (!config.bigquery?.projectId) {
      throw new Error('BigQuery namespace must include a project (e.g. "my-project.my_dataset") or set bigquery.projectId')
    }
    return `${config.bigquery.projectId}.${parts[0]}`
  }
  let project = parts.shift()!
  return `${project}.${parts.join('.')}`
}

function getSnowflakeNamespace (): {database: string, schema: string} {
  if (!config.namespace) {
    throw new Error('Set "namespace" to "<database>.<schema>" to use the schema command with Snowflake')
  }
  let parts = config.namespace.split('.').filter(Boolean)
  if (parts.length < 2) {
    throw new Error('Snowflake namespace must be in the form "DATABASE.SCHEMA"')
  }
  let schema = parts.pop()!
  let database = parts.join('.')
  return {database, schema}
}

function snowflakeIdent (value: string) {
  if (!value) throw new Error('Snowflake identifiers cannot be empty')
  return `"${value.replace(/"/g, '""')}"`
}
