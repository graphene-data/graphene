import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import staticPlugin from '@fastify/static'
import fastify, {type FastifyLoggerOptions} from 'fastify'
import rawBody from 'fastify-raw-body'
import path from 'path'
import {fileURLToPath} from 'url'

import {type AuthContext, auth, authTokenExchange} from './auth.ts'
import {getChatSession} from './chats.ts'
import {githubInstall, githubSetup, listAvailableRepos, addRepo, removeRepo, githubWebhook} from './github.ts'
import {listNavFiles, renderPage, renderDynamicModule} from './pages.ts'
import {queryEndpoint} from './query.ts'
import {slackEvents, slackInstall, slackOauthCallback, slackStatus} from './slack.ts'
import {registerMcpServer} from './mcp.ts'

export function createServer(serveStatic: boolean, logger: FastifyLoggerOptions = {level: 'warn'}) {
  let app = fastify({logger})
  app.register(cookie, {})
  app.register(formbody)
  app.register(cors) // TODO scope this down to just the right endpoints
  app.register(rawBody, {global: false, runFirst: true, encoding: 'utf8'})

  app.decorateRequest('auth', null as unknown as AuthContext)
  app.addHook('preHandler', async (req, reply) => {
    let route = req.routeOptions.url
    if (!route || !route.startsWith('/_api')) return
    if (route === '/_api/mcp') return
    if (route === '/_api/github/webhook') return
    if (route === '/_api/slack/events') return
    if (route === '/_api/oauth2/token') return
    if (route === '/_api/dev/ngrok-url') return
    await auth(req, reply)
  })

  app.get('/_health', () => ({ok: true}))
  registerMcpServer(app)

  app.get('/_api/nav/:repoSlug', listNavFiles)
  app.get('/_api/chats/:id', getChatSession)
  app.get('/_api/pages/*', renderPage)
  app.get('/_api/dynamic/module', renderDynamicModule)
  app.post('/_api/query', queryEndpoint)
  app.post('/_api/oauth2/token', authTokenExchange)
  app.get('/_api/slack/install', slackInstall)
  app.get('/_api/slack/status', slackStatus)
  app.get('/_api/slack/oauth/callback', slackOauthCallback)
  app.post('/_api/slack/events', {config: {rawBody: true}}, slackEvents)

  // GitHub App integration
  app.get('/_api/github/install', githubInstall)
  app.get('/_api/github/setup', githubSetup)
  app.get('/_api/github/repos', listAvailableRepos)
  app.post('/_api/github/repos', addRepo)
  app.delete('/_api/repos/:id', removeRepo)
  app.post('/_api/github/webhook', githubWebhook)

  if (serveStatic) {
    let root = path.resolve(fileURLToPath(import.meta.url), '../../dist')
    app.register(staticPlugin, {root, wildcard: false})
    app.get('*', (_, reply) => (reply as any).sendFile('index.html'))
  }

  return app
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer(true).listen({port: 3000, host: process.env.HOST ?? '0.0.0.0'})
  console.log('Listening on :3000')
}
