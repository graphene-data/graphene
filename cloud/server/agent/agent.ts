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

interface AgentMockArgs {
  messages: ModelMessage[]
  repoId: string
  orgId: string
  systemPrompt: string
}

export interface AgentRunResult {
  text: string
  steps?: any[]
  [key: string]: any
}

let agentMock: ((args: AgentMockArgs) => AgentRunResult | string | Promise<AgentRunResult | string>) | null = null

export function mockAgent(handler: ((args: AgentMockArgs) => AgentRunResult | string | Promise<AgentRunResult | string>) | null) {
  agentMock = handler
}

export async function runAgent(session: AgentSession, onStep?: StepCallback) {
  if (!session.repoId) throw new Error('Agent session must include repoId')
  session.messages ||= []
  let systemPrompt = buildSystemPrompt()
  let modelMessages = session.messages.map((x: any) => ({role: x.role, content: x.content})) as ModelMessage[]
  let persistedMessageCount = modelMessages.length

  if (agentMock) {
    let mocked = await agentMock({messages: modelMessages, repoId: session.repoId, orgId: session.orgId, systemPrompt})
    if (typeof mocked === 'string') return {text: mocked, steps: []}
    return {...mocked, steps: mocked.steps || []}
  }

  let result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      listDir: listDirTool(session.repoId),
      readFile: readFileTool(session.repoId),
      search: searchTool(session.repoId),
      renderMd: renderMdTool(session.repoId, !PROD ? getDevTunnelUrl() : undefined),
      respondToUser: respondToUserTool(),
    },
    stopWhen: stepCountIs(30),
    onStepFinish: (step) => {
      let responseMessages = step.response?.messages || []
      let stepMessages = cleanMessages(responseMessages.slice(persistedMessageCount))
      if (stepMessages.length) session.messages.push(...stepMessages)
      persistedMessageCount = responseMessages.length
      console.dir(stepMessages, {depth: null})
      onStep?.(step)
    },
  })

  await getDb().update(agentSessions)
    .set({messages: session.messages, updatedAt: new Date()})
    .where(eq(agentSessions.id, session.id))

  return result
}

function cleanMessages(messages: any[]) {
  // Keep message metadata, but strip binary/media payloads to keep session storage small.
  return structuredClone(messages).map(m => {
    let content = (Array.isArray(m.content) ? m.content : [{type: 'text', text: m.content}]) as any[]
    for (let ct of content) {
      if (ct.output?.type == 'content') ct.output.value = ct.output.value.filter(v => v.type != 'media')
    }
    m.content = content
    return m
  })
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
