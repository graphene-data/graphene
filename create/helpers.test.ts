import {describe, expect, it} from 'vitest'

import {defaultProjectName, detectPackageManager, parseArgs, renderTemplate} from './create.ts'

describe('create helpers', () => {
  it('parses the supported CLI arguments', () => {
    expect(parseArgs(['demo', '--yes', '--name', 'demo-app', '--no-install'])).toEqual({
      help: false,
      install: false,
      name: 'demo-app',
      skipCredentialValidation: false,
      targetDir: 'demo',
      yes: true,
    })
    expect(parseArgs(['demo', '--skip-credential-validation'])).toEqual({
      help: false,
      install: true,
      name: undefined,
      skipCredentialValidation: true,
      targetDir: 'demo',
      yes: false,
    })
  })

  it('errors when --name is missing a value', () => {
    expect(() => parseArgs(['--name'])).toThrow('--name requires a value')
  })

  it('normalizes project names for package.json', () => {
    expect(defaultProjectName('My Great App')).toBe('my-great-app')
    expect(defaultProjectName('___')).toBe('___')
  })

  it('detects the invoking package manager from npm-compatible env vars', () => {
    expect(detectPackageManager({npm_config_user_agent: 'pnpm/10.1.0 npm/? node/v24.0.0 darwin arm64'})).toEqual({name: 'pnpm', version: '10.1.0'})
    expect(detectPackageManager({npm_config_user_agent: 'yarn/4.12.0 npm/? node/v24.0.0 darwin arm64'})).toEqual({name: 'yarn', version: '4.12.0'})
    expect(detectPackageManager({npm_execpath: '/usr/local/lib/node_modules/bun/bin/bun'})).toEqual({name: 'bun'})
    expect(detectPackageManager({})).toEqual({name: 'npm'})
  })

  it('renders a duckdb project with a configured path and starter page', () => {
    let files = renderTemplate({
      cliVersion: '0.0.15',
      answers: {
        targetDir: 'demo-app',
        projectName: 'demo-app',
        packageManager: {name: 'pnpm', version: '10.1.0'},
        database: 'duckdb',
        duckdbPath: './data.duckdb',
        skillLinkTarget: 'none',
      },
    })
    let pkg = JSON.parse(files['package.json'])

    expect(pkg.name).toBe('demo-app')
    expect(pkg.packageManager).toBe('pnpm@10.1.0')
    expect(pkg.dependencies['@graphenedata/cli']).toBe('0.0.15')
    expect(pkg.dependencies['@duckdb/node-api']).toBe('1.3.2-alpha.26')
    expect(pkg.graphene).toEqual({dialect: 'duckdb', duckdb: {path: './data.duckdb'}})
    expect(files['AGENTS.md']).toContain('pnpm graphene check')
    expect(files['AGENTS.md']).toContain('pnpm graphene run index.md')
    expect(files['AGENTS.md']).toContain('pnpm graphene serve --bg')
    expect(files['AGENTS.md']).toContain('Assume all DuckDB functions are available when writing GSQL.')
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
        skillLinkTarget: 'none',
      },
    })
    let pkg = JSON.parse(files['package.json'])

    expect(pkg.graphene).toEqual({dialect: 'duckdb'})
    expect(pkg.dependencies['@duckdb/node-api']).toBe('1.3.2-alpha.26')
    expect(files['AGENTS.md']).toContain('npx graphene check')
  })

  it('renders AGENTS.md commands for yarn and bun projects', () => {
    let yarnFiles = renderTemplate({
      cliVersion: '0.0.15',
      answers: {targetDir: 'demo-app', projectName: 'demo-app', packageManager: {name: 'yarn', version: '4.12.0'}, database: 'duckdb', skillLinkTarget: 'none'},
    })
    let bunFiles = renderTemplate({
      cliVersion: '0.0.15',
      answers: {targetDir: 'demo-app', projectName: 'demo-app', packageManager: {name: 'bun', version: '1.3.0'}, database: 'duckdb', skillLinkTarget: 'none'},
    })

    expect(yarnFiles['AGENTS.md']).toContain('yarn graphene check')
    expect(yarnFiles['.yarnrc.yml']).toContain('nodeLinker: node-modules')
    expect(bunFiles['AGENTS.md']).toContain('bun run graphene check')
    expect(bunFiles['.yarnrc.yml']).toBeUndefined()
  })

  it('renders CLAUDE.md when the Claude skill target is selected', () => {
    let files = renderTemplate({
      cliVersion: '0.0.15',
      answers: {targetDir: 'demo-app', projectName: 'demo-app', packageManager: {name: 'pnpm', version: '10.1.0'}, database: 'duckdb', skillLinkTarget: '.claude'},
    })

    expect(files['CLAUDE.md']).toContain('pnpm graphene check')
    expect(files['CLAUDE.md']).toContain('Assume all DuckDB functions are available when writing GSQL.')
    expect(files['AGENTS.md']).toBeUndefined()
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
        skillLinkTarget: 'none',
      },
    })
    let pkg = JSON.parse(files['package.json'])

    expect(pkg.graphene).toEqual({
      dialect: 'snowflake',
      defaultNamespace: 'MY_DB.ANALYTICS',
      snowflake: {account: 'myorg-myaccount', username: 'graphene_user'},
    })
    expect(files['AGENTS.md']).toContain('Assume all Snowflake functions are available when writing GSQL.')
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
        skillLinkTarget: 'none',
      },
    })
    let pkg = JSON.parse(files['package.json'])

    expect(pkg.graphene).toEqual({
      dialect: 'bigquery',
      defaultNamespace: 'my-project.analytics',
      bigquery: {projectId: 'my-project-123'},
    })
    expect(files['AGENTS.md']).toContain('Assume all BigQuery functions are available when writing GSQL.')
    expect(pkg.dependencies['@google-cloud/bigquery']).toBe('^8.2.0')
    expect(files['.env']).toContain('GOOGLE_APPLICATION_CREDENTIALS=/Users/me/.ssh/graphene-bq-key.json')
  })

  it('renders a clickhouse project with a password env file', () => {
    let files = renderTemplate({
      cliVersion: '0.0.15',
      answers: {
        targetDir: 'clickhouse-app',
        projectName: 'clickhouse-app',
        database: 'clickhouse',
        defaultNamespace: 'default',
        clickhouseUrl: 'https://example.clickhouse.cloud:8443',
        clickhouseUsername: 'default',
        clickhousePassword: 'secret',
        skillLinkTarget: 'none',
      },
    })
    let pkg = JSON.parse(files['package.json'])

    expect(pkg.graphene).toEqual({
      dialect: 'clickhouse',
      defaultNamespace: 'default',
      clickhouse: {url: 'https://example.clickhouse.cloud:8443', username: 'default'},
    })
    expect(files['AGENTS.md']).toContain('Assume all ClickHouse functions are available when writing GSQL.')
    expect(pkg.dependencies['@clickhouse/client']).toBe('^1.18.2')
    expect(files['.env']).toContain('CLICKHOUSE_PASSWORD=secret')
    expect(files['index.md']).toContain('configured for ClickHouse')
  })
})
