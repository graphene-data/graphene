import {seedDatabase, orgId, repoId} from '../server/dev.ts'
import {runAgent} from '../server/agent/agent.ts'

async function main () {
  let prompt = process.argv[2] || 'Which airports have the worst delays?'

  console.log('Seeding database...')
  await seedDatabase('duckdb')

  console.log('\nRunning agent with prompt:', prompt)
  console.log('---\n')

  let messages: any[] = []
  await runAgent(prompt, repoId, orgId, (msg) => {
    messages.push(msg)
    if (msg.type === 'assistant' && msg.message?.content) {
      for (let chunk of msg.message.content) {
        if (chunk.type === 'text') {
          console.log('ASSISTANT:', chunk.text)
        } else if (chunk.type === 'tool_use') {
          console.log(`TOOL CALL [${chunk.name}]:`, JSON.stringify(chunk.input))
        }
      }
    } else if (msg.type === 'user' && msg.message?.content) {
      for (let chunk of msg.message.content) {
        if (chunk.type === 'tool_result') {
          let content = chunk.content
          if (content.length > 500) content = content.slice(0, 500) + '...'
          console.log('TOOL RESULT:', content)
        }
      }
    }
  })

  console.log('\n---')
  console.log('Agent completed with', messages.length, 'messages')
}

main().catch(console.error)
