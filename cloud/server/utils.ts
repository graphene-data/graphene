import {type FastifyRequest} from 'fastify'

export function origin(req: FastifyRequest) {
  let proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
  let host = req.headers['x-forwarded-host'] || req.headers.host || req.hostname
  return `${proto}://${host}`
}
