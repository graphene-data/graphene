import {registerAppResource, registerAppTool, RESOURCE_MIME_TYPE} from '@modelcontextprotocol/ext-apps/server'
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import type {CallToolResult, ReadResourceResult} from '@modelcontextprotocol/sdk/types.js'
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {type FastifyReply, type FastifyRequest, type FastifyInstance} from 'fastify'
import fs from 'node:fs/promises'
import path from 'node:path'
import {z} from 'zod'
import {compileMd} from './pages.ts'
import {proxyQuery, type QueryBody} from './query.ts'
import {listDirTool, readFileTool, type SharedTool} from './agent/tools.ts'
import {getDb} from './db.ts'
import {eq} from 'drizzle-orm'
import {repos} from '../schema.ts'

const resourceUri = 'ui://tool-playground/mcp-app.html'

export function registerMcpServer(app: FastifyInstance) {
  app.route({method: ['GET', 'POST', 'DELETE'], url: '/_api/mcp', handler: handleMcpRequest})
}

async function handleMcpRequest(req: FastifyRequest, reply: FastifyReply) {
  req.auth = {orgId: 'organization-test-fe0fbae3-a479-4b60-8e80-7a76e76cc35d'} as any

  let server = new McpServer({name: 'Graphene MCP', version: '1.0.0'})
  let transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined})

  let repo = await getDb().query.repos.findFirst({where: eq(repos.orgId, req.auth.orgId)})
  if (!repo) throw new Error('Missing repo for org')

  reply.raw.once('close', () => {
    void server.close()
    void transport.close()
  })

  registerSharedTool(server, repo.id, listDirTool)
  registerSharedTool(server, repo.id, readFileTool)

  registerAppTool(
    server,
    'render-md',
    {
      title: 'Render Markdown',
      description: 'Takes in markdown and displays it to the user',
      inputSchema: z.object({markdown: z.string().describe('Markdown content to render')}),
      outputSchema: z.object({compiled: z.string()}),
      _meta: {ui: {resourceUri}},
    },
    async ({markdown}): Promise<CallToolResult> => {
      let compiled = await compileMd(markdown, 'dynamic.md', '1')
      return {
        content: [{type: 'text', text: 'Returned code for viewing'}],
        structuredContent: {compiled},
      }
    },
  )

  server.registerTool('run-query', {
    description: 'Runs a query with optional params and returns results',
    inputSchema: z.object({
      gsql: z.string().describe('GSQL query to execute'),
      params: z.record(z.string(), z.any()).optional(),
    }),
    _meta: {},
  }, async (body): Promise<CallToolResult> => {
    try {
      let res = await proxyQuery('organization-test-fe0fbae3-a479-4b60-8e80-7a76e76cc35d', body as QueryBody)
      return {
        content: [{type: 'text', text: 'Query results'}],
        structuredContent: res as any,
      }
    } catch (e: any) {
      let err = e?.cause || e
      return {
        isError: true,
        content: [{type: 'text', text: err?.message || 'Query error'}],
        structuredContent: err,
      }
    }
  })

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

function registerSharedTool(server: McpServer, repoId: string, tool: SharedTool) {
  registerAppTool(server, tool.name, {
    description: tool.description,
    inputSchema: tool.inputSchema,
    _meta: {},
  }, async (args: any) => {
    return await tool.fn(repoId, args)
  })
}
