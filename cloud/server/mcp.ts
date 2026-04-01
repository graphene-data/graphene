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
import {origin} from './utils.ts'
import {compileMd} from './pages.ts'
import {proxyQuery, type QueryBody} from './query.ts'
import {fileURLToPath} from 'node:url'
import {readFileSync} from 'node:fs'

// # Manual testing
// * chatGPT with developer mode


const resourceUri = 'ui://tool-playground/mcp-app.html'

export function registerMcpServer(app: FastifyInstance) {
  let config = {cors: {origin: '*'}}
  app.options('/_api/mcp', {config}, (_req, reply) => reply.code(204).send())
  app.route({method: ['GET', 'POST', 'DELETE'], url: '/_api/mcp', config, handler: handleMcpRequest})
  app.route({method: ['GET', 'OPTIONS'], config, url: '/.well-known/*', handler: wellKnown})
}

// MCP wants a ton of these well-known paths to provide bits of data for OAuth
function wellKnown(req: FastifyRequest, reply: FastifyReply) {
  let route = (req.params as any)['*']
  if (req.method == 'OPTIONS') return reply.code(204).send()
  let ori = origin(req)

  let authMeta = {
    issuer: ori,
    authorization_endpoint: `${ori}/authenticate`,
    token_endpoint: `${ori}/_api/oauth2/token`,
    registration_endpoint: `${ori}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['offline_access'],
  }

  switch (route) {
    case 'oauth-protected-resource':
    case 'oauth-protected-resource/_api/mcp':
      return reply.type('application/json').send({
        resource: `${ori}/_api/mcp`,
        authorization_servers: [ori],
        scopes_supported: ['offline_access'],
        bearer_methods_supported: ['header'],
      })
    case 'oauth-authorization-server':
      return reply.type('application/json').send(authMeta)
    case 'openid-configuration':
      return reply.type('application/json').send({
        ...authMeta,
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
      })
    default:
      reply.status(404).send('Not found')
  }
}

// Actually handle MCP requests. This is called for every tool call, as well as some status notifications
// We're using the MCP SDK server to start with, though I don't love that it's a bit of a black box
async function handleMcpRequest(req: FastifyRequest, reply: FastifyReply) {
  // tmp hack for testing before we add auth
  req.auth = {orgId: 'organization-test-fe0fbae3-a479-4b60-8e80-7a76e76cc35d'} as any

  let repo = await getDb().query.repos.findFirst({where: eq(repos.orgId, req.auth.orgId)})
  if (!repo) throw new Error('Missing repo for org')

  // This feels incrediblely wasteful to do for each request, but that's what the MCP examples do,
  // and it's not clear to be how stateful the server is, and if it will leak stuff when shared.
  let server = createServer(repo.id)
  let transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined})

  reply.raw.setHeader('Vary', 'Origin')
  reply.raw.setHeader('Access-Control-Allow-Origin', '*')
  reply.raw.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  reply.raw.setHeader('Access-Control-Allow-Headers', '*')
  reply.raw.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate, MCP-Session-Id')

  await server.connect(transport)
  await transport.handleRequest(req.raw, reply.raw, req.body)
  reply.hijack() // sdk wants to write to the reply directly

  reply.raw.once('close', () => {
    void server.close()
    void transport.close()
  })
}

// Creates a new McpServer instance, and attaches all the tools/resources we want to expose.
function createServer(repoId: string): McpServer {
  let server = new McpServer({name: 'Graphene MCP', version: '1.0.0'})
  registerSharedTool(server, repoId, listDirTool)
  registerSharedTool(server, repoId, readFileTool)

  registerSharedTool(server, repoId, {
    name: 'render-md',
    description: 'Takes in markdown and displawhat ys it to the user',
    inputSchema: z.object({markdown: z.string().describe('Markdown content to render')}),
    outputSchema: z.object({compiled: z.string()}),
    _meta: {ui: {resourceUri}},
    fn: async function renderMd(_repoId, {markdown}) {
      let compiled = await compileMd(markdown, 'dynamic.md', '1')
      return {compiled}
    },
  })

  registerSharedTool(server, repoId, {
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

  registerSharedTool(server, repoId, {
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

  return server
}

// Converts our own `SharedTool` into the MCP-specific format.
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
