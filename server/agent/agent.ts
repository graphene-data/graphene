import {generateText, stepCountIs} from 'ai'
import {anthropic} from '@ai-sdk/anthropic'
import {eq, or, like} from 'drizzle-orm'
import {getDb} from '../db.ts'
import {files} from '../../schema.ts'
import {listDirTool, readFileTool, searchTool, renderMdTool} from './tools.ts'

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
      renderMd: renderMdTool(orgId, repoId),
    },
    stopWhen: stepCountIs(10),
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
  let base = `You are a helpful data analyst assistant for Graphene, a data visualization platform.
You have access to tools to explore files in the user's repository and help them understand their data.

Available tools:
- listDir(path): List files and directories at a path. Use "" for root.
- readFile(path): Read the contents of a file.
- search(query): Search for files containing a string in their path or content.
- renderMd(markdown): Render markdown with embedded charts to an image.

When the user asks a question:
1. First explore the repository structure using listDir
2. Read relevant files to understand the data models and queries
3. Provide clear, helpful answers based on what you find

Files in this repository use:
- .md files: Markdown documentation and pages with embedded queries
- .gsql files: Graphene SQL query definitions`

  if (contextContent) {
    base += `\n\n--- Repository Context ---${contextContent}`
  }

  return base
}
