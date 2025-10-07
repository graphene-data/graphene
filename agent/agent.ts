import {query, type PermissionResult} from '@anthropic-ai/claude-code'
import {type IncomingMessage, type ServerResponse} from 'http'
import fs from 'fs-extra'
import path from 'path'
import {fileURLToPath} from 'url'

export async function handleAgentRequest (req: IncomingMessage, res: ServerResponse<IncomingMessage>, grapheneRoot: string) {
  let chunks = [] as any[]
  for await (let chunk of req) chunks.push(chunk)
  let {prompt: inputPrompt, sessionId, targetFile} = JSON.parse(Buffer.concat(chunks).toString())
  res.setHeader('Content-Type', 'application/json')

  if (inputPrompt == 'mock') {
    let mod = await import('./mock.ts')
    for (let msg of mod.MockMessages) {
      res.write(JSON.stringify(msg) + '\n')
      await new Promise(r => setTimeout(r, 50))
    }
    return res.end()
  }

  let grapheneDocs = await fs.readFile(path.join(fileURLToPath(import.meta.url), '../../docs/graphene.md'))

  let done: any // see https://github.com/anthropics/claude-code/issues/4775
  let finishedPromise = new Promise(resolve => done = resolve)
  let prompt = (async function* () {
    yield {type: 'user', message: {role: 'user', content: inputPrompt}} as any
    await finishedPromise
  })()

  let appendSystemPrompt = `
    You are a Graphene data analysis expert.

    ${targetFile ?
    `You are currently working on the file: ${targetFile}. Do not edit any other files.` :
    'You should create a new markdown file with a descriptive name. Once you\'ve created a file, you should only continue to edit that file, and not create any others.'}

    You can search for any gsql or md files below the current directory, but don't search outside this project, or look in node_modules.

    If the user asks for something simple, keep the md simple. Don't go building complex things they didn't ask for.

    Here's a brief overview on how to use Graphene:
    ${grapheneDocs}
  `

  // let extraArgs = {'input-format': 'stream-json'}
  let q = query({prompt, options: {
    canUseTool,
    appendSystemPrompt,
  }})

  for await (let msg of q) {
    console.dir(msg, {depth: null})
    if (msg.type === 'result') done()
    res.write(JSON.stringify(msg) + '\n')
  }

  res.end()
}

async function canUseTool (toolName: string, input: any): Promise<PermissionResult> {
  console.log('canUseTool', toolName, input)
  await Promise.resolve()
  return {behavior: 'allow', updatedInput: input}
}
