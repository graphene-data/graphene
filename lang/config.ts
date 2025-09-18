import * as fs from 'fs'
import path from 'path'
import dotenv from '@dotenvx/dotenvx'
import {fileURLToPath} from 'url'

dotenv.config({
  path: path.join(fileURLToPath(import.meta.url), '../../.env'),
  ignore: ['MISSING_ENV_FILE'],
  logLevel: 'error',
})

export let config: Config = {dialect: 'duckdb'} as Config

export interface Config {
  dialect: string
  namespace?: string
  port?: number
  googleProjectId?: string
}

// Used by tests
export function setConfig (cfg: Config) {
  Object.keys(config).forEach((key) => delete config[key])
  Object.assign(config, cfg)
}

// Read graphene config out of package.json
export function loadConfig (dir:string) {
  let packageJsonObject = {} as any
  try {
    let packageJsonContent = fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
    packageJsonObject = JSON.parse(packageJsonContent)
  } catch {
    console.warn('No package.json found in current directory')
  }

  setConfig({
    ...packageJsonObject,
    dialect: packageJsonObject.dialect || 'duckdb',
    port: process.env.GRAPHENE_PORT || packageJsonObject.port || 4000,
  })
}

const kwMap = {
  bigquery: new Set(['DAY', 'HOUR', 'MINUTE', 'SECOND', 'YEAR', 'MONTH', 'WEEK', 'DAY_OF_WEEK', 'DAY_OF_YEAR', 'QUARTER']),
  empty: new Set(),
}
export function dialectKeyword (str: string) {
  return (kwMap[config.dialect] || kwMap.empty).has(str.toUpperCase())
}
