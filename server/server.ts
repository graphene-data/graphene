import Fastify, {type FastifyPluginAsync} from 'fastify'
import cookie from '@fastify/cookie'
import staticPlugin from '@fastify/static'

import {type AuthContext, authTokenExchange} from './auth.ts'
import {listNavFiles, renderPage} from './pages.ts'
import {proxyQuery} from './query.ts'
import {githubInstall, githubSetup, listAvailableRepos, addRepo, removeRepo, githubWebhook} from './github.ts'
import {fileURLToPath} from 'url'
import path from 'path'

export function createServer (serveStatic: boolean) {
  let app = Fastify({logger: {level: 'warn'}})
  app.register(cookie as unknown as FastifyPluginAsync, {})

  app.decorateRequest('auth', null as unknown as AuthContext)

  app.get('/_api/nav/:repoSlug', listNavFiles)
  app.get('/_api/pages/*', renderPage)
  app.post('/_api/query', proxyQuery)
  app.post('/_api/oauth2/token', authTokenExchange)

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

let runServer = import.meta.url === `file://${process.argv[1]}`
export const server = createServer(runServer)

if (runServer) {
  await server.listen({port: 3000, host: process.env.HOST ?? '0.0.0.0'})
  console.log('Listening on :3000')
}
