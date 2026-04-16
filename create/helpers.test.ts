import {describe, expect, it} from 'vitest'

import {defaultProjectName, parseArgs, renderTemplate} from './create.ts'

describe('create helpers', () => {
  it('parses the supported CLI arguments', () => {
    expect(parseArgs(['demo', '--yes', '--name', 'demo-app', '--install'])).toEqual({
      help: false,
      install: true,
      name: 'demo-app',
      targetDir: 'demo',
      yes: true,
    })
  })

  it('errors when --name is missing a value', () => {
    expect(() => parseArgs(['--name'])).toThrow('--name requires a value')
  })

  it('normalizes project names for package.json', () => {
    expect(defaultProjectName('My Great App')).toBe('my-great-app')
    expect(defaultProjectName('___')).toBe('___')
  })

  it('renders a duckdb project with a configured path and starter page', () => {
    let files = renderTemplate({
      cliVersion: '0.0.15',
      answers: {
        targetDir: 'demo-app',
        projectName: 'demo-app',
        database: 'duckdb',
        duckdbPath: './data.duckdb',
        install: false,
      },
    })
    let pkg = JSON.parse(files['package.json'])

    expect(pkg.name).toBe('demo-app')
    expect(pkg.dependencies['@graphenedata/cli']).toBe('0.0.15')
    expect(pkg.dependencies['@duckdb/node-api']).toBe('1.3.2-alpha.26')
    expect(pkg.graphene).toEqual({dialect: 'duckdb', duckdb: {path: './data.duckdb'}})
    expect(files['.gitignore']).toContain('*.duckdb')
    expect(files['.env']).toBeUndefined()
    expect(files['index.md']).toContain('configured for DuckDB')
  })

  it('omits duckdb config when no path is provided', () => {
    let files = renderTemplate({
      cliVersion: '0.0.15',
      answers: {
        targetDir: 'demo-app',
        projectName: 'demo-app',
        database: 'duckdb',
        install: false,
      },
    })
    let pkg = JSON.parse(files['package.json'])

    expect(pkg.graphene).toEqual({dialect: 'duckdb'})
    expect(pkg.dependencies['@duckdb/node-api']).toBe('1.3.2-alpha.26')
  })

  it('renders a snowflake project with .env auth vars', () => {
    let files = renderTemplate({
      cliVersion: '0.0.15',
      answers: {
        targetDir: 'my-analytics',
        projectName: 'my-analytics',
        database: 'snowflake',
        defaultNamespace: 'MY_DB.ANALYTICS',
        snowflakeAccount: 'myorg-myaccount',
        snowflakeUsername: 'graphene_user',
        snowflakeKeyPath: '/Users/me/.ssh/graphene_snowflake_key.p8',
        snowflakePassphrase: 'secret',
        install: true,
      },
    })
    let pkg = JSON.parse(files['package.json'])

    expect(pkg.graphene).toEqual({
      dialect: 'snowflake',
      defaultNamespace: 'MY_DB.ANALYTICS',
      snowflake: {account: 'myorg-myaccount', username: 'graphene_user'},
    })
    expect(pkg.dependencies['snowflake-sdk']).toBeTruthy()
    expect(files['.env']).toContain('SNOWFLAKE_PRI_KEY_PATH=/Users/me/.ssh/graphene_snowflake_key.p8')
    expect(files['.env']).toContain('SNOWFLAKE_PRI_PASSPHRASE=secret')
  })

  it('renders a bigquery project with a credential env file', () => {
    let files = renderTemplate({
      cliVersion: '0.0.15',
      answers: {
        targetDir: 'my-analytics',
        projectName: 'my-analytics',
        database: 'bigquery',
        defaultNamespace: 'my-project.analytics',
        bigqueryProjectId: 'my-project-123',
        bigqueryKeyPath: '/Users/me/.ssh/graphene-bq-key.json',
        install: true,
      },
    })
    let pkg = JSON.parse(files['package.json'])

    expect(pkg.graphene).toEqual({
      dialect: 'bigquery',
      defaultNamespace: 'my-project.analytics',
      bigquery: {projectId: 'my-project-123'},
    })
    expect(pkg.dependencies['@google-cloud/bigquery']).toBe('^8.2.0')
    expect(files['.env']).toContain('GOOGLE_APPLICATION_CREDENTIALS=/Users/me/.ssh/graphene-bq-key.json')
  })
})
