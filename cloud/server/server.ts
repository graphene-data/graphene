import fastify, {type FastifyLoggerOptions} from 'fastify'
import cookie from '@fastify/cookie'
import staticPlugin from '@fastify/static'
import rawBody from 'fastify-raw-body'
import {fileURLToPath} from 'url'
import path from 'path'
import {type AuthContext, auth, authTokenExchange} from './auth.ts'
import {listNavFiles, renderPage, renderDynamic, renderDynamicModule} from './pages.ts'
import {getChatSession} from './chats.ts'
import {proxyQuery} from './query.ts'
import {githubInstall, githubSetup, listAvailableRepos, addRepo, removeRepo, githubWebhook} from './github.ts'
import {slackEvents, slackInstall, slackOauthCallback, slackStatus} from './slack.ts'


export function createServer(serveStatic: boolean, logger: FastifyLoggerOptions = {level: 'warn'}) {
  let app = fastify({logger})
  app.register(cookie, {})
  app.register(rawBody, {global: false, runFirst: true, encoding: 'utf8'})

  app.decorateRequest('auth', null as unknown as AuthContext)
  app.addHook('preHandler', async(req, reply) => {
    let route = req.routeOptions.url
    if (!route || !route.startsWith('/_api')) return
    if (route === '/_api/github/webhook') return
    if (route === '/_api/slack/events') return
    if (route === '/_api/oauth2/token') return
    await auth(req, reply)
  })

  app.get('/_health', () => ({ok: true}))

  app.get('/_api/nav/:repoSlug', listNavFiles)
  app.get('/_api/chats/:id', getChatSession)
  app.get('/_api/pages/*', renderPage)
  app.get('/_api/dynamic', renderDynamic)
  app.get('/_api/dynamic/module', renderDynamicModule)
  app.post('/_api/query', proxyQuery)
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
