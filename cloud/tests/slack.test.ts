import {eq} from 'drizzle-orm'

import * as schema from '../schema.ts'
import {getDb} from '../server/db.ts'
import {orgId} from '../server/dev.ts'
import {mockSlackApi} from '../server/slack.ts'
import {test, expect} from './fixtures.ts'

test('rejects events with missing signature headers', async ({cloud}) => {
  let response = await fetch(`${cloud.url}/_api/slack/events`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({type: 'url_verification', challenge: 'abc123'}),
  })

  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({message: 'Invalid Slack signature'})
})

test('responds to url verification challenge', async ({slack}) => {
  let response = await slack.simulateWebhook({type: 'url_verification', challenge: 'abc123'})
  expect(response.statusCode).toBe(200)
  expect(await response.json()).toEqual({challenge: 'abc123'})
  expect(slack.getApiCalls()).toEqual([])
})

test('creates workspace mapping via oauth callback', async ({slack, cloud}) => {
  mockSlackApi(endpoint => {
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
  let installation = await db
    .select()
    .from(schema.slackInstallations)
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

test('routes app mention to cloud agent and replies in thread', async ({slack, mockLLM}) => {
  mockLLM.setResponse('Here is your answer from Graphene.')

  let response = await slack.simulateUserMessage('hello graphene')

  expect(response.statusCode).toBe(200)
  expect(await response.json()).toEqual({ok: true})

  await waitFor(() => slack.getApiCalls().some(c => c.endpoint === 'chat.postMessage'))
  await waitFor(() => mockLLM.getRequests().length === 1)

  let calls = slack.getApiCalls()
  expect(calls).toHaveLength(5)
  expect(calls[0]).toMatchObject({endpoint: 'reactions.add', payload: {channel: 'C123', timestamp: '1710000000.123456', name: 'thought_balloon'}})
  expect(calls[1]?.endpoint).toBe('conversations.replies')
  expect(calls[2]).toMatchObject({endpoint: 'users.info', payload: {user: 'U999'}})

  let llmCalls = mockLLM.getRequests()
  expect(llmCalls).toHaveLength(1)
  let messageLog = JSON.stringify(llmCalls[0]?.messages || [])
  expect(messageLog).toContain('@user-U999 hello graphene')
  expect(llmCalls[0]?.systemPrompt).toContain('Graphene is a framework for doing data analysis')

  let postCall = calls[3]
  expect(postCall).toMatchObject({endpoint: 'chat.postMessage'})
  expect(postCall?.payload).toMatchObject({
    channel: 'C123',
    text: 'Here is your answer from Graphene.',
    thread_ts: '1710000000.123456',
  })
  expect(calls[4]).toMatchObject({endpoint: 'reactions.remove', payload: {channel: 'C123', timestamp: '1710000000.123456', name: 'thought_balloon'}})
})

test('adds thought_balloon reaction while processing and removes it when done', async ({slack, mockLLM}) => {
  mockLLM.setResponse('done')

  let response = await slack.simulateUserMessage('react pls', {channel: 'C-REACTION', ts: '1711111111.111111'})
  expect(response.statusCode).toBe(200)

  await waitFor(() => slack.getApiCalls().some(c => c.endpoint === 'reactions.remove'))

  let endpoints = slack.getApiCalls().map(call => call.endpoint)
  expect(endpoints[0]).toBe('reactions.add')
  expect(endpoints[endpoints.length - 1]).toBe('reactions.remove')

  expect(slack.getApiCalls()[0]?.payload).toMatchObject({channel: 'C-REACTION', timestamp: '1711111111.111111', name: 'thought_balloon'})
  expect(slack.getApiCalls()[slack.getApiCalls().length - 1]?.payload).toMatchObject({channel: 'C-REACTION', timestamp: '1711111111.111111', name: 'thought_balloon'})
})

test('includes thread context when mention is in a thread', async ({slack, mockLLM}) => {
  mockLLM.setResponse('Thread-aware answer')

  mockSlackApi((endpoint, payload) => {
    if (endpoint === 'conversations.replies') {
      return {
        ok: true,
        messages: [
          {user: 'U1', text: 'What are our top delayed carriers?'},
          {user: 'U2', text: 'Focus on last month please.'},
        ],
      }
    }
    if (endpoint === 'users.info') {
      return {
        ok: true,
        user: {profile: {display_name: payload.user === 'U999' ? 'mention-user' : `thread-user-${payload.user}`}},
      }
    }
    return {ok: true}
  })

  let response = await slack.simulateUserMessage('run it', {threadTs: '1710000000.000001'})
  expect(response.statusCode).toBe(200)

  await waitFor(() => mockLLM.getRequests().length === 1)

  let llmCalls = mockLLM.getRequests()
  let promptLog = JSON.stringify(llmCalls[0]?.messages || [])
  expect(promptLog).toContain('Latest mention: @mention-user run it')
  expect(promptLog).toContain('@thread-user-U1: What are our top delayed carriers?')
  expect(promptLog).toContain('@thread-user-U2: Focus on last month please.')
})

test('uploads chart screenshot when respondToUser references mdId', async ({slack, mockLLM}) => {
  let screenshot = Buffer.from('fake-image-data').toString('base64')
  mockLLM.mock(() => {
    return [
      {role: 'assistant', content: [{type: 'tool-call', toolCallId: 'render-1', toolName: 'renderMd', input: {markdown: '# chart'}}]},
      {
        role: 'user',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'render-1',
            toolName: 'renderMd',
            output: {
              type: 'content',
              value: [
                {type: 'text', text: 'Rendered markdown id: abc123'},
                {type: 'media', data: screenshot, mediaType: 'image/png'},
              ],
            },
          },
        ],
      },
      {role: 'assistant', content: [{type: 'tool-call', toolCallId: 'respond-1', toolName: 'respondToUser', input: {text: 'Answer with chart', mdId: 'abc123'}}]},
      {role: 'user', content: [{type: 'tool-result', toolCallId: 'respond-1', toolName: 'respondToUser', output: {text: 'Answer with chart', mdId: 'abc123'}}]},
    ]
  })

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

test('resumes a slack thread by carrying forward prior prompt and adding only new thread context', async ({slack, mockLLM}) => {
  mockLLM.setResponse('Session reply')

  let threadTs = '1717000000.000001'
  let firstMentionTs = '1717000002.000003'
  let secondMentionTs = '1717000004.000005'
  let replyCalls = 0

  mockSlackApi((endpoint, payload) => {
    if (endpoint === 'conversations.replies') {
      replyCalls += 1
      if (replyCalls === 1) {
        return {
          ok: true,
          messages: [
            {user: 'U1', ts: '1717000000.500001', text: 'Message 1 from thread'},
            {user: 'U2', ts: '1717000001.500002', text: 'Message 2 from thread'},
            {user: 'U999', ts: firstMentionTs, text: '<@U999> Message 3 mentions graphene'},
          ],
        }
      }

      return {
        ok: true,
        messages: [
          {user: 'U1', ts: '1717000000.500001', text: 'Message 1 from thread'},
          {user: 'U2', ts: '1717000001.500002', text: 'Message 2 from thread'},
          {user: 'U999', ts: firstMentionTs, text: '<@U999> Message 3 mentions graphene'},
          {user: 'U3', ts: '1717000003.500004', text: 'Message 4 followup context'},
          {user: 'U999', ts: secondMentionTs, text: '<@U999> Message 5 mentions graphene again'},
        ],
      }
    }

    if (endpoint === 'users.info') {
      return {ok: true, user: {profile: {display_name: `thread-user-${payload.user}`}}}
    }

    return {ok: true}
  })

  await slack.simulateUserMessage('Message 3 mentions graphene', {channel: 'C-RESUME', ts: firstMentionTs, threadTs})
  await waitFor(() => mockLLM.getRequests().length === 1)

  let firstPrompts = getPromptTexts(mockLLM.getRequests()[0]?.messages || [])
  expect(firstPrompts).toEqual(['Latest mention: @thread-user-U999 Message 3 mentions graphene\nThread context:\n@thread-user-U1: Message 1 from thread\n@thread-user-U2: Message 2 from thread'])

  await slack.simulateUserMessage('Message 5 mentions graphene again', {channel: 'C-RESUME', ts: secondMentionTs, threadTs})
  await waitFor(() => mockLLM.getRequests().length === 2)

  let secondPrompts = getPromptTexts(mockLLM.getRequests()[1]?.messages || [])

  // Request should keep the prior prompt (messages 1,2,3) and append a new prompt with only 4,5.
  expect(secondPrompts).toEqual([
    'Latest mention: @thread-user-U999 Message 3 mentions graphene\nThread context:\n@thread-user-U1: Message 1 from thread\n@thread-user-U2: Message 2 from thread',
    'Latest mention: @thread-user-U999 Message 5 mentions graphene again\nThread context:\n@thread-user-U3: Message 4 followup context',
  ])
})

test('stores the last processed mention timestamp on the slack session', async ({slack, mockLLM}) => {
  mockLLM.setResponse('Session reply')

  await slack.simulateUserMessage('first mention', {
    channel: 'C-LAST-TS',
    ts: '1715000001.000001',
    threadTs: '1715000000.000001',
  })
  await waitFor(() => mockLLM.getRequests().length === 1)

  let db = getDb()
  let session = await db
    .select()
    .from(schema.agentSessions)
    .where(eq(schema.agentSessions.slackChannel, 'C-LAST-TS'))
    .then(rows => rows[0])

  expect(session).toBeDefined()
  expect(session!.lastSlackThreadTs).toBe('1715000001.000001')
})

test('only includes thread messages newer than the last processed mention', async ({slack, mockLLM}) => {
  mockLLM.setResponse('Session reply')

  let replyCalls = 0
  mockSlackApi((endpoint, payload) => {
    if (endpoint === 'conversations.replies') {
      replyCalls += 1
      if (replyCalls === 1) {
        return {
          ok: true,
          messages: [{user: 'U1', ts: '1716000000.500000', text: '<@U1> old context'}],
        }
      }
      return {
        ok: true,
        messages: [
          {user: 'U1', ts: '1716000000.500000', text: '<@U1> old context'},
          {user: 'U2', ts: '1716000001.500000', text: '<@U2> new context'},
        ],
      }
    }
    if (endpoint === 'users.info') {
      return {ok: true, user: {profile: {display_name: `user-${payload.user}`}}}
    }
    return {ok: true}
  })

  await slack.simulateUserMessage('first mention', {
    channel: 'C-FILTER-TS',
    ts: '1716000001.000001',
    threadTs: '1716000000.000001',
  })
  await waitFor(() => mockLLM.getRequests().length === 1)

  await slack.simulateUserMessage('second mention', {
    channel: 'C-FILTER-TS',
    ts: '1716000002.000001',
    threadTs: '1716000000.000001',
  })
  await waitFor(() => mockLLM.getRequests().length === 2)

  let secondPrompts = getPromptTexts(mockLLM.getRequests()[1]?.messages || [])
  expect(secondPrompts).toEqual([
    'Latest mention: @user-U999 first mention\nThread context:\n@user-U1: @user-U1 old context',
    'Latest mention: @user-U999 second mention\nThread context:\n@user-U2: @user-U2 new context',
  ])
})

function getPromptTexts(messages: any[]) {
  return messages.map(msg => (Array.isArray(msg.content) ? msg.content.map((c: any) => c.text || '').join('') : String(msg.content || ''))).filter(Boolean)
}

async function waitFor(predicate: () => boolean, timeoutMs = 4000) {
  let start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error('Timed out waiting for async slack handler')
}
