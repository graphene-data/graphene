import {test, expect} from './fixtures.ts'
import {getDb} from '../server/db.ts'
import {mockSlackApi} from '../server/slack.ts'
import * as schema from '../schema.ts'
import {eq} from 'drizzle-orm'
import {orgId} from '../server/dev.ts'

test('rejects events with missing signature headers', async({cloud}) => {
  let response = await fetch(`${cloud.url}/_api/slack/events`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({type: 'url_verification', challenge: 'abc123'}),
  })

  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({error: 'Invalid Slack signature'})
})

test('responds to url verification challenge', async({slack}) => {
  let response = await slack.simulateWebhook({type: 'url_verification', challenge: 'abc123'})
  expect(response.statusCode).toBe(200)
  expect(await response.json()).toEqual({challenge: 'abc123'})
  expect(slack.getApiCalls()).toEqual([])
})

test('creates workspace mapping via oauth callback', async({slack, cloud}) => {
  mockSlackApi((endpoint) => {
    if (endpoint === 'oauth.v2.access') {
      return {
        ok: true,
        access_token: 'xoxb-new-token',
        team: {id: 'T123', name: 'Graphene QA'},
        bot_user_id: 'U_BOT',
        authed_user: {id: 'U_INSTALLER'},
      }
    }
    return {ok: true}
  })

  let install = await slack.simulateInstallRedirect()
  expect(install.statusCode).toBe(302)
  expect(install.location).toContain('https://slack.com/oauth/v2/authorize')

  let state = new URL(install.location!).searchParams.get('state')
  expect(state).toBeTruthy()

  let callback = await slack.simulateOauthCallback({
    code: 'oauth-code',
    state: state!,
  })

  expect(callback.statusCode).toBe(302)
  expect(callback.location).toBe('/settings/repos')

  let db = getDb()
  let installation = await db.select().from(schema.slackInstallations)
    .where(eq(schema.slackInstallations.teamId, 'T123'))
    .then(rows => rows[0])

  expect(installation).toBeDefined()
  expect(installation!.orgId).toBe(orgId)
  expect(installation!.teamName).toBe('Graphene QA')
  expect(installation!.oauthToken).toContain('aes:')

  let statusResponse = await fetch(`${cloud.url}/_api/slack/status`)
  expect(statusResponse.status).toBe(200)
  expect(await statusResponse.json()).toEqual({connected: true, teamId: 'T123', teamName: 'Graphene QA'})
})

test('routes app mention to cloud agent and replies in thread', async({slack, mockLLM}) => {
  mockLLM.setResponse('Here is your answer from Graphene.')

  let response = await slack.simulateUserMessage('hello graphene')

  expect(response.statusCode).toBe(200)
  expect(await response.json()).toEqual({ok: true})

  await waitFor(() => slack.getApiCalls().some(c => c.endpoint === 'chat.postMessage'))
  await waitFor(() => mockLLM.getRequests().length === 1)

  let calls = slack.getApiCalls()
  expect(calls).toHaveLength(2)
  expect(calls[0]?.endpoint).toBe('conversations.replies')

  let llmCalls = mockLLM.getRequests()
  expect(llmCalls).toHaveLength(1)
  let messageLog = JSON.stringify(llmCalls[0]?.messages || [])
  expect(messageLog).toContain('<@U999> hello graphene')
  expect(llmCalls[0]?.systemPrompt).toContain('Graphene is a framework for doing data analysis')

  let firstCall = calls[1]
  expect(firstCall).toMatchObject({endpoint: 'chat.postMessage'})
  expect(firstCall?.payload).toMatchObject({
    channel: 'C123',
    text: 'Here is your answer from Graphene.',
    thread_ts: '1710000000.123456',
  })
})

test('includes thread context when mention is in a thread', async({slack, mockLLM}) => {
  mockLLM.setResponse('Thread-aware answer')

  mockSlackApi((endpoint) => {
    if (endpoint === 'conversations.replies') {
      return {
        ok: true,
        messages: [
          {user: 'U1', text: 'What are our top delayed carriers?'},
          {user: 'U2', text: 'Focus on last month please.'},
        ],
      }
    }
    return {ok: true}
  })

  let response = await slack.simulateUserMessage('run it', {threadTs: '1710000000.000001'})
  expect(response.statusCode).toBe(200)

  await waitFor(() => mockLLM.getRequests().length === 1)

  let llmCalls = mockLLM.getRequests()
  let promptLog = JSON.stringify(llmCalls[0]?.messages || [])
  expect(promptLog).toContain('Latest mention: <@U999> run it')
  expect(promptLog).toContain('user:U1: What are our top delayed carriers?')
  expect(promptLog).toContain('user:U2: Focus on last month please.')
})

test('uploads chart screenshot when respondToUser references mdId', async({slack, mockLLM}) => {
  let screenshot = Buffer.from('fake-image-data').toString('base64')
  mockLLM.mock(() => ({
    text: 'fallback text',
    steps: [{
      toolResults: [
        {toolName: 'renderMd', output: {success: true, mdId: 'abc123', screenshot}},
        {toolName: 'respondToUser', output: {text: 'Answer with chart', mdId: 'abc123'}},
      ],
    }],
  }))

  let response = await slack.simulateUserMessage('show me a chart')
  expect(response.statusCode).toBe(200)

  await waitFor(() => mockLLM.getRequests().length === 1)
  await waitFor(() => slack.getApiCalls().length >= 2)

  let calls = slack.getApiCalls()
  let uploadCall = calls.find(c => c.endpoint === 'files.uploadV2')
  expect(uploadCall).toBeDefined()
  expect(uploadCall?.payload).toMatchObject({
    channel_id: 'C123',
    thread_ts: '1710000000.123456',
    filename: 'chart.png',
  })
  expect(Buffer.isBuffer(uploadCall?.payload.file)).toBe(true)
})

test('stores and reuses one agent session per slack thread', async({slack, mockLLM}) => {
  mockLLM.setResponse('Session reply')

  await slack.simulateUserMessage('first mention', {ts: '1710000000.123456'})
  await slack.simulateUserMessage('second mention', {ts: '1710000001.000001', threadTs: '1710000000.123456'})
  await waitFor(() => mockLLM.getRequests().length === 2)

  let db = getDb()
  let sessions = await db.select().from(schema.agentSessions)
  expect(sessions).toHaveLength(1)

  let session = sessions[0]!
  expect(session.slackChannel).toBe('C123')
  expect(session.slackThreadTs).toBe('1710000000.123456')

  let llmCalls = mockLLM.getRequests()
  expect(llmCalls[1]?.messages.map(m => JSON.stringify(m)).join('\n')).toContain('Latest mention: <@U999> second mention')
})

async function waitFor(predicate: () => boolean, timeoutMs = 4000) {
  let start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error('Timed out waiting for async slack handler')
}
