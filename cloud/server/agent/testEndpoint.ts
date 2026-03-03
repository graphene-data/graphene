import type {FastifyReply, FastifyRequest} from 'fastify'
import {runAgent} from './agent.ts'
import {getDb} from '../db.ts'
import {orgId, repoId} from '../dev.ts'
import {renderMd} from './runMd.ts'
import {agentSessions} from '../../schema.ts'

export async function agentTest (req: FastifyRequest, reply: FastifyReply) {
  let q = (req.query as any).q as string
  if (!q) {
    return reply.code(400).send({error: 'Missing q parameter'})
  }

  // Set up streaming response
  reply.raw.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
  })

  // Write HTML preamble
  reply.raw.write(`<!DOCTYPE html>
    <html>
    <head>
      <title>Agent Test: ${escapeHtml(q)}</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; }
        .thinking { background: #f0f7ff; padding: 12px; margin: 8px 0; border-radius: 4px; white-space: pre-wrap; }
        .tool-call { background: #fff3e0; padding: 8px; margin: 8px 0; border-radius: 4px; }
        .tool-call summary { cursor: pointer; font-weight: 500; }
        .tool-call pre { margin: 8px 0; white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow: auto; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 4px; }
        .tool-call .label { font-size: 0.85em; color: #666; margin-top: 12px; margin-bottom: 4px; }
        .tool-call img { max-width: 100%; border: 1px solid #ddd; margin: 8px 0; }
        .error { background: #ffebee; color: #c62828; padding: 12px; margin: 8px 0; border-radius: 4px; }
        h1 { margin-bottom: 8px; }
        .query { color: #666; margin-bottom: 24px; }
      </style>
    </head>
    <body>
    <h1>Agent Test</h1>
    <p class="query">Query: ${escapeHtml(q)}</p>
  `)

  // Track pending tool calls by id so we can pair them with results
  let pendingToolCalls = new Map<string, {name: string, input: string}>()

  try {
    let session = await getDb().insert(agentSessions).values({orgId, repoId, messages: []}).returning().then(rows => rows[0])
    if (!session) throw new Error('Could not create test agent session')
    session.messages.push({
      role: 'user',
      content: [{type: 'text', text: q}],
      type: 'user',
      text: q,
      createdAt: new Date().toISOString(),
    })

    await runAgent(session, (step) => {

      if (step.text) {
        reply.raw.write(`<div class="thinking">${escapeHtml(step.text)}</div>\n`)
      }

      if (step.toolCalls?.length) {
        for (let tc of step.toolCalls) {
          let inputStr = typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input, null, 2)
          pendingToolCalls.set(tc.toolCallId, {name: tc.toolName, input: inputStr})
        }
      }

      if (step.toolResults?.length) {
        for (let tr of step.toolResults) {
          let block = {
            type: 'tool_result',
            tool_use_id: tr.toolCallId,
            content: typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output),
          }
          if (block.type !== 'tool_result') continue

          let toolCall = pendingToolCalls.get(block.tool_use_id)
          pendingToolCalls.delete(block.tool_use_id)

          let toolName = toolCall?.name || 'unknown'
          let toolInput = toolCall?.input || ''

          let result: any
          try {
            result = JSON.parse(block.content)
          } catch {
            result = {output: block.content}
          }

          let resultHtml = ''
          if (result.screenshot) {
            resultHtml += `<img src="data:image/png;base64,${result.screenshot}" alt="Rendered visualization" />\n`
          }

          let displayResult = {...result}
          delete displayResult.screenshot
          if (Object.keys(displayResult).length > 0) {
            let resultStr = toolName === 'readFile' && displayResult.content ? formatReadFileResult(displayResult) : JSON.stringify(displayResult, null, 2)
            resultHtml += `<div class="label">Result:</div><pre>${escapeHtml(resultStr)}</pre>\n`
          }

          let displayInput = toolName === 'renderMd' ? formatRenderMdInput(toolInput) : toolInput
          reply.raw.write(`<details class="tool-call">
<summary>${escapeHtml(toolName)}()</summary>
<div class="label">Input:</div>
<pre>${escapeHtml(displayInput)}</pre>
${resultHtml}
</details>\n`)
        }
      }

    })

    reply.raw.write('<p><strong>Done</strong></p>\n')
  } catch (err: any) {
    reply.raw.write(`<div class="error">Error: ${escapeHtml(err.message || String(err))}</div>\n`)
  }

  reply.raw.end('</body></html>')
}

/** Test endpoint for renderMd in isolation */
export async function testRenderMd (_req: FastifyRequest, reply: FastifyReply) {
  // Simple test markdown with a chart
  let markdown = `
\`\`\`gsql test_data
from flights select carriers.name as carrier_name, count(*) as flight_count
\`\`\`

<BarChart data="test_data" x="carrier_name" y="flight_count" />
`

  let tunnelUrl = (globalThis as any).__GRAPHENE_DEV_NGROK_URL as string | undefined

  try {
    let result = await renderMd(markdown, repoId, tunnelUrl)
    console.log(result)

    let screenshotHtml = result.success
      ? `<div class="success">Success!</div>
<h2>Screenshot</h2>
<img src="data:image/png;base64,${result.screenshot}" alt="Rendered chart" />`
      : `<div class="error">Error: ${escapeHtml(result.error || 'Unknown error')}</div>`

    let html = `<!DOCTYPE html>
<html>
<head>
<title>renderMd Test</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; }
pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow: auto; }
img { max-width: 100%; border: 1px solid #ddd; margin: 12px 0; }
.error { background: #ffebee; color: #c62828; padding: 12px; border-radius: 4px; }
.success { background: #e8f5e9; color: #2e7d32; padding: 12px; border-radius: 4px; }
</style>
</head>
<body>
<h1>renderMd Test</h1>
<h2>Input Markdown</h2>
<pre>${escapeHtml(markdown)}</pre>
<h2>Result</h2>
${screenshotHtml}
<h2>Full Response</h2>
<pre>${escapeHtml(JSON.stringify({...result, screenshot: result.screenshot ? '(base64 data)' : undefined}, null, 2))}</pre>
<h2>Debug Info</h2>
<pre>${escapeHtml(JSON.stringify({tunnelUrl: tunnelUrl || 'none', awsRegion: process.env.AWS_REGION || 'us-east-1 (default)', lambdaFunction: process.env.SCREENSHOT_LAMBDA_ARN || 'graphene-screenshot (default)', hasAwsCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)}, null, 2))}</pre>
</body>
</html>`

    reply.type('text/html').send(html)
  } catch (err: any) {
    reply.type('text/html').send(`<!DOCTYPE html>
<html>
<head><title>renderMd Test Error</title></head>
<body>
  <h1>Error</h1>
  <pre>${escapeHtml(err.stack || err.message || String(err))}</pre>
</body>
</html>`)
  }
}

/** Format readFile result so the file content displays with real newlines */
function formatReadFileResult (result: {content: string}): string {
  return result.content
}

/** Format renderMd input so the markdown displays with real newlines */
function formatRenderMdInput (inputStr: string): string {
  try {
    let parsed = JSON.parse(inputStr)
    if (parsed.markdown) return parsed.markdown
  } catch { /* not JSON, use as-is */ }
  return inputStr
}

function escapeHtml (str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
