import {generateText, stepCountIs} from 'ai'
import {anthropic} from '@ai-sdk/anthropic'
import {readFileSync} from 'fs'
import {fileURLToPath} from 'url'
import path from 'path'
import {listDirTool, readFileTool, searchTool, renderMdTool} from './tools.ts'
import {PROD} from '../consts.ts'

// Read Graphene documentation at module load time
const __dirname = path.dirname(fileURLToPath(import.meta.url))
let grapheneDocs = readFileSync(path.resolve(__dirname, '../../../core/docs/base.md'), 'utf-8')

interface AgentMessage {
  type: 'system' | 'assistant' | 'user'
  message?: {content: any[]}
  cwd?: string
  uuid?: string
}

type MessageCallback = (msg: AgentMessage) => void

interface RunAgentOptions {
  prompt: string
  repoId: string
  orgId: string
  onMessage?: MessageCallback
}

interface AgentMockArgs {
  prompt: string
  repoId: string
  orgId: string
  systemPrompt: string
}

let agentMock: ((args: AgentMockArgs) => string | Promise<string>) | null = null

export function mockAgent (handler: ((args: AgentMockArgs) => string | Promise<string>) | null) {
  agentMock = handler
}

export async function runAgent ({prompt, repoId, orgId: _orgId, onMessage}: RunAgentOptions) {
  let systemPrompt = buildSystemPrompt()
  if (agentMock) {
    return {text: await agentMock({prompt, repoId, orgId: _orgId, systemPrompt}), steps: []} as any
  }
  onMessage ||= () => { }

  let stepCounter = 0
  let result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    prompt,
    tools: {
      listDir: listDirTool(repoId),
      readFile: readFileTool(repoId),
      search: searchTool(repoId),
      renderMd: renderMdTool(repoId, !PROD ? getDevTunnelUrl() : undefined),
    },
    stopWhen: stepCountIs(30),
    onStepFinish: (step) => {
      stepCounter++
      let stepId = `step-${stepCounter}`

      // Convert AI SDK step format to frontend expected format
      let assistantContent: any[] = []

      // Add text if present
      if (step.text) {
        assistantContent.push({type: 'text', text: step.text, id: `${stepId}-text`})
      }

      // Add tool calls
      if (step.toolCalls && step.toolCalls.length > 0) {
        for (let tc of step.toolCalls) {
          assistantContent.push({
            type: 'tool_use',
            id: tc.toolCallId,
            name: tc.toolName,
            input: tc.input,
          })
        }
      }

      if (assistantContent.length > 0) {
        onMessage({type: 'assistant', uuid: stepId, message: {content: assistantContent}})
      }

      // Add tool results
      if (step.toolResults && step.toolResults.length > 0) {
        let userContent: any[] = []
        for (let tr of step.toolResults) {
          userContent.push({
            type: 'tool_result',
            tool_use_id: tr.toolCallId,
            content: typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output),
          })
        }
        onMessage({type: 'user', uuid: `${stepId}-result`, message: {content: userContent}})
      }
    },
  })

  // Send final text if not already sent in last step
  if (result.text && !result.steps?.length) {
    onMessage({
      type: 'assistant',
      uuid: 'final',
      message: {content: [{type: 'text', text: result.text, id: 'final-text'}]},
    })
  }

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
