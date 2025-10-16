import path from 'node:path'
import {fileURLToPath} from 'node:url'
import type {AddressInfo} from 'node:net'

import {createServer as createViteServer, type ViteDevServer} from 'vite'
import middie from '@fastify/middie'
import dotenv from 'dotenv'

import {createServer} from './server.ts'
import {seedDb, type SeedOptions, type SeedResult} from './seed.ts'
import {setAuthOverride} from './auth.ts'

type AuthContext = {userId: string | null, orgId: string | null}

export interface StartOptions {
  port?: number
  host?: string
  seed?: boolean
  seedOptions?: SeedOptions
  authOverride?: AuthContext | null
  viteEnv?: Record<string, string>
}

export interface CloudServerHandle {
  fastify: ReturnType<typeof createServer>
  vite: ViteDevServer
  port: number
  url: string
  seed?: SeedResult
  close: () => Promise<void>
}

export async function startCloudServer (options: StartOptions = {}): Promise<CloudServerHandle> {
  let rootDir = path.resolve(fileURLToPath(import.meta.url), '../..')
  dotenv.config({path: path.join(rootDir, '../.env'), quiet: true})

  if (options.viteEnv) for (let [key, value] of Object.entries(options.viteEnv)) process.env[key] = value

  let fastify = createServer()
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

  let seedResult: SeedResult | undefined
  if (options.seed !== false) {
    let inMemory = process.env.NODE_ENV === 'test'
    seedResult = await seedDb({rootDir, inMemory, ...options.seedOptions})
  }

  if (process.env.NODE_ENV === 'test') setAuthOverride(options.authOverride ?? null)

  let host = options.host ?? '127.0.0.1'
  let requestedPort = options.port ?? 0
  await fastify.listen({port: requestedPort, host})
  let address = fastify.server.address() as AddressInfo
  let port = address?.port ?? requestedPort
  let displayHost = host === '0.0.0.0' ? '127.0.0.1' : host
  let url = `http://${displayHost}:${port}`

  return {
    fastify,
    vite,
    port,
    url,
    seed: seedResult,
    close: async () => {
      if (process.env.NODE_ENV === 'test') setAuthOverride(null)
      await fastify.close()
      await vite.close()
    },
  }
}
