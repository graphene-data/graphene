import * as fs from 'fs'
import path from 'path'

export interface Config {
  root: string
  dialect: string
  namespace?: string
  port?: number
  host?: string

  bigquery?: {
    projectId?: string
    keyPath?: string
  }

  snowflake?: {
    account: string
    username: string
    privateKeyPath: string
    schema?: string
    database?: string
  }

  duckdb?: Record<string, unknown>
}

export type ConfigInput = Omit<Config, 'dialect'> & {dialect?: Config['dialect']}

export let config: Config = {dialect: 'duckdb', root: ''} as Config

// Used by tests
export function setConfig (cfg: ConfigInput) {
  let dialect = cfg.dialect || 'duckdb'
  if (cfg.bigquery) dialect = 'bigquery'
  else if (cfg.snowflake) dialect = 'snowflake'
  else if (cfg.duckdb) dialect = 'duckdb'
  Object.keys(config).forEach((key) => delete config[key])
  Object.assign(config, cfg, {dialect})
}

// Read graphene config out of package.json
export function loadConfig (dir:string) {
  if (config.root) return

  let packageJsonObject = {} as any
  try {
    let txt = fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
    let all = JSON.parse(txt)
    packageJsonObject = all.graphene || {}
  } catch {
    console.warn('No package.json found in current directory')
  }

  setConfig({...packageJsonObject, root: packageJsonObject.root || process.cwd()})
}
