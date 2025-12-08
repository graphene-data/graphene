// import {type IncomingMessage, type ServerResponse} from 'http'
// import {handleAgentRequest} from '../agent/agent'

// // Script for running our agent via the cli, useful for debugging
// let mockReq = {
//   [Symbol.asyncIterator]: async function* () {
//     yield Buffer.from(JSON.stringify({
//       prompt: process.argv[2] || 'Show me delays by carrier',
//       sessionId: null,
//       targetFile: process.argv[3] || null,
//     }))
//   },
// }

// let mockRes = {
//   write: (data: string) => {
//     console.dir(JSON.parse(data), {depth: null})
//   },
//   end: () => {},
// }

// // Call the handler with mocked objects
// handleAgentRequest(mockReq as IncomingMessage, mockRes as unknown as ServerResponse<IncomingMessage>, process.cwd())
//   .catch(err => console.error('Error handling agent request:', err))
