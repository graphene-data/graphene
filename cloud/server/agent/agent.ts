import {anthropic} from '@ai-sdk/anthropic'
import {generateText, stepCountIs} from 'ai'
import {eq} from 'drizzle-orm'
import {readFileSync} from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'

import {agentSessions, type AgentSession} from '../../schema.ts'
import {getDb} from '../db.ts'
import {listDirTool, readFileTool, searchTool, renderMdTool, respondToUserTool} from './tools.ts'

// Read Graphene documentation at module load time
const __dirname = path.dirname(fileURLToPath(import.meta.url))
let grapheneDocs = readFileSync(path.resolve(__dirname, '../../../core/docs/base.md'), 'utf-8')

let agentMock: ((config: any) => Promise<any>) | null = null

export function mockAgent(handler: ((config: any) => Promise<any>) | null) {
  agentMock = handler
}

export async function runAgent(session: AgentSession): Promise<{text: string; screenshot?: string}> {
  if (!session.repoId) throw new Error('Agent session must include repoId')
  let messages = session.messages || []
  let startIdx = messages.length
  let systemPrompt = buildSystemPrompt()

  let config = {
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    tools: {
      listDir: listDirTool(session.repoId!),
      readFile: readFileTool(session.repoId!),
      search: searchTool(session.repoId!),
      renderMd: renderMdTool(session.repoId!),
      respondToUser: respondToUserTool(),
    },
    stopWhen: stepCountIs(50),
    onStepFinish: (step: any) => console.dir(step.content, {depth: null}),
  }

  let runResult = await runModel({...config, messages})
  messages.push(...(runResult.response?.messages || []))

  // If the model didn't call respondToUser, ask it to
  let hasRespond = messages.some((m, idx) => idx > startIdx && isToolResult(m, 'respondToUser'))
  if (!hasRespond) {
    let text = 'You ended your turn without calling respondToUser. Call respondToUser now with your final user-facing answer (and mdId if available). Do not call any other tools.'
    messages.push({role: 'user', content: [{type: 'text', text}]})
    runResult = await runModel({...config, messages})
    messages.push(...(runResult.response?.messages || []))
  }

  // persist here, so even if we error, we can see the session
  await getDb()
    .update(agentSessions)
    .set({messages: cleanMessages(messages), updatedAt: new Date()})
    .where(eq(agentSessions.id, session.id))

  // if it _still_ didn't call respondToUser, error
  let respondResult = findLastToolChunk(messages, 'tool-result', 'respondToUser', startIdx)
  if (!respondResult) throw new Error('Model failed to call respondToUser')

  // Pull text/mdId from the respondToUser tool-call input, then fall back to tool-result output.
  let respondCall = findLastToolChunk(messages, 'tool-call', 'respondToUser', startIdx)
  let text = respondCall?.input?.text || respondResult?.output?.text
  if (!text) throw new Error('Missing text in response')

  let mdId = respondCall?.input?.mdId || respondResult?.output?.mdId
  let screenshot = mdId ? findRenderScreenshot(messages, mdId, startIdx) : undefined

  return {text, screenshot}
}

async function runModel(config) {
  return agentMock ? await agentMock(config) : await generateText(config)
}

export function isToolResult(message: any, toolName: string) {
  let content = Array.isArray(message?.content) ? message.content : []
  return content.some((chunk: any) => chunk.type == 'tool-result' && chunk.toolName == toolName)
}

function findLastToolChunk(messages: any[], type: 'tool-call' | 'tool-result', toolName: string, startIdx: number) {
  for (let i = messages.length - 1; i > startIdx; i--) {
    let message = messages[i]
    let content = Array.isArray(message?.content) ? message.content : []
    let chunk = [...content].reverse().find((c: any) => c.type == type && c.toolName == toolName)
    if (chunk) return chunk
  }
  return null
}

function findRenderScreenshot(messages: any[], mdId: string, startIdx: number): string | undefined {
  for (let i = messages.length - 1; i > startIdx; i--) {
    let message = messages[i]
    let content = Array.isArray(message?.content) ? message.content : []
    for (let chunk of [...content].reverse()) {
      if (chunk.type != 'tool-result' || chunk.toolName != 'renderMd') continue
      let renderMdId = getRenderMdId(chunk)
      if (renderMdId != mdId) continue
      let screenshot = getRenderScreenshot(chunk)
      if (screenshot) return screenshot
    }
  }
  return undefined
}

function getRenderMdId(chunk: any): string | undefined {
  if (chunk?.output?.type != 'content') return undefined
  let value = chunk.output?.value
  if (!Array.isArray(value)) return undefined

  for (let entry of value) {
    if (entry?.type != 'text' || typeof entry?.text != 'string') continue
    let match = entry.text.match(/Rendered markdown id:\s*([a-zA-Z0-9_-]+)/)
    if (match?.[1]) return match[1]
  }
  return undefined
}

function getRenderScreenshot(chunk: any): string | undefined {
  if (chunk?.output?.type != 'content') return undefined
  let value = chunk.output?.value
  if (!Array.isArray(value)) return undefined
  let media = value.find((entry: any) => entry?.type == 'media' && typeof entry?.data == 'string')
  return media?.data
}

// Keep message metadata, but strip binary/media payloads to keep session storage small.
function cleanMessages(messages: any[]) {
  let cloned = structuredClone(messages)
  for (let content of cloned.flatMap(m => m.content)) {
    if (!Array.isArray(content.output?.value)) continue
    content.output.value = content.output.value.filter(v => v.type != 'media')
  }
  return cloned
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
