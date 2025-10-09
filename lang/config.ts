import * as fs from 'fs'
import path from 'path'

export let config: Config = {dialect: 'duckdb'} as Config

export interface Config {
  dialect: string
  namespace?: string
  port?: number
  googleProjectId?: string
  root: string
}

// Used by tests
export function setConfig (cfg: Config) {
  Object.keys(config).forEach((key) => delete config[key])
  Object.assign(config, cfg)
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

  setConfig({
    ...packageJsonObject,
    dialect: packageJsonObject.dialect || 'duckdb',
    port: process.env.GRAPHENE_PORT || packageJsonObject.port || 4000,
    root: packageJsonObject.root || process.cwd(),
  })
}
