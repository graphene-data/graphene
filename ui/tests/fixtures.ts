import {test as base} from '@playwright/test'
import path from 'path'
import {fileURLToPath} from 'url'
import net from 'net'
import {setConfig} from '../../lang/config.ts'

process.env.NODE_ENV = 'test'

export const test = base.extend<{server: any}>({
  server: async ({ }, use) => {
    let mod = await import('../../cli/serve2.ts')
    let port = await getAvailablePort()
    let root = path.join(fileURLToPath(import.meta.url), '../../../examples/flights')
    let server: any

    setConfig({dialect: 'duckdb', port, root})
    Object.keys(mod.mockFileMap).forEach((key) => delete mod.mockFileMap[key])

    try {
      server = await mod.serve2()
      await use({
        url: () => `http://localhost:${port}`,
        mockFile: (path:string, content:string) => mod.mockFileMap[path] = trimIndentation(content),
      })
    } finally {
      Object.keys(mod.mockFileMap).forEach((key) => delete mod.mockFileMap[key])
      await server?.close()
    }
  },
})

async function getAvailablePort (): Promise<number> {
  return await new Promise((resolve, reject) => {
    let srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      let {port} = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
  })
}

function trimIndentation (str:string) {
  let lines = str.split('\n')
  let firstContentLine = lines[1] // Skip the first line (assumed to be empty) and find indentation of second line
  if (!firstContentLine) return str

  let indentMatch = firstContentLine.match(/^(\s*)/)
  let indentAmount = indentMatch ? indentMatch[1].length : 0

  return lines.map((line, index) => {
    if (index === 0) return line // Keep first line as-is
    if (line.trim() === '') return '' // Remove all whitespace from blank lines
    return line.slice(indentAmount) // Remove the indent amount from other lines
  }).join('\n')
}

export {expect} from '@playwright/test'

declare global {
  interface Window {
    $GRAPHENE: any
  }
}

export async function waitForGrapheneQueries (page: Page, timeout = 20_000) {
  await page.waitForFunction(() => Boolean(window.$GRAPHENE), null, {timeout})
  await page.waitForFunction(() => window.$GRAPHENE.loadingQueries?.size === 0, null, {timeout})
  await page.evaluate((ms) => window.$GRAPHENE.waitForQueries?.(ms), timeout)
}
