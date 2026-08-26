/// <reference types="vitest/globals" />
// Covers CLI requests with delegated tokens and renewable credentials saved by `graphene login`.

import {spawn} from 'child_process'
import fs from 'node:fs/promises'
import {createServer} from 'node:http'

import {config, normalizeConfig, setGlobalConfig} from '../lang/config.ts'
import {gFetch} from '../utils/index.ts'
import {authenticatedFetch, openInBrowser} from './auth.ts'

vi.mock('child_process', () => ({spawn: vi.fn()}))

// Windows OAuth URLs must bypass cmd.exe, which treats each `&`-delimited parameter as a separate command.
test('openInBrowser preserves the complete OAuth URL on Windows', () => {
  let url = 'https://app.graphenedata.com/authenticate?redirect_uri=http%3A%2F%2F127.0.0.1%3A5054%2Fcallback&client_id=connected-app-live&state=login-state'
  let unref = vi.fn()
  vi.mocked(spawn).mockReturnValue({unref} as any)
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')

  openInBrowser(url)

  expect(spawn).toHaveBeenCalledWith('rundll32', ['url.dll,FileProtocolHandler', url], {stdio: 'ignore'})
  expect(unref).toHaveBeenCalled()
  vi.restoreAllMocks()
})

test('gFetch decodes JSON and plain-text error responses', async () => {
  let server = createServer((req, res) => {
    res.statusCode = req.url == '/json' ? 400 : 502
    res.end(req.url == '/json' ? JSON.stringify({message: 'Invalid request', code: 'invalid_request'}) : 'Bad gateway')
  })

  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    let address = server.address()
    if (!address || typeof address == 'string') throw new Error('Failed to start auth test server')
    let origin = `http://127.0.0.1:${address.port}`

    await expect(gFetch(`${origin}/json`)).rejects.toMatchObject({message: 'Invalid request', status: 400, code: 'invalid_request'})
    await expect(gFetch(`${origin}/text`)).rejects.toMatchObject({message: 'Bad gateway', status: 502})
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

// A delegated token should work without a local login and be sent unchanged to Graphene Cloud.
test('authenticatedFetch uses GRAPHENE_TOKEN', async () => {
  let originalConfig = structuredClone(config)
  let originalToken = process.env.GRAPHENE_TOKEN
  let authorization = ''
  let server = createServer((req, res) => {
    authorization = req.headers.authorization || ''
    res.end('ok')
  })

  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    let address = server.address()
    if (!address || typeof address == 'string') throw new Error('Failed to start auth test server')
    setGlobalConfig(normalizeConfig({root: '/tmp/delegated-token-test', clickhouse: {}, cloud: `http://127.0.0.1:${address.port}`}))
    process.env.GRAPHENE_TOKEN = 'background-agent-token'

    let response = await authenticatedFetch('/query')

    expect(await response.text()).toBe('ok')
    expect(authorization).toBe('Bearer background-agent-token')
  } finally {
    await new Promise(resolve => server.close(resolve))
    setGlobalConfig(originalConfig)
    if (originalToken === undefined) delete process.env.GRAPHENE_TOKEN
    else process.env.GRAPHENE_TOKEN = originalToken
  }
})

// An expired Cloud session should tell the user how to authenticate again instead of exposing the token endpoint error.
test('authenticatedFetch explains how to recover when the Cloud session expires', async () => {
  let originalConfig = structuredClone(config)
  let originalToken = process.env.GRAPHENE_TOKEN
  let server = createServer((req, res) => {
    expect(req.url).toBe('/_api/oauth2/token')
    res.writeHead(400, {'content-type': 'application/json'})
    res.end(JSON.stringify({error: 'invalid_grant'}))
  })

  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    let address = server.address()
    if (!address || typeof address == 'string') throw new Error('Failed to start auth test server')

    let root = '/tmp/expired-cloud-session-test'
    setGlobalConfig(normalizeConfig({root, clickhouse: {}, cloud: `http://127.0.0.1:${address.port}`}))
    delete process.env.GRAPHENE_TOKEN
    vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
      [root]: {access_token: 'expired-access-token', refresh_token: 'expired-refresh-token', expires_at: 0},
    }))

    await expect(authenticatedFetch('/query')).rejects.toThrow('Your Graphene Cloud session has expired. Run `graphene login` and try again.')
  } finally {
    vi.restoreAllMocks()
    await new Promise(resolve => server.close(resolve))
    setGlobalConfig(originalConfig)
    if (originalToken === undefined) delete process.env.GRAPHENE_TOKEN
    else process.env.GRAPHENE_TOKEN = originalToken
  }
})
