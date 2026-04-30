/// <reference types="vitest/globals" />
import {expect} from 'vitest'

import {createPublishPackageJson} from './publishPackage.js'

describe('cli npm publish package', () => {
  let sourcePackage = {
    name: '@graphenedata/cli',
    version: '1.2.3',
    private: true,
    type: 'module',
    main: 'bin.js',
    scripts: {build: 'node ./esbuild.mjs'},
    dependencies: {
      '@graphenedata/lang': 'workspace:*',
      '@graphenedata/ui': 'workspace:*',
      chalk: '^5.3.0',
    },
    devDependencies: {
      esbuild: '^0.27.2',
    },
  }

  let workspacePackages = {
    '@graphenedata/lang': {
      dependencies: {
        '@lezer/common': '^1.2.3',
        glob: '^13.0.1',
      },
      devDependencies: {
        '@lezer/generator': '^1.8.0',
      },
    },
    '@graphenedata/ui': {
      dependencies: {
        '@graphenedata/html2canvas': '^1.4.1',
        echarts: '^6.0.0',
        svelte: '5.55.3',
      },
      devDependencies: {
        '@graphenedata/cli': 'workspace:*',
        '@graphenedata/lang': 'workspace:*',
        playwright: '1.58.2',
      },
    },
  }

  it('omits workspace dependencies from the staged manifest', () => {
    let staged = createPublishPackageJson(sourcePackage, workspacePackages)

    expect(staged.dependencies).not.toHaveProperty('@graphenedata/lang')
    expect(staged.dependencies).not.toHaveProperty('@graphenedata/ui')
  })

  it('merges lang and ui runtime dependencies into the staged cli dependencies', () => {
    let staged = createPublishPackageJson(sourcePackage, workspacePackages)

    expect(staged.dependencies).toMatchObject({
      '@graphenedata/html2canvas': '^1.4.1',
      '@lezer/common': '^1.2.3',
      chalk: '^5.3.0',
      echarts: '^6.0.0',
      glob: '^13.0.1',
      svelte: '5.55.3',
    })
  })

  it('does not merge dev-only dependencies', () => {
    let staged = createPublishPackageJson(sourcePackage, workspacePackages)

    expect(staged.dependencies).not.toHaveProperty('@lezer/generator')
    expect(staged.dependencies).not.toHaveProperty('esbuild')
    expect(staged.dependencies).not.toHaveProperty('playwright')
  })

  it('fails clearly on conflicting third-party dependency versions', () => {
    let conflictingWorkspacePackages = {
      ...workspacePackages,
      '@graphenedata/ui': {
        dependencies: {
          chalk: '^4.0.0',
        },
      },
    }

    expect(() => createPublishPackageJson(sourcePackage, conflictingWorkspacePackages)).toThrow(/Dependency version conflict for chalk/)
  })
})
