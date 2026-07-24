/// <reference types="vitest/globals" />
// Covers delegated CLI authentication, which bypasses the renewable credentials saved by `graphene login`.

import {createServer} from 'node:http'

import {config, normalizeConfig, setGlobalConfig} from '../lang/config.ts'
import {authenticatedFetch} from './auth.ts'

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
    process.env.GRAPHENE_TOKEN = 'short-lived-support-token'

    let response = await authenticatedFetch('/query')

    expect(await response.text()).toBe('ok')
    expect(authorization).toBe('Bearer short-lived-support-token')
  } finally {
    await new Promise(resolve => server.close(resolve))
    setGlobalConfig(originalConfig)
    if (originalToken === undefined) delete process.env.GRAPHENE_TOKEN
    else process.env.GRAPHENE_TOKEN = originalToken
  }
})
