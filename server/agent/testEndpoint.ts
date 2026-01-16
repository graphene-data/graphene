import type {FastifyReply, FastifyRequest} from 'fastify'
import {runAgent} from './agent.ts'
import {orgId, repoId} from '../dev.ts'
import {renderMd} from './runMd.ts'

export async function agentTest (req: FastifyRequest, reply: FastifyReply) {
  let tc = `
    {
            type: 'tool_use',
            id: 'toolu_01KiN8iR2aiiDZxcDz7UX3vw',
            name: 'renderMd',
            input: {
              markdown: '# Average Number of Flights Per Year\n' +
                '\n' +
                'This analysis shows the total flights by year and calculates the average across all years in the dataset (2000-2005).\n' +
                '\n' +
                '\`\`\`sql flights_by_year\n' +
                'SELECT \n' +
                '  extract(year from dep_time) as year,\n' +
                '  count(*) as total_flights\n' +
                'FROM flights\n' +
                'WHERE dep_time IS NOT NULL\n' +
                'GROUP BY extract(year from dep_time)\n' +
                'ORDER BY year\n' +
                '\`\`\`\n' +
                '\n' +
                '\`\`\`sql average_flights\n' +
                'SELECT \n' +
                '  avg(total_flights) as avg_flights_per_year\n' +
                'FROM flights_by_year\n' +
                '\`\`\`\n' +
                '\n' +
                '<BarChart data={flights_by_year} x="year" y="total_flights" title="Total Flights by Year" yFmt="num0" />\n' +
                '\n' +
                '<BigValue data={average_flights} value="avg_flights_per_year" title="Average Flights Per Year" fmt="num0" />'
            }
  `
  let tool = await renderMd(tc, repoId)
  return reply.send(JSON.stringify(tool))


  let q = (req.query as any).q as string
  if (!q) {
    return reply.code(400).send({error: 'Missing q parameter'})
  }

  let messages: string[] = []
  let screenshots: string[] = []

  await runAgent(q, repoId, orgId, (msg) => {
    console.dir(msg, {depth: null})
    if (msg.type === 'assistant' && msg.message?.content) {
      for (let block of msg.message.content) {
        if (block.type === 'text' && block.text) {
          messages.push(block.text)
        }
      }
    }
    if (msg.type === 'user' && msg.message?.content) {
      for (let block of msg.message.content) {
        if (block.type === 'tool_result') {
          let result = JSON.parse(block.content)
          if (result.screenshot) {
            screenshots.push(result.screenshot)
          }
        }
      }
    }
  })

  let html = `<!DOCTYPE html>
<html>
<head>
  <title>Agent Test</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    .message { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; white-space: pre-wrap; }
    img { max-width: 100%; border: 1px solid #ddd; margin: 20px 0; }
    h1 { color: #333; }
    .query { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <h1>Agent Response</h1>
  <p class="query">Query: ${escapeHtml(q)}</p>
  ${messages.map(m => `<div class="message">${escapeHtml(m)}</div>`).join('\n  ')}
  ${screenshots.map(s => `<img src="data:image/png;base64,${s}" />`).join('\n  ')}
</body>
</html>`

  reply.type('text/html')
  reply.send(html)
}

function escapeHtml (str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
