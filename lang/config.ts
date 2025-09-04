import * as fs from 'fs'
import path from 'path'

export let config: Config = {dialect: 'duckdb'} as Config

export interface Config {
  dialect: string
  namespace?: string
  port?: number
}

// Used by tests
export function setConfig (cfg: Config) {
  Object.keys(config).forEach((key) => delete config[key])
  Object.assign(config, cfg)
}

// Read graphene config out of package.json
export async function loadConfig (dir:string): Promise<Config> {
  let packageJsonObject = {} as any
  try {
    let packageJsonContent = await fs.promises.readFile(path.join(dir, 'package.json'), 'utf8')
    packageJsonObject = JSON.parse(packageJsonContent)
  } catch {
    console.warn('No package.json found in current directory')
  }

  Object.assign(config, packageJsonObject.graphene || {dialect: 'duckdb'})
  config.dialect = config.dialect || 'duckdb'
  return config
}

const kwMap = {
  bigquery: new Set(['DAY', 'HOUR', 'MINUTE', 'SECOND', 'YEAR', 'MONTH', 'WEEK', 'DAY_OF_WEEK', 'DAY_OF_YEAR', 'QUARTER']),
  empty: new Set(),
}
export function dialectKeyword (str: string) {
  return (kwMap[config.dialect] || kwMap.empty).has(str.toUpperCase())
}
