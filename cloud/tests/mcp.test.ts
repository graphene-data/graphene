import {test, expect} from './fixtures.ts'

test('mcp list-dir tool works end-to-end', async ({mcpClient}) => {
  let result = await mcpClient.callTool({name: 'list-dir', arguments: {path: ''}})
  expect(result.isError).not.toBe(true)
  let entries = (result.structuredContent as {result: string[]}).result
  expect(entries).toContain('tables/')
  expect(entries).toContain('index.md')
})

test('mcp read-file tool works end-to-end', async ({mcpClient}) => {
  let result = await mcpClient.callTool({name: 'read-file', arguments: {path: 'tables/flights.gsql'}})
  expect(result.isError).not.toBe(true)
  let file = result.structuredContent as {content?: string; extension?: string; error?: string}
  expect(file.error).toBeUndefined()
  expect(file.extension).toBe('gsql')
  expect(file.content).toContain('dep_delay')
})

test('mcp render-md tool works end-to-end', async ({mcpClient}) => {
  let result = await mcpClient.callTool({name: 'render-md', arguments: {markdown: '# MCP tool smoke test'}})
  expect(result.isError).not.toBe(true)
  let render = result.structuredContent as {compiled?: string}
  expect(render.compiled).toContain('MCP tool smoke test')
})

test('mcp run-query tool works end-to-end', async ({mcpClient}) => {
  let result = await mcpClient.callTool({name: 'run-query', arguments: {gsql: 'from flights select carrier limit 1'}})
  expect(result.isError).not.toBe(true)
  let query = result.structuredContent as {rows?: any[]}
  expect(query.rows?.length).toBeGreaterThan(0)
})
