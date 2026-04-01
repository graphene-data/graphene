import {EventEmitter} from 'node:events'
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {Writable} from 'node:stream'
import {afterEach, describe, expect, it, vi} from 'vitest'

const promptsMock = vi.fn()
const spawnMock = vi.fn()

vi.mock('prompts', () => ({default: promptsMock}))
vi.mock('node:child_process', () => ({spawn: spawnMock}))

afterEach(() => {
  promptsMock.mockReset()
  spawnMock.mockReset()
  vi.resetModules()
})

function streamSink() {
  let chunks: string[] = []
  let stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString())
      callback()
    },
  })
  return {stream, chunks}
}

interface MockChild extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
}

function createChild(exitCode = 0) {
  let child = new EventEmitter() as MockChild
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  queueMicrotask(() => child.emit('close', exitCode))
  return child
}

describe('runCreate', () => {
  it('writes the starter files from prompted answers', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./index.ts')
    let stdout = streamSink()
    let stderr = streamSink()

    promptsMock.mockResolvedValue({targetDir: 'demo-app', projectName: 'demo-app', install: false})

    await runCreate({argv: [], cwd: root, stdin: process.stdin, stdout: stdout.stream, stderr: stderr.stream})

    let pkg = JSON.parse(await readFile(path.join(root, 'demo-app', 'package.json'), 'utf8'))
    expect(pkg.name).toBe('demo-app')
    expect(await readFile(path.join(root, 'demo-app', 'index.md'), 'utf8')).toContain('New Graphene Project')
    expect(stdout.chunks.join('')).toContain('Skipped npm install')
  })

  it('refuses to write into a non-empty directory', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let targetDir = path.join(root, 'demo-app')
    await mkdir(targetDir, {recursive: true})
    await writeFile(path.join(targetDir, 'occupied.txt'), 'occupied')
    let {runCreate} = await import('./index.ts')

    await expect(runCreate({argv: ['demo-app', '--yes'], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})).rejects.toThrow('Target directory is not empty')
  })

  it('runs npm install when requested', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./index.ts')
    let stdout = streamSink()
    let stderr = streamSink()

    spawnMock.mockImplementation(() => createChild())

    await runCreate({argv: ['demo-app', '--yes', '--install'], cwd: root, stdin: process.stdin, stdout: stdout.stream, stderr: stderr.stream})

    expect(spawnMock).toHaveBeenCalledWith('npm', ['install'], {cwd: path.join(root, 'demo-app'), stdio: ['ignore', 'pipe', 'pipe']})
    expect(stdout.chunks.join('')).toContain('Installed dependencies')
  })
})
