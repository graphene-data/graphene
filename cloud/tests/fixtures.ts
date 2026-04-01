import type {ModelMessage} from 'ai'

import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import dotenv from 'dotenv'
import net from 'net'
import crypto from 'node:crypto'
import path from 'path'
import {chromium, type Browser, type Page} from 'playwright'
import {test as base} from 'vitest'

import {trackBrowserConsole, expectConsoleError, onServerLog} from '../../core/ui/tests/logWatcher.ts'
import {playwrightExpect as expect} from '../../core/ui/tests/matchers.ts'
import {mockAgent as setAgentMock} from '../server/agent/agent.ts'
import {setAuthOverride} from '../server/auth.ts'
import {setupPglite} from '../server/db.ts'
import {startDevServer, orgId, userId, teamId} from '../server/dev.ts'
import {mockSlackApi} from '../server/slack.ts'

dotenv.config({path: path.resolve(import.meta.dirname, '../../.env'), quiet: true})
process.env.SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || 'test-signing-secret'

// Load pglite classes once before all tests, with a random port for parallel execution
await setupPglite(await getAvailablePort())

interface SlackFixture {
  simulateWebhook: (payload: any) => Promise<{statusCode: number; json: () => Promise<any>}>
  simulateUserMessage: (text: string, options?: {teamId?: string; channel?: string; ts?: string; threadTs?: string}) => Promise<{statusCode: number; json: () => Promise<any>}>
  simulateInstallRedirect: () => Promise<{statusCode: number; location: string | null}>
  simulateOauthCallback: (params: {code: string; state: string}) => Promise<{statusCode: number; location: string | null; json: () => Promise<any>}>
  getApiCalls: () => {endpoint: string; payload: any}[]
}

interface MockLLMFixture {
  setResponse: (text: string) => void
  mock: (handler: (args: {messages: ModelMessage[]; systemPrompt: string}) => Promise<Record<string, any>[]> | Record<string, any>[]) => void
  getRequests: () => {messages: ModelMessage[]; systemPrompt: string}[]
}

