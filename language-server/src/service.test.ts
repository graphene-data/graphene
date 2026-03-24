import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {expect} from 'vitest'
/// <reference types="vitest/globals" />
import {URI} from 'vscode-uri'

import {discoverGrapheneProjects, findOwningProject} from './service.ts'

describe('graphene language service', () => {
  it('discovers graphene projects from package.json and skips node_modules', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-language-server-'))

    try {
      await writeFile(path.join(root, 'package.json'), JSON.stringify({name: 'workspace-root'}))
      await mkdir(path.join(root, 'examples', 'flights'), {recursive: true})
      await writeFile(path.join(root, 'examples', 'flights', 'package.json'), JSON.stringify({graphene: {duckdb: {}}}))
      await mkdir(path.join(root, 'node_modules', 'ignored'), {recursive: true})
      await writeFile(path.join(root, 'node_modules', 'ignored', 'package.json'), JSON.stringify({graphene: {duckdb: {}}}))

      let projects = await discoverGrapheneProjects([URI.file(root)])
      expect(projects.map(project => project.root)).toEqual([path.join(root, 'examples', 'flights')])
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })

  it('prefers the nearest discovered project for nested files', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-language-server-nested-'))
    let parent = path.join(root, 'examples')
    let nested = path.join(parent, 'flights')

    try {
      await mkdir(nested, {recursive: true})
      await writeFile(path.join(parent, 'package.json'), JSON.stringify({graphene: {duckdb: {}}}))
      await writeFile(path.join(nested, 'package.json'), JSON.stringify({graphene: {duckdb: {}}}))

      let projects = await discoverGrapheneProjects([URI.file(root)])
      expect(projects.map(project => project.root)).toEqual([nested, parent])
      expect(findOwningProject(projects, path.join(nested, 'models.gsql'))?.root).toBe(nested)
      expect(findOwningProject(projects, path.join(parent, 'shared.gsql'))?.root).toBe(parent)
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })
})
