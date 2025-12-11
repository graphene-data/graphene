import Fastify, {type FastifyPluginAsync} from 'fastify'
import cookie from '@fastify/cookie'
import staticPlugin from '@fastify/static'

import {type AuthContext, authenticate, authTokenExchange} from './auth.ts'
import {renderPage} from './pages.ts'
import {proxyQuery} from './query.ts'
import {fileURLToPath} from 'url'
import path from 'path'

export function createServer (serveStatic: boolean) {
  let app = Fastify({logger: {level: 'warn'}})
  app.register(cookie as unknown as FastifyPluginAsync, {})

  app.decorateRequest('auth', null as unknown as AuthContext)

  app.get('/_api/pages/*', renderPage)
  app.post('/_api/query', proxyQuery)
  app.get('/_api/authenticate', authenticate)
  app.post('/_api/oauth2/token', authTokenExchange)

  if (serveStatic) {
    let root = path.resolve(fileURLToPath(import.meta.url), '../../dist')
    app.register(staticPlugin, {root, wildcard: false})
    app.get('*', (_, reply) => reply.sendFile('index.html'))
  }

  return app
}

let runServer = import.meta.url === `file://${process.argv[1]}`
export const server = createServer(runServer)

if (runServer) {
  await server.listen({port: 3000, host: process.env.HOST ?? '0.0.0.0'})
  console.log('Listening on :3000')
}
