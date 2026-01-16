import {generateText, stepCountIs} from 'ai'
import {anthropic} from '@ai-sdk/anthropic'
import {eq, or, like} from 'drizzle-orm'
import {readFileSync} from 'fs'
import {fileURLToPath} from 'url'
import path from 'path'
import {getDb} from '../db.ts'
import {files} from '../../schema.ts'
import {listDirTool, readFileTool, searchTool, renderMdTool} from './tools.ts'

// Read Graphene documentation at module load time
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const grapheneDocsPath = path.resolve(__dirname, '../../../core/docs/graphene.md')
let grapheneDocs = ''
try {
  grapheneDocs = readFileSync(grapheneDocsPath, 'utf-8')
} catch {
  console.warn('Could not load graphene.md documentation')
}

interface AgentMessage {
  type: 'system' | 'assistant' | 'user'
  message?: {content: any[]}
  cwd?: string
  uuid?: string
}

type MessageCallback = (msg: AgentMessage) => void

export async function runAgent (prompt: string, repoId: string, orgId: string, onMessage: MessageCallback) {
  // Read CLAUDE.md or AGENTS.md first for context
  let contextContent = await findContextFiles(repoId)
  let systemPrompt = buildSystemPrompt(contextContent)

  let stepCounter = 0
  let result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    prompt,
    tools: {
      listDir: listDirTool(repoId),
      readFile: readFileTool(repoId),
      search: searchTool(repoId),
      renderMd: renderMdTool(repoId),
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

async function findContextFiles (repoId: string): Promise<string> {
  // Look for CLAUDE.md, AGENTS.md, or README.md
  let _contextFiles = await getDb()
    .select({path: files.path, content: files.content})
    .from(files)
    .where(or(
      like(files.path, '%CLAUDE'),
      like(files.path, '%AGENTS'),
      like(files.path, '%claude'),
      like(files.path, '%agents'),
    ))
    .all()

  // Filter to only files in this repo
  let repoFiles = await getDb()
    .select({path: files.path, content: files.content})
    .from(files)
    .where(eq(files.repoId, repoId))
    .all()

  let contextContent = ''
  for (let pattern of ['CLAUDE', 'AGENTS', 'claude', 'agents']) {
    let match = repoFiles.find(f => f.path.toUpperCase().includes(pattern.toUpperCase()))
    if (match) {
      contextContent += `\n\n--- ${match.path} ---\n${match.content}`
    }
  }

  return contextContent
}

function buildSystemPrompt (contextContent: string): string {
  let base = `You are a data analyst assistant for Graphene. Your job is to answer questions by creating visualizations.

IMPORTANT: You must ALWAYS call renderMd to show the user a chart or table. Never just describe data - visualize it.

Available tools:
- listDir(path): List files and directories. Use "" for root.
- readFile(path): Read a file's contents.
- search(query): Search for files by path or content.
- renderMd(markdown): Render markdown with charts to an image. YOU MUST CALL THIS.

Workflow:
1. Explore the repo with listDir to find .gsql files (query definitions) and .md files
2. Read relevant files to understand available data and queries
3. Create a visualization using renderMd - this is required!

renderMd format - create markdown with a SQL code block and a chart component:

# Title

\`\`\`sql mydata
SELECT column1, column2, aggregation
FROM tablename
GROUP BY column1
\`\`\`

<BarChart data={mydata} x="column1" y="aggregation" />

The sql code block defines a query named "mydata" which is then used as the data prop.

Files in this repository:
- .gsql files: Reusable query definitions you can reference
- .md files: Documentation and example pages with queries`

  if (grapheneDocs) {
    base += `\n\n--- Graphene Documentation ---\n${grapheneDocs}`
  }

  if (contextContent) {
    base += `\n\n--- Repository Context ---${contextContent}`
  }

  return base
}
