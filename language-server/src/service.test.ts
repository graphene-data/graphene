/// <reference types="vitest/globals" />
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {expect, vi} from 'vitest'
import {URI} from 'vscode-uri'

import {createGrapheneService, discoverGrapheneProjects, findOwningProjectRoot} from './service.ts'

describe('Graphene project discovery', () => {
  it('finds package.json files with a top-level graphene config and ignores other packages', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-lsp-'))

    try {
      await mkdir(path.join(root, 'app'), {recursive: true})
      await mkdir(path.join(root, 'nested', 'child'), {recursive: true})
      await mkdir(path.join(root, 'scripts-only'), {recursive: true})
      await mkdir(path.join(root, 'node_modules', 'dep'), {recursive: true})
      await mkdir(path.join(root, '.cache', 'hidden'), {recursive: true})

      await writeFile(
        path.join(root, 'app', 'package.json'),
        JSON.stringify({
          name: 'app',
          graphene: {defaultNamespace: 'analytics'},
        }),
      )

      await writeFile(
        path.join(root, 'nested', 'child', 'package.json'),
        JSON.stringify({
          name: 'child',
          graphene: {snowflake: {account: 'acct', username: 'user', privateKeyPath: './snowflake.pem'}},
        }),
      )

      await writeFile(
        path.join(root, 'scripts-only', 'package.json'),
        JSON.stringify({
          name: 'scripts-only',
          scripts: {graphene: 'node cli.js'},
        }),
      )

      await writeFile(
        path.join(root, 'node_modules', 'dep', 'package.json'),
        JSON.stringify({
          name: 'dep',
          graphene: {defaultNamespace: 'ignored'},
        }),
      )

      await writeFile(
        path.join(root, '.cache', 'hidden', 'package.json'),
        JSON.stringify({
          name: 'hidden',
          graphene: {defaultNamespace: 'ignored'},
        }),
      )

      let projects = await discoverGrapheneProjects([URI.file(root)])

      expect(projects.map(project => project.root)).toEqual([path.join(root, 'app'), path.join(root, 'nested', 'child')])
      expect(projects[0].config.root).toBe(path.join(root, 'app'))
      expect(projects[0].config.defaultNamespace).toBe('analytics')
      expect(projects[0].config.dialect).toBe('duckdb')
      expect(projects[1].config.root).toBe(path.join(root, 'nested', 'child'))
      expect(projects[1].config.dialect).toBe('snowflake')
    } finally {
      await rm(root, {recursive: true, force: true})
    }
  })
})

describe('project ownership', () => {
  it('uses the nearest ancestor project root for nested projects', () => {
    let root = '/repo'
    let appRoot = path.join(root, 'app')
    let nestedRoot = path.join(appRoot, 'packages', 'subproject')

    expect(findOwningProjectRoot(path.join(nestedRoot, 'report.md'), [appRoot, nestedRoot])).toBe(nestedRoot)
    expect(findOwningProjectRoot(path.join(appRoot, 'tables', 'users.gsql'), [appRoot, nestedRoot])).toBe(appRoot)
    expect(findOwningProjectRoot(path.join(root, 'notes.md'), [appRoot, nestedRoot])).toBeNull()
  })
})

describe('workspace file watching', () => {
  it('registers md and gsql file watchers when the service plugin is created', async () => {
    let disposeFileWatcher = vi.fn()
    let disposeWatchedFiles = vi.fn()
    let disposeContent = vi.fn()
    let server = {
      fileWatcher: {
        watchFiles: vi.fn(() => Promise.resolve({dispose: disposeFileWatcher})),
        onDidChangeWatchedFiles: vi.fn(() => ({dispose: disposeWatchedFiles})),
      },
      documents: {
        onDidChangeContent: vi.fn(() => ({dispose: disposeContent})),
        get: vi.fn(),
      },
      languageFeatures: {
        requestRefresh: vi.fn(),
      },
    }

    let instance = createGrapheneService(server as any).create({env: {workspaceFolders: []}} as any)
    await Promise.resolve()

    expect(server.fileWatcher.watchFiles).toHaveBeenCalledWith(['**/*.{md,gsql}'])
    expect(server.fileWatcher.onDidChangeWatchedFiles).toHaveBeenCalled()

    instance.dispose?.()
    expect(disposeFileWatcher).toHaveBeenCalled()
    expect(disposeWatchedFiles).toHaveBeenCalled()
    expect(disposeContent).toHaveBeenCalled()
  })
})
