import {EventEmitter} from 'node:events'
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {Writable} from 'node:stream'
import {afterEach, describe, expect, it, vi} from 'vitest'

let textMock = vi.fn()
let selectMock = vi.fn()
let confirmMock = vi.fn()
let pathMock = vi.fn()
let passwordMock = vi.fn()
let introMock = vi.fn()
let outroMock = vi.fn()
let cancelMock = vi.fn()
let isCancelMock = vi.fn((value: unknown) => value === Symbol.for('cancel'))
let taskLogState = {message: vi.fn(), success: vi.fn(), error: vi.fn()}
let taskLogMock = vi.fn(() => taskLogState)
let logErrorMock = vi.fn()
let spawnMock = vi.fn()

vi.mock('@clack/prompts', () => ({
  text: textMock,
  select: selectMock,
  confirm: confirmMock,
  path: pathMock,
  password: passwordMock,
  intro: introMock,
  outro: outroMock,
  cancel: cancelMock,
  isCancel: isCancelMock,
  taskLog: taskLogMock,
  log: {error: logErrorMock},
}))
vi.mock('node:child_process', () => ({spawn: spawnMock}))

afterEach(() => {
  textMock.mockReset()
  selectMock.mockReset()
  confirmMock.mockReset()
  pathMock.mockReset()
  passwordMock.mockReset()
  introMock.mockReset()
  outroMock.mockReset()
  cancelMock.mockReset()
  isCancelMock.mockClear()
  taskLogState = {message: vi.fn(), success: vi.fn(), error: vi.fn()}
  taskLogMock.mockImplementation(() => taskLogState)
  taskLogMock.mockClear()
  logErrorMock.mockReset()
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
  stdout: EventEmitter & {setEncoding: (encoding: BufferEncoding) => void}
  stderr: EventEmitter & {setEncoding: (encoding: BufferEncoding) => void}
}

function createChild({exitCode = 0, stdout = '', stderr = ''}: {exitCode?: number; stdout?: string; stderr?: string} = {}) {
  let child = new EventEmitter() as MockChild
  child.stdout = Object.assign(new EventEmitter(), {setEncoding() {}})
  child.stderr = Object.assign(new EventEmitter(), {setEncoding() {}})
  queueMicrotask(() => {
    if (stdout) child.stdout.emit('data', stdout)
    if (stderr) child.stderr.emit('data', stderr)
    child.emit('close', exitCode)
  })
  return child
}

describe('runCreate', () => {
  it('writes a snowflake project from interactive answers', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let keyPath = path.join(root, 'graphene_snowflake_key.p8')
    await writeFile(keyPath, 'private key')
    let {runCreate} = await import('./index.ts')
    let stdout = streamSink()
    let stderr = streamSink()

    textMock.mockResolvedValueOnce('my-analytics').mockResolvedValueOnce('MY_DB.ANALYTICS').mockResolvedValueOnce('myorg-myaccount').mockResolvedValueOnce('graphene_user')
    selectMock.mockResolvedValue('snowflake')
    pathMock.mockResolvedValue(keyPath)
    passwordMock.mockResolvedValue('secret')
    confirmMock.mockResolvedValue(false)

    await runCreate({argv: [], cwd: root, stdin: process.stdin, stdout: stdout.stream, stderr: stderr.stream})

    let pkg = JSON.parse(await readFile(path.join(root, 'my-analytics', 'package.json'), 'utf8'))
    expect(pkg.graphene).toEqual({
      dialect: 'snowflake',
      defaultNamespace: 'MY_DB.ANALYTICS',
      snowflake: {account: 'myorg-myaccount', username: 'graphene_user'},
    })
    expect(await readFile(path.join(root, 'my-analytics', '.env'), 'utf8')).toContain(`SNOWFLAKE_PRI_KEY_PATH=${keyPath}`)
    expect(outroMock).toHaveBeenCalledWith('Done!', {output: stdout.stream})
  })

  it('refuses to write into a non-empty directory', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let targetDir = path.join(root, 'demo-app')
    await mkdir(targetDir, {recursive: true})
    await writeFile(path.join(targetDir, 'occupied.txt'), 'occupied')
    let {runCreate} = await import('./index.ts')

    await expect(runCreate({argv: ['demo-app', '--yes'], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})).rejects.toThrow('Target directory is not empty')
  })

  it('streams install output into the task log and keeps line breaks on success', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./index.ts')
    let stdout = streamSink()
    let stderr = streamSink()

    spawnMock.mockImplementation(() => createChild({stdout: 'added 10 packages\nfunding info\n'}))

    await runCreate({argv: ['demo-app', '--yes', '--install'], cwd: root, stdin: process.stdin, stdout: stdout.stream, stderr: stderr.stream})

    expect(taskLogMock).toHaveBeenCalledWith({title: 'Installing dependencies...', retainLog: true})
    expect(taskLogState.message).toHaveBeenNthCalledWith(1, 'added 10 packages')
    expect(taskLogState.message).toHaveBeenNthCalledWith(2, 'funding info')
    expect(taskLogState.success).toHaveBeenCalledWith('Dependencies installed', {showLog: true})
  })

  it('marks install failures without clearing the log', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./index.ts')

    spawnMock.mockImplementation(() => createChild({exitCode: 1, stderr: 'npm ERR! failed\n'}))

    await expect(runCreate({argv: ['demo-app', '--yes', '--install'], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})).rejects.toThrow('npm ERR! failed')
    expect(taskLogState.error).toHaveBeenCalledWith('npm install failed', {showLog: true})
  })
})
