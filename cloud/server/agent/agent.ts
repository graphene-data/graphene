import {generateText, stepCountIs, type ModelMessage} from 'ai'
import {anthropic} from '@ai-sdk/anthropic'
import {readFileSync} from 'fs'
import {fileURLToPath} from 'url'
import path from 'path'
import {eq} from 'drizzle-orm'
import {listDirTool, readFileTool, searchTool, renderMdTool, respondToUserTool} from './tools.ts'
import {PROD} from '../consts.ts'
import {getDb} from '../db.ts'
import {agentSessions, type AgentSession} from '../../schema.ts'

// Read Graphene documentation at module load time
const __dirname = path.dirname(fileURLToPath(import.meta.url))
let grapheneDocs = readFileSync(path.resolve(__dirname, '../../../core/docs/base.md'), 'utf-8')

type StepCallback = (event: any) => void

let agentMock: ((session: AgentSession, systemPrompt: string) => Promise<Record<string, any>[]> | Record<string, any>[]) | null = null

export function mockAgent(handler: ((session: AgentSession, systemPrompt: string) => Promise<Record<string, any>[]> | Record<string, any>[]) | null) {
  agentMock = handler
}

export async function runAgent(session: AgentSession, onStep?: StepCallback) {
  if (!session.repoId) throw new Error('Agent session must include repoId')
  session.messages ||= []
  let systemPrompt = buildSystemPrompt()

  // Run the model once. If it forgets respondToUser, prompt it one more time and fail hard if it still doesn't comply.
  let startIdx = session.messages.length
  await runModel(session, systemPrompt, onStep)

  // If the model didn't call respondToUser, ask it to
  let resp = session.messages.find((m, idx) => idx > startIdx && isToolResult(m, 'respondToUser'))
  if (!resp) {
    let text = 'You ended your turn without calling respondToUser. Call respondToUser now with your final user-facing answer (and mdId if available). Do not call any other tools.'
    session.messages.push({role: 'user', content: [{type: 'text', text}]})
    await runModel(session, systemPrompt, onStep)
  }
  // persist here, so even if we error, we can see the session
  await getDb().update(agentSessions)
    .set({messages: session.messages, updatedAt: new Date()})
    .where(eq(agentSessions.id, session.id))


  // if it _still_ didn't call respondToUser, error
  resp = session.messages.find((m, idx) => idx > startIdx && isToolResult(m, 'respondToUser'))
  if (!resp) throw new Error('Model failed to call respondToUser')
}

async function runModel(session: AgentSession, systemPrompt: string, onStep?: StepCallback) {
  let modelMessages = session.messages.map((x: any) => ({role: x.role, content: x.content})) as ModelMessage[]

  if (agentMock) {
    session.messages = await agentMock(session, systemPrompt)
    return
  }

  let persistedMessageCount = modelMessages.length
  await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      listDir: listDirTool(session.repoId!),
      readFile: readFileTool(session.repoId!),
      search: searchTool(session.repoId!),
      renderMd: renderMdTool(session.repoId!, !PROD ? getDevTunnelUrl() : undefined),
      respondToUser: respondToUserTool(),
    },
    stopWhen: stepCountIs(30),
    onStepFinish: (step) => {
      let responseMessages = step.response?.messages || []
      let stepMessages = cleanMessages(responseMessages.slice(persistedMessageCount))
      session.messages.push(...stepMessages)
      persistedMessageCount = responseMessages.length
      // console.dir(stepMessages, {depth: null})
      onStep?.(step)
    },
  })
}

export function isToolResult(message: any, toolName?: string) {
  let content = Array.isArray(message?.content) ? message.content : []
  return content.some((chunk: any) => {
    let isResult = chunk?.type === 'tool-result' || chunk?.type === 'tool_result'
    if (!isResult) return false
    if (!toolName) return true
    return chunk.toolName === toolName || chunk.tool_name === toolName || chunk.name === toolName
  })
}

function cleanMessages(messages: any[]) {
  // Keep message metadata, but strip binary/media payloads to keep session storage small.
  let cloned = structuredClone(messages)
  let toolNamesById = new Map<string, string>()

  for (let message of cloned) {
    let content = (Array.isArray(message.content) ? message.content : [{type: 'text', text: message.content}]) as any[]
    for (let chunk of content) {
      if ((chunk?.type === 'tool-call' || chunk?.type === 'tool_use') && chunk.toolCallId && chunk.toolName) {
        toolNamesById.set(chunk.toolCallId, chunk.toolName)
      }
    }
    message.content = content
  }

  for (let message of cloned) {
    for (let chunk of message.content as any[]) {
      if (chunk?.output?.type == 'content') chunk.output.value = chunk.output.value.filter((v: any) => v.type != 'media')
      if ((chunk?.type === 'tool-result' || chunk?.type === 'tool_result') && !chunk.toolName && chunk.toolCallId) {
        let toolName = toolNamesById.get(chunk.toolCallId)
        if (toolName) chunk.toolName = toolName
      }
    }
  }

  return cloned
}

function getDevTunnelUrl() {
  return (globalThis as any).__GRAPHENE_DEV_NGROK_URL as string | undefined
}

function buildSystemPrompt(): string {
  let today = new Date().toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})
  let base = `
    You are a data analyst assistant that answers questions using Graphene.

    Today's date is ${today}.

    ${grapheneDocs}

    IMPORTANT: You must ALWAYS call renderMd to show the user a chart. Never just describe data - visualize it.
    Always use a chart component (BarChart, LineChart, AreaChart, PieChart), never a Table. renderMd returns both the chart image and the underlying tabular data, so you'll have the exact numbers to reference in your answer.
    IMPORTANT: You must call respondToUser exactly once at the end with your final response text. Do not end with plain assistant text.
    If you want Slack to attach the chart image, pass mdId from renderMd into respondToUser.
    If you want to use markdown in respondToUser, please use Slack-compatible mrkdwn.

    Available tools:
    - listDir(path): List files and directories. Use "" for root.
    - readFile(path): Read a file's contents.
    - search(query): Search for files by path or content.
    - renderMd(markdown): Render markdown with a chart. Returns mdId, screenshot, and underlying query data.
    - respondToUser(text, mdId?): Send your final answer back to the user. Must be called exactly once when done.

    Explore the repo to find relevant tables and columns to the users question. If it can't be answered or needs clarification, you can ask the user for that.

    The best way to answer a question is a call to renderMd with markdown that contains a single chart. Pick the chart type that best fits the data (BarChart for comparisons, LineChart for trends over time, PieChart for proportions, etc).

    renderMd format - create markdown with a SQL code block and a chart component:

    \`\`\`sql mydata
    SELECT column1, column2, aggregation
    FROM tablename
    GROUP BY column1
    \`\`\`

    <BarChart data="mydata" x="column1" y="aggregation" />

    The sql code block defines a query named "mydata" which is then used as the data prop.
  `
  return base
}
