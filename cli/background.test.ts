/// <reference types="vitest/globals" />
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import {expect} from 'vitest'

import {setGlobalConfig} from '../lang/config.ts'
import {runServeInBackground} from './background.ts'

describe('background server', () => {
  it('includes the server log when startup exits early', async () => {
    let tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-bg-fail-'))
    let entryPoint = path.join(tmpDir, 'fail-server.mjs')

    try {
      await fsp.mkdir(path.join(tmpDir, 'node_modules'))
      await fsp.writeFile(
        entryPoint,
        [
          "console.log('Starting Graphene server...')",
          "console.error('Failed to start Graphene server')",
          "console.error('listen EPERM: operation not permitted 127.0.0.1:4000')",
          'process.exit(1)',
        ].join('\n'),
      )
      setGlobalConfig({root: tmpDir, dialect: 'duckdb'})

      let error: unknown
      try {
        await runServeInBackground({entryPoint, log: () => undefined})
      } catch (err) {
        error = err
      }

      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toMatch(/listen EPERM: operation not permitted 127\.0\.0\.1:4000/)
      expect((error as Error).message).toMatch(/node_modules\/\.graphene\/serve\.log/)
    } finally {
      await fsp.rm(tmpDir, {recursive: true, force: true})
    }
  })
})
