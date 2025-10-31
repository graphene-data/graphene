import {createPrivateKey} from 'node:crypto'
import snowflake from 'snowflake-sdk'
import {config} from '../../lang/config.ts'
import {type QueryConnection, type QueryResult} from './types.ts'

interface SnowflakeOptions {
  username?: string
  account?: string
  privateKey?: string
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
  private connection: snowflake.Connection

  constructor (opts: SnowflakeOptions) {
    this.ready = this.initialize(opts || {})
  }

  async initialize (opts: SnowflakeOptions) {
    let privateKeyPath = process.env.SNOWFLAKE_PRI_KEY_PATH || config.snowflake?.privateKeyPath
    let privateKeyPass = process.env.SNOWFLAKE_PRI_PASSPHRASE

    let authOptions: any = {}
    if (privateKeyPath) {
      authOptions = {privateKeyPath, privateKeyPass}
    } else if (opts.privateKey) {
      let privateKey = createPrivateKey({key: opts.privateKey, format: 'pem', passphrase: privateKeyPass})
      authOptions = {privateKey: privateKey.export({format: 'pem', type: 'pkcs8'})}
    }

    // default is info, which is kinda chatty on success. TRACE is super useful for debugging though
    snowflake.configure({logLevel: process.env.SNOWFLAKE_LOG_LEVEL as any || 'WARN'})

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

  async runQuery (sql: string): Promise<QueryResult> {
    await this.ready
    return await new Promise<QueryResult>((resolve, reject) => {
      let rows: any[] = []
      this.connection.execute({
        sqlText: sql,
        streamResult: true,
        complete: (error, statement) => {
          if (error) {
            reject(new Error(`Snowflake query failed: ${error.message || error}`))
            return
          }

          let stream = statement.streamRows()
          stream.on('error', err => reject(err))
          stream.on('readable', function (row) {
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
}
