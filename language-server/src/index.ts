import {createServer, createConnection, createSimpleProject} from '@volar/language-server/node.js'

import {createGrapheneService} from './service.ts'

let connection = createConnection()
let server = createServer(connection)

connection.listen()

connection.onInitialize(params => {
  return server.initialize(params, createSimpleProject([]), [createGrapheneService(server)])
})

connection.onInitialized(async () => {
  server.initialized()
})
connection.onShutdown(server.shutdown)
