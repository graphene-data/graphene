import {EventEmitter} from 'node:events'
import {lstat, mkdtemp, mkdir, readFile, readlink, writeFile} from 'node:fs/promises'
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
let snowflakeConfigureMock = vi.fn()
let snowflakeConnectMock = vi.fn((callback: (err?: Error) => void) => callback())
let snowflakeDestroyMock = vi.fn((callback: (err?: Error) => void) => callback())
let snowflakeCreateConnectionMock = vi.fn(() => ({connect: snowflakeConnectMock, destroy: snowflakeDestroyMock}))
let bigQueryCreateQueryJobMock = vi.fn().mockResolvedValue([])
let bigQueryMock = vi.fn(() => ({createQueryJob: bigQueryCreateQueryJobMock}))
let clickHouseJsonMock = vi.fn().mockResolvedValue([])
let clickHouseQueryMock = vi.fn().mockResolvedValue({json: clickHouseJsonMock})
let clickHouseCloseMock = vi.fn().mockResolvedValue(undefined)
let clickHouseCreateClientMock = vi.fn(() => ({query: clickHouseQueryMock, close: clickHouseCloseMock}))

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
vi.mock('snowflake-sdk', () => ({default: {configure: snowflakeConfigureMock, createConnection: snowflakeCreateConnectionMock}}))
vi.mock('@google-cloud/bigquery', () => ({BigQuery: bigQueryMock}))
vi.mock('@clickhouse/client', () => ({createClient: clickHouseCreateClientMock}))

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
  snowflakeConfigureMock.mockReset()
  snowflakeConnectMock.mockReset()
  snowflakeConnectMock.mockImplementation((callback: (err?: Error) => void) => callback())
  snowflakeDestroyMock.mockReset()
  snowflakeDestroyMock.mockImplementation((callback: (err?: Error) => void) => callback())
  snowflakeCreateConnectionMock.mockReset()
  snowflakeCreateConnectionMock.mockImplementation(() => ({connect: snowflakeConnectMock, destroy: snowflakeDestroyMock}))
  bigQueryCreateQueryJobMock.mockReset()
  bigQueryCreateQueryJobMock.mockResolvedValue([])
  bigQueryMock.mockReset()
  bigQueryMock.mockImplementation(() => ({createQueryJob: bigQueryCreateQueryJobMock}))
  clickHouseJsonMock.mockReset()
  clickHouseJsonMock.mockResolvedValue([])
  clickHouseQueryMock.mockReset()
  clickHouseQueryMock.mockResolvedValue({json: clickHouseJsonMock})
  clickHouseCloseMock.mockReset()
  clickHouseCloseMock.mockResolvedValue(undefined)
  clickHouseCreateClientMock.mockReset()
  clickHouseCreateClientMock.mockImplementation(() => ({query: clickHouseQueryMock, close: clickHouseCloseMock}))
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
    let {runCreate} = await import('./create.ts')
    let stdout = streamSink()
    let stderr = streamSink()

    textMock.mockResolvedValueOnce('my-analytics').mockResolvedValueOnce('myorg-myaccount').mockResolvedValueOnce('graphene_user')
    selectMock.mockResolvedValueOnce('snowflake').mockResolvedValueOnce('none')
    pathMock.mockResolvedValue(keyPath)
    passwordMock.mockResolvedValue('secret')
    spawnMock.mockImplementation(() => createChild())

    await runCreate({argv: [], cwd: root, stdin: process.stdin, stdout: stdout.stream, stderr: stderr.stream})

    let pkg = JSON.parse(await readFile(path.join(root, 'my-analytics', 'package.json'), 'utf8'))
    expect(pkg.graphene).toEqual({
      dialect: 'snowflake',
      snowflake: {account: 'myorg-myaccount', username: 'graphene_user'},
    })
    expect(textMock).not.toHaveBeenCalledWith(expect.objectContaining({message: 'Default namespace (optional)'}))
    expect(pkg.dependencies['snowflake-sdk']).toBeTruthy()
    expect(await readFile(path.join(root, 'my-analytics', '.env'), 'utf8')).toContain(`SNOWFLAKE_PRI_KEY_PATH=${keyPath}`)
    expect(snowflakeCreateConnectionMock).toHaveBeenCalledWith(expect.objectContaining({account: 'myorg-myaccount', username: 'graphene_user', privateKeyPath: keyPath}))
    expect(outroMock).toHaveBeenCalledWith('Done!', {output: stdout.stream})
  })

  it('re-prompts warehouse credentials when validation fails and the user edits them', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let badKeyPath = path.join(root, 'bad_key.p8')
    let goodKeyPath = path.join(root, 'good_key.p8')
    await writeFile(badKeyPath, 'bad private key')
    await writeFile(goodKeyPath, 'good private key')
    let {runCreate} = await import('./create.ts')

    textMock.mockResolvedValueOnce('my-analytics').mockResolvedValueOnce('bad-account').mockResolvedValueOnce('bad_user').mockResolvedValueOnce('good-account').mockResolvedValueOnce('good_user')
    selectMock.mockResolvedValueOnce('snowflake').mockResolvedValueOnce('edit').mockResolvedValueOnce('none')
    pathMock.mockResolvedValueOnce(badKeyPath).mockResolvedValueOnce(goodKeyPath)
    passwordMock.mockResolvedValueOnce('bad-secret').mockResolvedValueOnce('good-secret')
    snowflakeConnectMock.mockImplementationOnce((callback: (err?: Error) => void) => callback(new Error('Invalid key'))).mockImplementation((callback: (err?: Error) => void) => callback())
    spawnMock.mockImplementation(() => createChild())

    await runCreate({argv: [], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})

    let pkg = JSON.parse(await readFile(path.join(root, 'my-analytics', 'package.json'), 'utf8'))
    expect(pkg.graphene.snowflake).toEqual({account: 'good-account', username: 'good_user'})
    expect(await readFile(path.join(root, 'my-analytics', '.env'), 'utf8')).toContain(`SNOWFLAKE_PRI_KEY_PATH=${goodKeyPath}`)
    expect(logErrorMock).toHaveBeenCalledWith(expect.stringContaining('Invalid key'), expect.any(Object))
  })

  it('continues with warehouse credentials when validation fails and the user ignores it', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let keyPath = path.join(root, 'graphene_snowflake_key.p8')
    await writeFile(keyPath, 'private key')
    let {runCreate} = await import('./create.ts')

    textMock.mockResolvedValueOnce('my-analytics').mockResolvedValueOnce('myorg-myaccount').mockResolvedValueOnce('graphene_user')
    selectMock.mockResolvedValueOnce('snowflake').mockResolvedValueOnce('continue').mockResolvedValueOnce('none')
    pathMock.mockResolvedValue(keyPath)
    passwordMock.mockResolvedValue('secret')
    snowflakeConnectMock.mockImplementation((callback: (err?: Error) => void) => callback(new Error('JWT failed')))
    spawnMock.mockImplementation(() => createChild())

    await runCreate({argv: [], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})

    let pkg = JSON.parse(await readFile(path.join(root, 'my-analytics', 'package.json'), 'utf8'))
    expect(pkg.graphene.snowflake).toEqual({account: 'myorg-myaccount', username: 'graphene_user'})
    expect(logErrorMock).toHaveBeenCalledWith(expect.stringContaining('JWT failed'), expect.any(Object))
  })

  it('skips credential validation when requested', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let keyPath = path.join(root, 'graphene_snowflake_key.p8')
    await writeFile(keyPath, 'private key')
    let {runCreate} = await import('./create.ts')

    textMock.mockResolvedValueOnce('my-analytics').mockResolvedValueOnce('myorg-myaccount').mockResolvedValueOnce('graphene_user')
    selectMock.mockResolvedValueOnce('snowflake').mockResolvedValueOnce('none')
    pathMock.mockResolvedValue(keyPath)
    passwordMock.mockResolvedValue('secret')
    spawnMock.mockImplementation(() => createChild())

    await runCreate({argv: ['--skip-credential-validation'], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})

    expect(snowflakeCreateConnectionMock).not.toHaveBeenCalled()
    expect(await readFile(path.join(root, 'my-analytics', '.env'), 'utf8')).toContain(`SNOWFLAKE_PRI_KEY_PATH=${keyPath}`)
  })

  it('writes a clickhouse project from interactive answers', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./create.ts')

    textMock.mockResolvedValueOnce('clickhouse-app').mockResolvedValueOnce('https://example.clickhouse.cloud:8443').mockResolvedValueOnce('default')
    selectMock.mockResolvedValueOnce('clickhouse').mockResolvedValueOnce('none')
    passwordMock.mockResolvedValue('secret')
    spawnMock.mockImplementation(() => createChild())

    await runCreate({argv: [], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})

    let pkg = JSON.parse(await readFile(path.join(root, 'clickhouse-app', 'package.json'), 'utf8'))
    expect(pkg.graphene).toEqual({
      dialect: 'clickhouse',
      clickhouse: {url: 'https://example.clickhouse.cloud:8443', username: 'default'},
    })
    expect(pkg.dependencies['@clickhouse/client']).toBe('^1.18.2')
    expect(await readFile(path.join(root, 'clickhouse-app', '.env'), 'utf8')).toContain('CLICKHOUSE_PASSWORD=secret')
    expect(clickHouseCreateClientMock).toHaveBeenCalledWith(expect.objectContaining({database: 'default', password: 'secret'}))
  })

  it('refuses to write into a non-empty directory', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let targetDir = path.join(root, 'demo-app')
    await mkdir(targetDir, {recursive: true})
    await writeFile(path.join(targetDir, 'occupied.txt'), 'occupied')
    let {runCreate} = await import('./create.ts')

    await expect(runCreate({argv: ['demo-app', '--yes'], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})).rejects.toThrow('Target directory is not empty')
  })

  it('leaves duckdb config unset when the path prompt is blank', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./create.ts')

    textMock.mockResolvedValueOnce('demo-app').mockResolvedValueOnce('')
    selectMock.mockResolvedValueOnce('duckdb').mockResolvedValueOnce('none')
    spawnMock.mockImplementation(() => createChild())

    await runCreate({argv: [], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})

    let pkg = JSON.parse(await readFile(path.join(root, 'demo-app', 'package.json'), 'utf8'))
    expect(pkg.graphene).toEqual({dialect: 'duckdb'})
    expect(pkg.dependencies['@duckdb/node-api']).toBe('1.3.2-alpha.26')
    expect(await readFile(path.join(root, 'demo-app', 'AGENTS.md'), 'utf8')).toContain('npx graphene check')
  })

  it('streams install output into the task log and keeps line breaks on success', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./create.ts')
    let stdout = streamSink()
    let stderr = streamSink()

    spawnMock.mockImplementation(() => createChild({stdout: 'added 10 packages\nfunding info\n'}))

    await runCreate({argv: ['demo-app', '--yes'], cwd: root, stdin: process.stdin, stdout: stdout.stream, stderr: stderr.stream})

    expect(spawnMock).toHaveBeenCalledWith('npm', ['install', '--no-fund'], expect.objectContaining({cwd: path.join(root, 'demo-app')}))
    expect(taskLogMock).toHaveBeenCalledWith({title: 'Installing dependencies with npm...', retainLog: true})
    expect(taskLogState.message).toHaveBeenNthCalledWith(1, 'added 10 packages')
    expect(taskLogState.message).toHaveBeenNthCalledWith(2, 'funding info')
    expect(taskLogState.success).toHaveBeenCalledWith('Dependencies installed', {showLog: true})
  })

  it('uses the invoking package manager for install and generated metadata', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./create.ts')

    spawnMock.mockImplementation(() => createChild())

    await runCreate({
      argv: ['demo-app', '--yes'],
      cwd: root,
      env: {npm_config_user_agent: 'pnpm/10.1.0 npm/? node/v24.0.0 darwin arm64'},
      stdin: process.stdin,
      stdout: streamSink().stream,
      stderr: streamSink().stream,
    })

    let pkg = JSON.parse(await readFile(path.join(root, 'demo-app', 'package.json'), 'utf8'))
    expect(pkg.packageManager).toBe('pnpm@10.1.0')
    expect(spawnMock).toHaveBeenCalledWith('pnpm', ['install'], expect.objectContaining({cwd: path.join(root, 'demo-app')}))
    expect(taskLogMock).toHaveBeenCalledWith({title: 'Installing dependencies with pnpm...', retainLog: true})
  })

  it('skips skill linking by default in --yes mode', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./create.ts')

    spawnMock.mockImplementation(() => createChild())

    await runCreate({argv: ['demo-app', '--yes'], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})

    expect(spawnMock).toHaveBeenCalled()
    expect(await lstat(path.join(root, 'demo-app/.agents/skills/graphene')).catch(() => null)).toBeNull()
    expect(await lstat(path.join(root, 'demo-app/.claude/skills/graphene')).catch(() => null)).toBeNull()
  })

  it('does not prompt before installing dependencies', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./create.ts')

    textMock.mockResolvedValueOnce('demo-app').mockResolvedValueOnce('')
    selectMock.mockResolvedValueOnce('duckdb').mockResolvedValueOnce('none')
    spawnMock.mockImplementation(() => createChild())

    await runCreate({
      argv: [],
      cwd: root,
      env: {npm_config_user_agent: 'yarn/4.12.0 npm/? node/v24.0.0 darwin arm64'},
      stdin: process.stdin,
      stdout: streamSink().stream,
      stderr: streamSink().stream,
    })

    expect(confirmMock).not.toHaveBeenCalled()
    expect(spawnMock).toHaveBeenCalledWith('yarn', ['install'], expect.any(Object))
  })

  it('symlinks the Graphene skill into the selected agent folder', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./create.ts')

    textMock.mockResolvedValueOnce('demo-app').mockResolvedValueOnce('')
    selectMock.mockResolvedValueOnce('duckdb').mockResolvedValueOnce('.agents')
    spawnMock.mockImplementation(() => createChild())

    await runCreate({argv: [], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})

    let linkTarget = await readlink(path.join(root, 'demo-app/.agents/skills/graphene'))
    expect(linkTarget).toBe('../../node_modules/@graphenedata/cli/dist/skills/graphene')
  })

  it('symlinks the Graphene skill into the selected Claude folder', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./create.ts')

    textMock.mockResolvedValueOnce('demo-app').mockResolvedValueOnce('')
    selectMock.mockResolvedValueOnce('duckdb').mockResolvedValueOnce('.claude')
    spawnMock.mockImplementation(() => createChild())

    await runCreate({argv: [], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})

    let linkTarget = await readlink(path.join(root, 'demo-app/.claude/skills/graphene'))
    expect(linkTarget).toBe('../../node_modules/@graphenedata/cli/dist/skills/graphene')
    expect(await readFile(path.join(root, 'demo-app/CLAUDE.md'), 'utf8')).toContain('npx graphene check')
    expect(await lstat(path.join(root, 'demo-app/AGENTS.md')).catch(() => null)).toBeNull()
  })

  it('skips dependency installation with --no-install', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./create.ts')

    await runCreate({argv: ['demo-app', '--yes', '--no-install'], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})

    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('marks install failures without clearing the log', async () => {
    let root = await mkdtemp(path.join(os.tmpdir(), 'graphene-create-'))
    let {runCreate} = await import('./create.ts')

    spawnMock.mockImplementation(() => createChild({exitCode: 1, stderr: 'npm ERR! failed\n'}))

    await expect(runCreate({argv: ['demo-app', '--yes'], cwd: root, stdin: process.stdin, stdout: streamSink().stream, stderr: streamSink().stream})).rejects.toThrow('npm ERR! failed')
    expect(taskLogState.error).toHaveBeenCalledWith('npm install failed', {showLog: true})
  })
})
