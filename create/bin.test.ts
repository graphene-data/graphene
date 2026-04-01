import {spawn} from 'node:child_process'
import {mkdtemp, readFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, it} from 'vitest'

const binPath = fileURLToPath(new URL('./bin.js', import.meta.url))

function runBin(cwd: string, args: string[]) {
  return new Promise<{code: number; stdout: string; stderr: string}>((resolve, reject) => {
    let child = spawn('node', [binPath, ...args], {cwd, env: process.env})
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', data => {
      stdout += data.toString()
    })
    child.stderr.on('data', data => {
      stderr += data.toString()
    })
    child.on('error', reject)
    child.on('close', code => resolve({code: code ?? 0, stdout, stderr}))
  })
}

describe('create bin', () => {
  it('runs the executable entrypoint', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-bin-'))
    let result = await runBin(root, ['demo-app', '--yes', '--no-install'])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Done!')

    let pkg = JSON.parse(await readFile(path.join(root, 'demo-app', 'package.json'), 'utf8'))
    expect(pkg.name).toBe('demo-app')
    expect(pkg.graphene).toEqual({dialect: 'duckdb', duckdb: {path: './data.duckdb'}})
  })
})
