import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import path from 'path'

export interface Config {
  root: string
  dialect: string
  defaultNamespace?: string
  ignoredFiles: string[]
  telemetry?: boolean
  updateNotifier?: boolean
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

  clickhouse?: {
    url?: string
    username?: string
    database?: string
    requestTimeout?: number
  }

  duckdb?: {
    path?: string
  }
}

export type ConfigInput = Omit<Config, 'root' | 'dialect' | 'ignoredFiles' | 'envFile'> & {
  root?: string
  dialect?: Config['dialect']
  ignoredFiles?: Config['ignoredFiles']
  envFile?: string | string[]
  namespace?: string
}

export let config: Config = {dialect: 'duckdb', root: ''} as Config

export function setGlobalConfig(cfg: ConfigInput) {
  Object.keys(config).forEach(key => delete config[key])
  Object.assign(config, normalizeConfig(cfg))
}

export function normalizeConfig(input: ConfigInput, defaultRoot = process.cwd()): Config {
  let cfg = {...input}
  if (cfg.namespace && !cfg.defaultNamespace) cfg.defaultNamespace = cfg.namespace

  let dialect = cfg.dialect || 'duckdb'
  if (cfg.bigquery) dialect = 'bigquery'
  else if (cfg.snowflake) dialect = 'snowflake'
  else if (cfg.clickhouse) dialect = 'clickhouse'
  else if (cfg.duckdb) dialect = 'duckdb'
  let envFile = ['.env']
  if (Array.isArray(cfg.envFile)) envFile = cfg.envFile
  else if (cfg.envFile) envFile = [cfg.envFile]

  return {
    ...cfg,
    dialect,
    root: path.resolve(cfg.root || defaultRoot),
    port: cfg.port || Number(process.env.GRAPHENE_PORT) || 4000,
    ignoredFiles: cfg.ignoredFiles || [],
    envFile,
  } as Config
}

// Read graphene config from the nearest parent package.json.
export async function loadConfig(dir: string, envLoader: (envFiles: string[]) => void): Promise<Config> {
  // seek upwards from dir looking for package.json
  let configDir = path.resolve(dir)
  while (!existsSync(path.join(configDir, 'package.json'))) {
    let parent = path.dirname(configDir)
    if (parent == configDir) throw new Error(`No package.json found in ${path.resolve(dir)} or its parents`)
    configDir = parent
  }

  let txt = await readFile(path.join(configDir, 'package.json'), 'utf8')
  let graphene = JSON.parse(txt).graphene
  if (!graphene || typeof graphene != 'object' || Array.isArray(graphene)) {
    throw new Error(`No graphene config found in ${path.join(configDir, 'package.json')}`)
  }

  // config can provide 1 or more env files that Graphene should load. Default to just `.env`
  let envFiles = Array.isArray(graphene.envFile) ? graphene.envFile : [graphene.envFile || '.env']
  envLoader(envFiles.map(file => path.resolve(configDir, file)))

  let cfg = normalizeConfig({...graphene, root: configDir}, configDir)
  return cfg
}
