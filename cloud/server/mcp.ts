import {registerAppResource, registerAppTool, RESOURCE_MIME_TYPE} from '@modelcontextprotocol/ext-apps/server'
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import type {CallToolResult, ReadResourceResult} from '@modelcontextprotocol/sdk/types.js'
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {type FastifyReply, type FastifyRequest, type FastifyInstance} from 'fastify'
import fs from 'node:fs/promises'
import path from 'node:path'
import {z} from 'zod'

const resourceUri = 'ui://tool-playground/mcp-app.html'

export function registerMcpServer(app: FastifyInstance) {
  app.route({method: ['GET', 'POST', 'DELETE'], url: '/_api/mcp', handler: handleMcpRequest})
}

async function handleMcpRequest (req: FastifyRequest, reply: FastifyReply) {
  let server = new McpServer({name: 'Graphene MCP', version: '1.0.0'})
  let transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined})

  reply.raw.once('close', () => {
    void server.close()
    void transport.close()
  })

  registerAppTool(
    server,
    'roll-dice',
    {
      title: 'Roll Dice',
      description: 'Rolls a die with N sides and returns the random result.',
      inputSchema: {sides: z.number().int().min(2).max(1000).default(20)},
      outputSchema: z.object({sides: z.number(), value: z.number()}),
      _meta: {ui: {resourceUri}},
    },
    async ({sides = 20}): Promise<CallToolResult> => {
      let value = Math.floor(Math.random() * sides) + 1
      return {
        content: [{type: 'text', text: `Rolled 1-${sides}: ${value}`}],
        structuredContent: {sides, value},
      }
    },
  )

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    {mimeType: RESOURCE_MIME_TYPE},
    async (): Promise<ReadResourceResult> => {
      let html = await fs.readFile(path.join(import.meta.dirname, '../distMcp/frontend/mcp.html'), 'utf-8')
      return {contents: [{uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html}]}
    },
  )

  reply.raw.setHeader('Vary', 'Origin')
  reply.raw.setHeader('Access-Control-Allow-Origin', '*')
  reply.raw.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  reply.raw.setHeader('Access-Control-Allow-Headers', '*')
  reply.raw.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate, MCP-Session-Id')


  await server.connect(transport)
  await transport.handleRequest(req.raw, reply.raw, req.body)
  reply.hijack() // sdk wants to write to the reply directly
}
