import * as fs from 'fs'
import path from 'path'

export interface Config {
  root: string
  dialect: string
  defaultNamespace?: string
  ignoredFiles: string[]
  port?: number
  host?: string
  envFile: string[] // array of paths where we can look for the env file

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

export type ConfigInput = Omit<Config, 'dialect' | 'ignoredFiles' | 'envFile'> & {
  dialect?: Config['dialect'],
  ignoredFiles?: Config['ignoredFiles'],
  envFile?: string | string[],
  namespace?: string
}

export let config: Config = {dialect: 'duckdb', root: ''} as Config

export function setConfig(cfg: ConfigInput) {
  if (cfg.namespace && !cfg.defaultNamespace) cfg.defaultNamespace = cfg.namespace
  let dialect = cfg.dialect || 'duckdb'
  if (cfg.bigquery) dialect = 'bigquery'
  else if (cfg.snowflake) dialect = 'snowflake'
  else if (cfg.duckdb) dialect = 'duckdb'
  Object.keys(config).forEach((key) => delete config[key])
  Object.assign(config, cfg)
  config.dialect = dialect
  config.root ||= process.cwd()
  config.port ||= Number(process.env.GRAPHENE_PORT) || 4000
  config.ignoredFiles ||= ['agents.md', 'claude.md']
}

// Read graphene config out of package.json
export function loadConfig(dir:string, envLoader?: (envFiles: string[] | string) => void) {
  if (config.root) return

  let packageJsonObject = {} as any
  try {
    let txt = fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
    packageJsonObject = JSON.parse(txt).graphene || {}
  } catch {
    console.warn('No package.json found in current directory')
  }

  if (envLoader) envLoader(packageJsonObject.envFile || ['.env'])

  setConfig({...packageJsonObject, root: packageJsonObject.root || process.cwd()})
}
