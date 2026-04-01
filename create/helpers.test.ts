import {describe, expect, it} from 'vitest'

import {defaultProjectName, parseArgs, renderTemplate} from './index.ts'

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

  it('renders a minimal runnable starter', () => {
    let files = renderTemplate({projectName: 'demo-app', cliVersion: '0.0.15'})
    let pkg = JSON.parse(files['package.json'])

    expect(pkg.name).toBe('demo-app')
    expect(pkg.type).toBeUndefined()
    expect(pkg.engines).toBeUndefined()
    expect(pkg.dependencies['@graphenedata/cli']).toBe('0.0.15')
    expect(files['index.md']).toContain('# New Graphene Project')
    expect(files['tables/example.gsql']).toContain('table example')
  })
})
