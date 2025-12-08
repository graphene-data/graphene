import Fastify, {type FastifyPluginAsync} from 'fastify'
import cookie from '@fastify/cookie'

import {authTokenExchange, checkAuth} from './auth.ts'
import {renderPage} from './pages.ts'
import {proxyQuery} from './query.ts'

export function createServer () {
  let app = Fastify({logger: {level: 'warn'}})
  app.register(cookie as unknown as FastifyPluginAsync, {})

  app.decorateRequest('auth', null)
  app.addHook('onRequest', checkAuth)

  app.get('/_api/pages/:slug', renderPage)
  app.post('/_api/query', proxyQuery)
  app.post('/_api/oauth2/token', authTokenExchange)

  return app
}

export const server = createServer()

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen({port: 3000, host: process.env.HOST ?? '0.0.0.0'})
}
