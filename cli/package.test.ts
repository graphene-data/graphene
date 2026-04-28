/// <reference types="vitest/globals" />
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import {expect} from 'vitest'

const dir = path.resolve(import.meta.url.replace('file://', ''), '../')

type PackageJson = {dependencies?: Record<string, string>}

async function readPackageJson(packageDir: string): Promise<PackageJson> {
  return JSON.parse(await fsp.readFile(path.join(dir, '..', packageDir, 'package.json'), 'utf8'))
}

function sortObject(obj: Record<string, string>) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)))
}

describe('cli package dependencies', () => {
  it('replicates lang and ui dependencies exactly', async () => {
    let [cliPackage, langPackage, uiPackage] = await Promise.all([readPackageJson('cli'), readPackageJson('lang'), readPackageJson('ui')])
    let replicatedDeps = {...langPackage.dependencies, ...uiPackage.dependencies}
    let cliDeps = Object.fromEntries(Object.keys(replicatedDeps).map(dep => [dep, cliPackage.dependencies?.[dep]]))

    expect(sortObject(cliDeps as any), 'cli/package.json dependencies must include every lang/ui dependency with the same version').toEqual(sortObject(replicatedDeps))
  })
})
