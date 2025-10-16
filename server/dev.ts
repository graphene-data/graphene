import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer as createViteServer} from 'vite'
import dotenv from 'dotenv'
import middie from '@fastify/middie'

import {createServer, server as defaultServer} from './server.ts'
import {seedDb} from './seed.ts'

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..')
dotenv.config({path: path.join(rootDir, '../.env'), quiet: true})

export interface DevServerHandle {
  fastify: ReturnType<typeof createServer>
  vite: Awaited<ReturnType<typeof createViteServer>>
  close: () => Promise<void>
}

export async function startDevServer (options: {port?: number, host?: string, useDefaultServer?: boolean} = {}): Promise<DevServerHandle> {
  let port = options.port ?? 3000
  let host = options.host ?? process.env.HOST ?? '0.0.0.0'

  let fastify = options.useDefaultServer ? defaultServer : createServer()
  await fastify.register(middie, {hook: 'onRequest'})

  let vite = await createViteServer({
    root: path.join(rootDir, 'frontend'),
    configFile: path.join(rootDir, 'frontend/vite.config.ts'),
    server: {middlewareMode: true},
  })

  fastify.use((req, res, next) => {
    if (req.url.startsWith('/_api')) next()
    else vite.middlewares(req, res, next)
  })

  await seedDb({rootDir})
  await fastify.listen({port, host})

  console.log(`Listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`)

  return {
    fastify,
    vite,
    close: async () => {
      await fastify.close()
      await vite.close()
    },
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startDevServer({useDefaultServer: true})
}
