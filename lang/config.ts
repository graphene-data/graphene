import * as fs from 'fs'
import path from 'path'

export interface Config {
  root: string
  dialect: string
  namespace?: string
  ignoredFiles: string[]
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

export type ConfigInput = Omit<Config, 'dialect' | 'ignoredFiles'> & {
  dialect?: Config['dialect'],
  ignoredFiles?: Config['ignoredFiles'],
}

export let config: Config = {dialect: 'duckdb', root: ''} as Config


export function setConfig (cfg: ConfigInput) {
  let dialect = cfg.dialect || 'duckdb'
  if (cfg.bigquery) dialect = 'bigquery'
  else if (cfg.snowflake) dialect = 'snowflake'
  else if (cfg.duckdb) dialect = 'duckdb'
  Object.keys(config).forEach((key) => delete config[key])
  Object.assign(config, cfg)
  config.dialect = dialect
  config.root ||= process.cwd()
  config.ignoredFiles ||= ['agents.md', 'claude.md']
}

// Read graphene config out of package.json
export function loadConfig (dir:string) {
  if (config.root) return

  let packageJsonObject = {} as any
  try {
    let txt = fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
    packageJsonObject = JSON.parse(txt).graphene || {}
  } catch {
    console.warn('No package.json found in current directory')
  }

  setConfig({...packageJsonObject, root: packageJsonObject.root || process.cwd()})
}
