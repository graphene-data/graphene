import dotenv from 'dotenv'
import net from 'net'
import path from 'path'
import {fileURLToPath} from 'url'

let __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({path: path.resolve(__dirname, '../../.env'), quiet: true})

let {startDevServer, orgId, repoId} = await import('../server/dev.ts')
let {setupPglite, getDb} = await import('../server/db.ts')
let {runAgent} = await import('../server/agent/agent.ts')
let {agentSessions} = await import('../schema.ts')

let [firstPrompt, secondPrompt] = process.argv.slice(2)
if (!firstPrompt) {
  console.error('Usage: pnpm agent:cli "first question" "second question (optional, resume test)"')
  process.exit(1)
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in environment')
  process.exit(1)
}

try {
  let port = await getAvailablePort()
  await setupPglite(port)
  let devPort = await getAvailablePort()
  let server = await startDevServer({realAuth: false, port: devPort, project: 'flights'})
  try {
    let db = getDb()
    let session = await db.insert(agentSessions).values({
      orgId,
      repoId,
      messages: [{
        role: 'user',
        content: [{type: 'text', text: firstPrompt}],
        type: 'user',
        text: firstPrompt,
        createdAt: new Date().toISOString(),
      }],
    }).returning().then(rows => rows[0])

    if (!session) throw new Error('Failed to create session')

    console.log(`Session: ${session.id}`)
    console.log(`Dev server: ${server.url}`)
    console.log(`\n[turn 1 user]\n${firstPrompt}`)

    let result = await runTurn(session)

    if (secondPrompt) {
      console.log(`\n[turn 2 user]\n${secondPrompt}`)
      session.messages.push({
        role: 'user',
        content: [{type: 'text', text: secondPrompt}],
        type: 'user',
        text: secondPrompt,
        createdAt: new Date().toISOString(),
      })
      result = await runTurn(session)
    }

    console.log('\n=== Final Response ===')
    console.log(result.text || '(empty)')
    console.log('\n=== Usage ===')
    console.log(JSON.stringify(result.usage, null, 2))
  } finally {
    await server.close()
  }
  process.exit(0)
} catch (err: any) {
  console.error(err?.stack || err?.message || String(err))
  process.exit(1)
}

async function runTurn (session: any) {
  return await runAgent(session, (step) => {
    if (step.text) console.log(`\n[assistant]\n${step.text}`)
    if (step.toolCalls?.length) {
      for (let tc of step.toolCalls) {
        console.log(`\n[tool_call] ${tc.toolName}`)
        console.log(JSON.stringify(tc.input, null, 2))
      }
    }
    if (step.toolResults?.length) {
      for (let tr of step.toolResults) {
        console.log(`\n[tool_result] ${tr.toolName}`)
        console.log(typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output, null, 2))
      }
    }
  })
}

async function getAvailablePort (): Promise<number> {
  return await new Promise((resolve, reject) => {
    let srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      let {port} = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
  })
}
