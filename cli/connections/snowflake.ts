import {createPrivateKey} from 'node:crypto'
import snowflake from 'snowflake-sdk'

import {config} from '../../lang/config.ts'
import {type QueryConnection, type QueryResult, type SchemaColumn, type QueryOptions} from './types.ts'

export interface SnowflakeOptions {
  username?: string
  account?: string
  privateKey?: string
  privateKeyPath?: string
  privateKeyPass?: string
  authenticator?: 'OAUTH_AUTHORIZATION_CODE' | 'EXTERNALBROWSER' | 'SNOWFLAKE_JWT'
  logLevel?: string
  timeout?: number
  sessionParameters?: Record<string, unknown>
}

// Raw notes on setting up a new user:
// * create a `demouser` with a new `demorole`. It should have
// That role needs `operate` and `usage` on a warehouse, and `usage` on the relevant db or schema
// `ALTER USER DEMOUSER SET DEFAULT_WAREHOUSE = COMPUTE_WH;`
// `ALTER USER DEMOUSER SET DEFAULT_ROLE = DEMOREAD;`
// You can get the `account` by looking at the bit before "snowflakecomputing" in the account url (which is found in the snowflake ui)
// Instructions for generating private/public keys: https://docs.snowflake.com/en/user-guide/key-pair-auth#generate-the-private-keys

export class SnowflakeConnection implements QueryConnection {
  protected ready: Promise<void>
  protected connection!: snowflake.Connection

  constructor(opts: SnowflakeOptions) {
    this.ready = this.initialize(opts || {})
  }

  async initialize(opts: SnowflakeOptions) {
    let connOpts = {
      ...opts,
      application: 'Graphene',
      timeout: opts.timeout ?? 120_000,
      sessionParameters: {STATEMENT_TIMEOUT_IN_SECONDS: 120, ...opts.sessionParameters},
    } as snowflake.ConnectionOptions
    connOpts.authenticator = opts.authenticator || 'SNOWFLAKE_JWT'

    if (opts.privateKeyPath) {
      connOpts.privateKeyPath = opts.privateKeyPath
      connOpts.privateKeyPass = opts.privateKeyPass
    } else if (opts.privateKey) {
      let privateKey = createPrivateKey({key: opts.privateKey, format: 'pem', passphrase: opts.privateKeyPass})
      connOpts.privateKey = privateKey.export({format: 'pem', type: 'pkcs8'}).toString()
    }

    // for local login via browser, automatically store credentials
    if (opts.authenticator == 'OAUTH_AUTHORIZATION_CODE' || opts.authenticator === 'EXTERNALBROWSER') {
      connOpts.clientStoreTemporaryCredential = true
    }

    // default is info, which is kinda chatty on success. TRACE is super useful for debugging though
    snowflake.configure({logLevel: (opts.logLevel as any) || 'WARN', logFilePath: '/dev/null'})

    this.connection = snowflake.createConnection(connOpts)
    await new Promise((resolve, reject) => {
      this.connection.connect((err, conn) => (err ? reject(err) : resolve(conn)))
    })
  }

  async runQuery(sql: string, options?: QueryOptions): Promise<QueryResult> {
    let {rows, totalRows} = await this.executeQuery(sql, options)
    return {rows, totalRows}
  }

  protected async executeQuery(sql: string, options?: QueryOptions): Promise<QueryResult & {queryId?: string}> {
    await this.ready
    return await new Promise<QueryResult & {queryId?: string}>((resolve, reject) => {
      let rows: any[] = []
      this.connection.execute({
        sqlText: sql,
        binds: options?.params as any,
        streamResult: true,
        complete: (error, statement) => {
          if (error) {
            reject(new Error(`Snowflake query failed: ${error.message || error}`))
            return
          }

          let stream = statement.streamRows()
          stream.on('error', err => reject(err))
          stream.on('readable', function (this: any, row) {
            while ((row = this.read()) !== null) {
              rows.push(row)
            }
          })
          stream.on('end', () => {
            let totalRows = Number(statement.getNumRows())
            resolve({rows, totalRows, queryId: statement.getQueryId()})
          })
        },
      })
    })
  }

  async listDatasets(): Promise<string[]> {
    let res = await this.runQuery('show databases')
    return res.rows.map(row => String(row['name'] || ''))
  }

  async listSchemas(database: string): Promise<string[]> {
    let resolvedDatabase = await this.resolveDatabaseName(database)
    let res = await this.runQuery(`
      select schema_name as "schema_name"
      from ${snowflakeIdent(resolvedDatabase)}.INFORMATION_SCHEMA.SCHEMATA
      where schema_name != 'INFORMATION_SCHEMA'
      order by schema_name
    `)
    return res.rows.map(row => String(row['schema_name']).toLowerCase())
  }

  async listTables(dataset: string): Promise<string[]> {
    let parts = dataset.split('.')
    let database = await this.resolveDatabaseName(parts.shift() || '')
    let schema = parts.join('.')

    let res = await this.runQuery(
      `
      select table_schema as "table_schema", table_name as "table_name"
      from ${snowflakeIdent(database)}.INFORMATION_SCHEMA.TABLES
      where table_type in ('BASE TABLE', 'VIEW') and upper(table_schema) = upper(?)
      order by table_name
    `,
      {params: [schema]},
    )
    return res.rows.map(row => `${String(row['table_schema']).toLowerCase()}.${String(row['table_name']).toLowerCase()}`)
  }

  async describeTable(target: string): Promise<SchemaColumn[]> {
    let parts = target.split('.')
    let database = await this.resolveDatabaseName(parts.shift() || '')
    let table = parts.pop() || ''
    let schema = parts.join('.')

    let res = await this.runQuery(
      `
      select column_name as "column_name", data_type as "data_type", ordinal_position as ordinal_position
      from ${snowflakeIdent(database)}.INFORMATION_SCHEMA.COLUMNS
      where upper(table_schema) = upper(?) and upper(table_name) = upper(?)
      order by ordinal_position
    `,
      {params: [schema, table]},
    )
    return res.rows.map(row => {
      return {name: String(row['column_name']).toLowerCase(), dataType: String(row['data_type'])}
    })
  }

  async resolveDatabaseName(name: string): Promise<string> {
    let databases = await this.listDatasets()
    return databases.find(db => db.toLowerCase() == name.toLowerCase()) || name
  }

  async close(): Promise<void> {
    await this.ready
    await new Promise<void>((resolve, reject) => {
      this.connection.destroy(err => (err ? reject(err) : resolve()))
    })
  }
}

function snowflakeIdent(value: string) {
  if (!value) throw new Error('Snowflake identifiers cannot be empty')
  return `"${value.replace(/"/g, '""')}"`
}

export function escapeSnowflakeString(value: string) {
  return value.replace(/'/g, "''")
}

export function localDbOptions(): SnowflakeOptions {
  let snowflakeConfig = config.snowflake!
  let {account, username} = snowflakeConfig
  let privateKeyPath = process.env.SNOWFLAKE_PRI_KEY_PATH || snowflakeConfig.privateKeyPath
  let privateKey = process.env.SNOWFLAKE_PRI_KEY
  let authenticator = snowflakeConfig.authenticator || 'SNOWFLAKE_JWT'

  // if you set a private key, we'll use that instead of the config
  if (privateKeyPath || privateKey) authenticator = 'SNOWFLAKE_JWT'

  return {
    account,
    username,
    authenticator,
    privateKeyPath,
    privateKey,
    privateKeyPass: process.env.SNOWFLAKE_PRI_PASSPHRASE,
  }
}
