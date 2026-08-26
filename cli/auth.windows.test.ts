/// <reference types="vitest/globals" />
// Exercises the complete CLI browser login through Windows' real URL handler and a local OAuth stand-in.

import {createServer} from 'node:http'

import {config, normalizeConfig, setGlobalConfig} from '../lang/config.ts'
import {authClientId, loginPkce} from './auth.ts'

const windowsCi = process.platform == 'win32' && !!process.env.CI

// Verify Windows passes every OAuth parameter through the browser, loopback callback, and token exchange unchanged.
test.runIf(windowsCi)('completes browser login through the Windows URL handler', async () => {
  let originalConfig = structuredClone(config)
  let authorizeRequest = Promise.withResolvers<URL>()
  let tokenRequest = Promise.withResolvers<Record<string, string>>()
  let server = createServer(async (req, res) => {
    let requestUrl = new URL(req.url || '/', 'http://127.0.0.1')

    if (req.method == 'GET' && requestUrl.pathname == '/authenticate') {
      authorizeRequest.resolve(requestUrl)
      let callback = new URL(requestUrl.searchParams.get('redirect_uri')!)
      callback.searchParams.set('code', 'windows-login-code')
      callback.searchParams.set('state', requestUrl.searchParams.get('state')!)
      res.writeHead(302, {location: callback.toString()})
      res.end()
      return
    }

    if (req.method == 'POST' && requestUrl.pathname == '/_api/oauth2/token') {
      let chunks: Buffer[] = []
      for await (let chunk of req) chunks.push(chunk)
      tokenRequest.resolve(JSON.parse(Buffer.concat(chunks).toString()))
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({access_token: 'windows-access-token', refresh_token: 'windows-refresh-token', token_type: 'Bearer', expires_in: 3600}))
      return
    }

    res.statusCode = 404
    res.end('Not found')
  })

  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    let address = server.address()
    if (!address || typeof address == 'string') throw new Error('Failed to start Windows auth test server')
    setGlobalConfig(normalizeConfig({root: 'windows-login-test', clickhouse: {}, cloud: `http://127.0.0.1:${address.port}`}))

    await loginPkce()

    let authorizeUrl = await authorizeRequest.promise
    expect(authorizeUrl.searchParams.get('client_id')).toBe(authClientId())
    expect(authorizeUrl.searchParams.get('redirect_uri')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/)
    expect(authorizeUrl.searchParams.get('code_challenge')).toBeTruthy()
    expect(authorizeUrl.searchParams.get('state')).toBeTruthy()
    expect(await tokenRequest.promise).toMatchObject({code: 'windows-login-code', client_id: authClientId(), redirect_uri: authorizeUrl.searchParams.get('redirect_uri')})
  } finally {
    setGlobalConfig(originalConfig)
    await new Promise(resolve => server.close(resolve))
  }
})
