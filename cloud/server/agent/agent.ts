import {generateText, stepCountIs, type ModelMessage} from 'ai'
import {anthropic} from '@ai-sdk/anthropic'
import {readFileSync} from 'fs'
import {fileURLToPath} from 'url'
import path from 'path'
import {eq} from 'drizzle-orm'
import {listDirTool, readFileTool, searchTool, renderMdTool} from './tools.ts'
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

let agentMock: ((args: AgentMockArgs) => string | Promise<string>) | null = null

export function mockAgent (handler: ((args: AgentMockArgs) => string | Promise<string>) | null) {
  agentMock = handler
}

export async function runAgent (session: AgentSession, onStep?: StepCallback) {
  if (!session.repoId) throw new Error('Agent session must include repoId')
  session.messages ||= []
  let systemPrompt = buildSystemPrompt()
  let modelMessages = session.messages.map((x: any) => ({role: x.role, content: x.content})) as ModelMessage[]

  if (agentMock) {
    let text = await agentMock({messages: modelMessages, repoId: session.repoId, orgId: session.orgId, systemPrompt})
    return {text, steps: []} as any
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
    },
    stopWhen: stepCountIs(30),
    onStepFinish: (step) => {
      for (let message of step.response.messages) {
        session.messages.push({...message, createdAt: new Date().toISOString()})
      }
      onStep?.(step)
    },
  })

  await getDb().update(agentSessions)
    .set({messages: session.messages, updatedAt: new Date()})
    .where(eq(agentSessions.id, session.id))

  return result
}

function getDevTunnelUrl () {
  return (globalThis as any).__GRAPHENE_DEV_NGROK_URL as string | undefined
}

function buildSystemPrompt (): string {
  let today = new Date().toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})
  let base = `
    You are a data analyst assistant that answers questions using Graphene.

    Today's date is ${today}.

    ${grapheneDocs}

    IMPORTANT: You must ALWAYS call renderMd to show the user a chart. Never just describe data - visualize it.
    Always use a chart component (BarChart, LineChart, AreaChart, PieChart), never a Table. renderMd returns both the chart image and the underlying tabular data, so you'll have the exact numbers to reference in your answer.

    Available tools:
    - listDir(path): List files and directories. Use "" for root.
    - readFile(path): Read a file's contents.
    - search(query): Search for files by path or content.
    - renderMd(markdown): Render markdown with a chart. Returns a screenshot of the chart and the underlying query data.

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
