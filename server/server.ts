import Fastify from 'fastify'
import cookie from '@fastify/cookie'

import {checkAuth} from './auth.ts'
import {renderPage} from './pages.ts'
import { proxyQuery } from './query.ts'
// import {registerPages} from './pages.ts'
// import {registerQuery} from './query.ts'

// let logger = process.env.NODE_ENV === 'production' ? {level: 'info'} : true
// let db = getDb()

export function createServer () {
  let app = Fastify({logger: {level: 'warn'}})
  app.register(cookie, {})

  app.decorateRequest('auth', null)
  app.addHook('onRequest', checkAuth)
  // app.register(authPlugin)

  // app.get('/healthz', () => ({status: 'ok'}))

  app.get('/_api/pages/:slug', renderPage)
  app.post('/_api/query', proxyQuery)

  return app
}

export const server = createServer()

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen({port: 3000, host: process.env.HOST ?? '0.0.0.0'})
}