export const test = base.extend<{
  realAuth: boolean
  project: string
  browser: Browser
  page: Page
  cloud: {url: string}
  slack: SlackFixture
  mockLLM: MockLLMFixture
  mcpClient: Client
}>({
  realAuth: false,
  project: 'flights',

  // eslint-disable-next-line no-empty-pattern
  browser: async ({}, use) => {
    let b = await chromium.launch({
      headless: !process.env.GRAPHENE_DEBUG,
      args: [
        '--font-render-hinting=none', // Consistent font rendering across platforms
        '--disable-font-subpixel-positioning', // Avoid tiny per-glyph edge drift across OS builds
        '--disable-lcd-text', // Use grayscale AA instead of subpixel AA for more stable screenshots
        '--force-color-profile=srgb',
        '--lang=en-US',
        ...(process.env.GRAPHENE_DEBUG ? ['--auto-open-devtools-for-tabs'] : []),
      ],
    })
    await use(b)
    await b.close()
  },

  // cloud starts BEFORE page so it tears down AFTER page - this ensures the server is still running during assertions
  cloud: async ({realAuth, project}, use) => {
    let port = realAuth ? 3121 : await getAvailablePort()
    // custom logger allows us to fail if the server logs an error we don't expect
    let logger = {level: 'warn', stream: {write: (line: string) => onServerLog(line.trimEnd())}}
    let handle = await startDevServer({realAuth, port, project, logger})
    try {
      await use({url: handle.url})
    } finally {
      await handle.close()
    }
  },

  // page depends on cloud so it sets up after and tears down before (server still running during teardown)
  page: async ({browser, cloud: _cloud}, use) => {
    let context = await browser.newContext({
      viewport: {width: 1280, height: 720},
      deviceScaleFactor: 2,
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'reduce',
    })
    let page = await context.newPage()
    trackBrowserConsole(page)
    await use(page)
    if (process.env.GRAPHENE_DEBUG) await new Promise(() => {})
    await context.close()
  },

  // eslint-disable-next-line no-empty-pattern
  mockLLM: async ({}, use) => {
    let requests: {messages: ModelMessage[]; systemPrompt: string}[] = []
    let responseText = 'Agent response from test'
    let handler: ((args: {messages: ModelMessage[]; systemPrompt: string}) => Promise<Record<string, any>[]> | Record<string, any>[]) | null = null

    setAgentMock(async config => {
      let args = {
        messages: (config.messages || []).map((x: any) => ({role: x.role, content: x.content})) as ModelMessage[],
        systemPrompt: config.system || '',
      }
      requests.push(args)

      let mockMessages = handler ? await handler(args) : appendRespondToUser(config.messages || [], responseText)
      return {response: {messages: mockMessages}}
    })

    await use({
      setResponse(text: string) {
        responseText = text
        handler = null
      },
      mock(nextHandler) {
        handler = nextHandler
      },
      getRequests() {
        return requests
      },
    })

    setAgentMock(null)
  },

  mcpClient: async ({cloud}, use) => {
    let client = new Client({name: 'mcp-e2e-test-client', version: '1.0.0'})
    let transport = new StreamableHTTPClientTransport(new URL('/_api/mcp', cloud.url))
    await client.connect(transport)

    try {
      await use(client)
    } finally {
      await transport.close()
      await client.close()
    }
  },

  // Slack fixture for simulating inbound events and inspecting outbound API calls
  slack: async ({cloud, mockLLM: _mockLLM}, use) => {
    void _mockLLM
    let apiCalls: {endpoint: string; payload: any}[] = []
    setAuthOverride({userId, orgId, slug: ''})
    process.env.SLACK_CLIENT_ID = 'test-client-id'
    process.env.SLACK_CLIENT_SECRET = 'test-client-secret'
    process.env.SLACK_SIGNING_SECRET = 'test-signing-secret'

    mockSlackApi((endpoint, payload) => {
      apiCalls.push({endpoint, payload})
      if (endpoint === 'conversations.replies') {
        return Promise.resolve({ok: true, messages: [{user: 'U999', ts: payload.ts, text: '<@U999> hello graphene'}]})
      }
      if (endpoint === 'users.info') {
        return Promise.resolve({ok: true, user: {id: payload.user, profile: {display_name: `user-${payload.user}`}}})
      }
      return Promise.resolve({ok: true})
    })

    let slack: SlackFixture = {
      async simulateWebhook(payload: any) {
        let rawBody = JSON.stringify(payload)
        let timestamp = String(Math.floor(Date.now() / 1000))
        let signingSecret = process.env.SLACK_SIGNING_SECRET || ''
        let signature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(`v0:${timestamp}:${rawBody}`).digest('hex')
        let response = await fetch(`${cloud.url}/_api/slack/events`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-slack-request-timestamp': timestamp,
            'x-slack-signature': signature,
          },
          body: rawBody,
        })
        return {statusCode: response.status, json: () => response.json()}
      },

      async simulateUserMessage(text: string, options: any = {}) {
        return await slack.simulateWebhook({
          type: 'event_callback',
          team_id: options.teamId || teamId,
          event: {type: 'app_mention', channel: options.channel || 'C123', ts: options.ts || '1710000000.123456', thread_ts: options.threadTs, text: `<@U999> ${text}`},
        })
      },

      async simulateInstallRedirect() {
        let response = await fetch(`${cloud.url}/_api/slack/install`, {redirect: 'manual'})
        return {
          statusCode: response.status,
          location: response.headers.get('location'),
        }
      },

      async simulateOauthCallback({code, state}) {
        let response = await fetch(`${cloud.url}/_api/slack/oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, {
          redirect: 'manual',
        })
        return {
          statusCode: response.status,
          location: response.headers.get('location'),
          json: () => response.json(),
        }
      },

      getApiCalls() {
        return apiCalls
      },
    }

    await use(slack)
    mockSlackApi(null)
    setAuthOverride(null)
  },
})

export {expect, expectConsoleError}

function appendRespondToUser(_messages: ModelMessage[], text: string) {
  return [
    {role: 'assistant', content: [{type: 'tool-call', toolCallId: 'mock-respond', toolName: 'respondToUser', input: {text}}]},
    {role: 'user', content: [{type: 'tool-result', toolCallId: 'mock-respond', toolName: 'respondToUser', output: {text}}]},
  ]
}

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    let srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      let {port} = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
  })
}
