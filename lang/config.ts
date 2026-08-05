import {existsSync, statSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import path from 'path'

export interface Config {
  root: string
  pagesPrefix: string // path under which md files are. Either `` or `pages/`
  projectName: string
  dialect: string
  defaultNamespace?: string
  ignoredFiles: string[]
  telemetry?: boolean
  updateNotifier?: boolean
  port: number
  csp?: 'all' | false
  cloud?: string
  envFile: string[] // array of paths where we can look for the env file

  bigquery?: {
    projectId?: string
    keyPath?: string
  }

  snowflake?: {
    account: string
    username: string
    privateKeyPath?: string
    authenticator?: 'OAUTH_AUTHORIZATION_CODE' | 'EXTERNALBROWSER' | 'SNOWFLAKE_JWT'
    schema?: string
    database?: string
  }

  clickhouse?: {
    url?: string
    username?: string
    database?: string
    requestTimeout?: number
  }

  postgres?: {
    connectionString?: string
    host?: string
    port?: number
    database?: string
    user?: string
    username?: string
    schema?: string
    inMemory?: boolean
    seedSql?: string
    ssl?: boolean | {rejectUnauthorized?: boolean}
    max?: number
    idleTimeoutMillis?: number
    connectionTimeoutMillis?: number
    queryTimeout?: number
    statementTimeout?: number
  }

  athena?: {
    region?: string
    catalog?: string
    database?: string
    workGroup?: string
    outputLocation?: string
  }

  motherduck?: {
    database?: string
  }

  duckdb?: {
    path?: string
  }
}

export type ConfigInput = Omit<Config, 'root' | 'pagesPrefix' | 'projectName' | 'dialect' | 'ignoredFiles' | 'envFile' | 'port'> & {
  root?: string
  dialect?: Config['dialect']
  ignoredFiles?: Config['ignoredFiles']
  envFile?: string | string[]
  port?: number
  namespace?: string
}

export let config: Config = {dialect: 'duckdb', root: ''} as Config

export function setGlobalConfig(cfg: ConfigInput | Config, projectName?: string) {
  Object.keys(config).forEach(key => delete config[key])
  if ('projectName' in cfg) projectName ||= cfg.projectName
  let normalized = normalizeConfig(cfg, process.cwd(), projectName)
  if (!('pagesPrefix' in cfg)) normalized.pagesPrefix = pagesPrefixForRoot(normalized.root)
  Object.assign(config, normalized)
}

export function normalizeConfig(input: ConfigInput, defaultRoot = process.cwd(), projectName?: string, env: NodeJS.ProcessEnv = process.env): Config {
  let cfg = {...input}
  let root = path.resolve(cfg.root || defaultRoot)
  if (cfg.namespace && !cfg.defaultNamespace) cfg.defaultNamespace = cfg.namespace

  let dialect = cfg.dialect || 'duckdb'
  if (cfg.bigquery) dialect = 'bigquery'
  else if (cfg.snowflake) dialect = 'snowflake'
  else if (cfg.clickhouse) dialect = 'clickhouse'
  else if (cfg.postgres) dialect = 'postgres'
  else if (cfg.athena) dialect = 'athena'
  else if (cfg.motherduck) dialect = 'duckdb'
  else if (cfg.duckdb) dialect = 'duckdb'

  // Unlike connector-specific environment variables, this affects GSQL table resolution.
  cfg.defaultNamespace = env.GRAPHENE_DEFAULT_NAMESPACE || cfg.defaultNamespace

  let envFile = ['.env']
  if (Array.isArray(cfg.envFile)) envFile = cfg.envFile
  else if (cfg.envFile) envFile = [cfg.envFile]

  return {
    ...cfg,
    dialect,
    root,
    pagesPrefix: (input as Config).pagesPrefix || '',
    projectName: projectName || path.basename(root),
    port: cfg.port || Number(env.GRAPHENE_PORT) || 4000,
    csp: cfg.csp ?? 'all',
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
  let pkgJson = JSON.parse(txt)
  let graphene = pkgJson.graphene
  if (!graphene || typeof graphene != 'object' || Array.isArray(graphene)) {
    throw new Error(`No graphene config found in ${path.join(configDir, 'package.json')}`)
  }

  // config can provide 1 or more env files that Graphene should load. Default to just `.env`
  let envFiles = Array.isArray(graphene.envFile) ? graphene.envFile : [graphene.envFile || '.env']
  envLoader(envFiles.map(file => path.resolve(configDir, file)))

  let cfg = normalizeConfig({...graphene, root: configDir}, configDir, pkgJson.name)
  cfg.pagesPrefix = pagesPrefixForRoot(configDir)
  return cfg
}

// Local entry points detect the optional page root from the project filesystem.
function pagesPrefixForRoot(root: string) {
  let pagesDirectory = path.join(root, 'pages')
  return existsSync(pagesDirectory) && statSync(pagesDirectory).isDirectory() ? 'pages/' : ''
}
