import {mkdtemp, readFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {Writable} from 'node:stream'
import prompts from 'prompts'
import {describe, expect, it} from 'vitest'

import {runCreate} from './index.ts'

function streamSink() {
  let chunks: string[] = []
  return {
    chunks,
    stream: new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString())
        callback()
      },
    }),
  }
}

describe('interactive prompt flow', () => {
  it('uses prompt answers to scaffold the project', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-prompt-'))
    let stdout = streamSink()
    let stderr = streamSink()

    prompts.inject(['demo-app', 'demo-app', false])

    await runCreate({argv: [], cwd: root, stdin: process.stdin, stdout: stdout.stream, stderr: stderr.stream})

    expect(stdout.chunks.join('')).toContain('Created Graphene project')

    let pkg = JSON.parse(await readFile(path.join(root, 'demo-app', 'package.json'), 'utf8'))
    expect(pkg.name).toBe('demo-app')
  })
})
