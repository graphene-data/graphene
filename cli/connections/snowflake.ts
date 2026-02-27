import {createPrivateKey} from 'node:crypto'
import snowflake from 'snowflake-sdk'
import {config} from '../../lang/config.ts'
import {type QueryConnection, type QueryResult, type SchemaColumn, type QueryParams} from './types.ts'

interface SnowflakeOptions {
  username?: string
  account?: string
  privateKey?: string
  privateKeyPath?: string
  privateKeyPass?: string
  logLevel?: string
}

// Raw notes on setting up a new user:
// * create a `demouser` with a new `demorole`. It should have
// That role needs `operate` and `usage` on a warehouse, and `usage` on the relevant db or schema
// `ALTER USER DEMOUSER SET DEFAULT_WAREHOUSE = COMPUTE_WH;`
// `ALTER USER DEMOUSER SET DEFAULT_ROLE = DEMOREAD;`
// You can get the `account` by looking at the bit before "snowflakecomputing" in the account url (which is found in the snowflake ui)
// Instructions for generating private/public keys: https://docs.snowflake.com/en/user-guide/key-pair-auth#generate-the-private-keys

export class SnowflakeConnection implements QueryConnection {
  private ready: Promise<void>
  private connection!: snowflake.Connection

  constructor (opts: SnowflakeOptions) {
    this.ready = this.initialize(opts || {})
  }

  async initialize (opts: SnowflakeOptions) {
    let privateKeyPath = opts.privateKeyPath || config.snowflake?.privateKeyPath

    let authOptions: any = {}
    if (privateKeyPath) {
      authOptions = {privateKeyPath, privateKeyPass: opts.privateKeyPass}
    } else if (opts.privateKey) {
      let privateKey = createPrivateKey({key: opts.privateKey, format: 'pem', passphrase: opts.privateKeyPass})
      authOptions = {privateKey: privateKey.export({format: 'pem', type: 'pkcs8'})}
    }

    // default is info, which is kinda chatty on success. TRACE is super useful for debugging though
    snowflake.configure({logLevel: opts.logLevel as any || 'WARN', logFilePath: '/dev/null'})

    this.connection = snowflake.createConnection({
      ...opts,
      ...config.snowflake || {},
      ...authOptions,
      authenticator: 'SNOWFLAKE_JWT',
      application: 'Graphene',
    })

    await new Promise((resolve, reject) => {
      this.connection.connect((err, conn) => err ? reject(err) : resolve(conn))
    })
  }

  async runQuery (sql: string, params?: QueryParams): Promise<QueryResult> {
    await this.ready
    return await new Promise<QueryResult>((resolve, reject) => {
      let rows: any[] = []
      this.connection.execute({
        sqlText: sql,
        binds: params as any,
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
            resolve({rows, totalRows})
          })
        },
      })
    })
  }

  async listDatasets (): Promise<string[]> {
    let res = await this.runQuery('show databases')
    return res.rows.map(row => String(row['name'] || ''))
  }

  async listSchemas (database: string): Promise<string[]> {
    let res = await this.runQuery(`
      select schema_name as "schema_name"
      from ${snowflakeIdent(database)}.INFORMATION_SCHEMA.SCHEMATA
      where schema_name != 'INFORMATION_SCHEMA'
      order by schema_name
    `)
    return res.rows.map(row => String(row['schema_name']))
  }

  async listTables (dataset: string): Promise<string[]> {
    let parts = dataset.split('.')
    let database = parts.shift() || ''
    let schema = parts.join('.')

    let res = await this.runQuery(`
      select table_schema as "table_schema", table_name as "table_name"
      from ${snowflakeIdent(database)}.INFORMATION_SCHEMA.TABLES
      where table_type in ('BASE TABLE', 'VIEW') and table_schema = ?
      order by table_name
    `, [schema])
    return res.rows.map(row => `${row['table_schema']}.${row['table_name']}`)
  }

  async describeTable (target: string): Promise<SchemaColumn[]> {
    let parts = target.split('.')
    let database = parts.shift() || ''
    let table = parts.pop() || ''
    let schema = parts.join('.')

    let res = await this.runQuery(`
      select column_name as "column_name", data_type as "data_type", ordinal_position as ordinal_position
      from ${snowflakeIdent(database)}.INFORMATION_SCHEMA.COLUMNS
      where upper(table_schema) = upper(?) and upper(table_name) = upper(?)
      order by ordinal_position
    `, [schema, table])
    return res.rows.map(row => {
      return {name: String(row['column_name']).toLowerCase(), dataType: String(row['data_type'])}
    })
  }
}

function snowflakeIdent (value: string) {
  if (!value) throw new Error('Snowflake identifiers cannot be empty')
  return `"${value.replace(/"/g, '""')}"`
}
