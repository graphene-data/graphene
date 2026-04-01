import type {CallToolResult, ReadResourceResult} from '@modelcontextprotocol/sdk/types.js'

import {registerAppResource, registerAppTool, RESOURCE_MIME_TYPE} from '@modelcontextprotocol/ext-apps/server'
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {eq} from 'drizzle-orm'
import {type FastifyReply, type FastifyRequest, type FastifyInstance} from 'fastify'
import fs from 'node:fs/promises'
import path from 'node:path'
import {z} from 'zod'

import {repos} from '../schema.ts'
import {listDirTool, readFileTool, type SharedTool} from './agent/tools.ts'
import {getDb} from './db.ts'
import {compileMd} from './pages.ts'
import {proxyQuery, type QueryBody} from './query.ts'
import {fileURLToPath} from 'node:url'
import {readFileSync} from 'node:fs'

const resourceUri = 'ui://tool-playground/mcp-app.html'

export function registerMcpServer(app: FastifyInstance) {
  app.route({method: ['GET', 'POST', 'DELETE'], url: '/_api/mcp', handler: handleMcpRequest})
}

async function handleMcpRequest(req: FastifyRequest, reply: FastifyReply) {
  // tmp hack for testing before we add auth
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

  registerSharedTool(server, repo.id, {
    name: 'render-md',
    description: 'Takes in markdown and displays it to the user',
    inputSchema: z.object({markdown: z.string().describe('Markdown content to render')}),
    outputSchema: z.object({compiled: z.string()}),
    _meta: {ui: {resourceUri}},
    fn: async function renderMd(_repoId, {markdown}) {
      let compiled = await compileMd(markdown, 'dynamic.md', '1')
      return {compiled}
    },
  })

  registerSharedTool(server, repo.id, {
    name: 'run-query',
    description: 'Runs a query with optional params and returns results',
    inputSchema: z.object({
      gsql: z.string().describe('GSQL query to execute'),
      params: z.record(z.string(), z.any()).optional(),
    }),
    fn: async function runQuery(repoId, body: QueryBody) {
      return await proxyQuery('organization-test-fe0fbae3-a479-4b60-8e80-7a76e76cc35d', {...body, repoId})
    },
  })

  registerSharedTool(server, repo.id, {
    name: 'read-docs',
    description: 'Describes how to use Graphene tools. You must run this once before using any Graphene tools',
    inputSchema: z.object(),
    fn: function readDocs() {
      return mcpDocs
    },
  })

  registerAppResource(server, resourceUri, resourceUri, {mimeType: RESOURCE_MIME_TYPE}, async (): Promise<ReadResourceResult> => {
    let html = await fs.readFile(path.join(import.meta.dirname, '../distMcp/frontend/mcp.html'), 'utf-8')
    return {contents: [{uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html}]}
  })

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
  registerAppTool(
    server,
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
      _meta: tool._meta || {},
    },
    async (args: any): Promise<CallToolResult> => {
      let res = await tool.fn(repoId, args)
      if (res && typeof res === 'object' && Array.isArray((res as any).content)) return res as CallToolResult

      // the mcp spec requires results to be an object
      let structuredContent = res && typeof res === 'object' && !Array.isArray(res) ? res : {result: res}
      return {
        content: [{type: 'text', text: 'Tool result'}],
        structuredContent,
      }
    },
  )
}

// Read Graphene documentation at module load time
const __dirname = path.dirname(fileURLToPath(import.meta.url))
let grapheneDocs = readFileSync(path.resolve(__dirname, '../../core/docs/base.md'), 'utf-8')

const mcpDocs = `
Graphene is a tool for doing data analysis where both schema and analyses are stored as files.
Use list-dir to navigate the filesystem for files relevant to the user's question.
read-file can read the contents of files.
render-md allows you to both run a query and visualize the results to the user.

${grapheneDocs}
`.trim()
