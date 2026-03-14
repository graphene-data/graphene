import {test, expect} from './fixtures.ts'
import {getDb} from '../server/db.ts'
import {runAgent} from '../server/agent/agent.ts'
import {agentSessions, repos} from '../schema.ts'
import {eq} from 'drizzle-orm'
import {orgId} from '../server/dev.ts'

test('retries once when model finishes without calling respondToUser', async({cloud, mockLLM}) => {
  void cloud
  mockLLM.mock(({messages}) => {
    let prior = messages as any[]
    if (messages.some(m => JSON.stringify(m.content).includes('without calling respondToUser'))) {
      return [
        ...prior,
        {role: 'assistant', content: [{type: 'tool-call', toolCallId: 'respond-1', toolName: 'respondToUser', input: {text: 'Final response', mdId: 'md-1'}}]},
        {role: 'user', content: [{type: 'tool-result', toolCallId: 'respond-1', toolName: 'respondToUser', output: {text: 'Final response', mdId: 'md-1'}}]},
      ]
    }

    return [
      ...prior,
      {role: 'assistant', content: [{type: 'tool-call', toolCallId: 'render-1', toolName: 'renderMd', input: {markdown: '# chart'}}]},
      {role: 'user', content: [{type: 'tool-result', toolCallId: 'render-1', toolName: 'renderMd', output: {success: true, mdId: 'md-1', screenshot: 'abc'}}]},
    ]
  })

  let session = await createSession()
  session.messages.push({role: 'user', content: [{type: 'text', text: 'Show me delays'}]})

  await runAgent(session)

  expect(mockLLM.getRequests()).toHaveLength(2)
  let followUpPrompt = JSON.stringify(mockLLM.getRequests()[1]?.messages || [])
  expect(followUpPrompt).toContain('without calling respondToUser')
  let toolNames = (session.messages || [])
    .flatMap((message: any) => Array.isArray(message.content) ? message.content : [])
    .filter((chunk: any) => chunk.type === 'tool-result')
    .map((chunk: any) => chunk.toolName)
  expect(toolNames).toEqual(['renderMd', 'respondToUser'])
})

test('throws when model still does not call respondToUser after follow-up', async({cloud, mockLLM}) => {
  void cloud
  mockLLM.mock(({messages}) => {
    let prior = messages as any[]
    return [
      ...prior,
      {role: 'assistant', content: [{type: 'tool-call', toolCallId: 'render-1', toolName: 'renderMd', input: {markdown: '# chart'}}]},
      {role: 'user', content: [{type: 'tool-result', toolCallId: 'render-1', toolName: 'renderMd', output: {success: true, mdId: 'md-1'}}]},
    ]
  })

  let session = await createSession()
  session.messages.push({role: 'user', content: [{type: 'text', text: 'Show me delays'}]})

  await expect(runAgent(session)).rejects.toThrow('Model failed to call respondToUser')
  expect(mockLLM.getRequests()).toHaveLength(2)
})

async function createSession() {
  let db = getDb()
  let repo = await db.select({id: repos.id}).from(repos).where(eq(repos.orgId, orgId)).then(rows => rows[0])
  if (!repo) throw new Error('Expected seeded repo')

  let session = await db.insert(agentSessions)
    .values({orgId, repoId: repo.id, messages: []})
    .returning()
    .then(rows => rows[0])

  if (!session) throw new Error('Could not create session')
  return session
}
