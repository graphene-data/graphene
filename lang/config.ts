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
  dialect?: Config['dialect']
  ignoredFiles?: Config['ignoredFiles']
  envFile?: string | string[]
  namespace?: string
}

export let config: Config = {dialect: 'duckdb', root: ''} as Config

export function setConfig(cfg: ConfigInput) {
  Object.keys(config).forEach(key => delete config[key])
  Object.assign(config, normalizeConfig(cfg))
}

export function normalizeConfig(input: ConfigInput, defaultRoot = process.cwd()): Config {
  let cfg = {...input}
  if (cfg.namespace && !cfg.defaultNamespace) cfg.defaultNamespace = cfg.namespace

  let dialect = cfg.dialect || 'duckdb'
  if (cfg.bigquery) dialect = 'bigquery'
  else if (cfg.snowflake) dialect = 'snowflake'
  else if (cfg.duckdb) dialect = 'duckdb'
  let envFile = ['.env']
  if (Array.isArray(cfg.envFile)) envFile = cfg.envFile
  else if (cfg.envFile) envFile = [cfg.envFile]

  return {
    ...cfg,
    dialect,
    root: cfg.root || defaultRoot,
    port: cfg.port || Number(process.env.GRAPHENE_PORT) || 4000,
    ignoredFiles: cfg.ignoredFiles || ['agents.md', 'claude.md'],
    envFile,
  } as Config
}

export function readConfigInput(dir: string): ConfigInput | null {
  try {
    let txt = fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
    let graphene = JSON.parse(txt).graphene
    if (!graphene || typeof graphene != 'object' || Array.isArray(graphene)) return null
    return graphene
  } catch {
    return null
  }
}

export function readConfig(dir: string, envLoader?: (envFiles: string[] | string) => void, defaultRoot = dir): Config {
  let packageJsonObject = readConfigInput(dir) || ({} as ConfigInput)
  if (envLoader) envLoader(packageJsonObject.envFile || ['.env'])
  return normalizeConfig({...packageJsonObject, root: packageJsonObject.root || defaultRoot}, defaultRoot)
}

// Read graphene config out of package.json
export function loadConfig(dir: string, envLoader?: (envFiles: string[] | string) => void) {
  if (config.root) return
  Object.keys(config).forEach(key => delete config[key])
  Object.assign(config, readConfig(dir, envLoader, process.cwd()))
}
