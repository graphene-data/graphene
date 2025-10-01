import {test as base, expect, type Page} from '@playwright/test'
import path from 'path'
import {fileURLToPath} from 'url'
import net from 'net'
import {setConfig} from '../../lang/config.ts'

export {expect}

process.env.NODE_ENV = 'test'

export type MountFn = (componentPath: string, props: any) => Promise<void>

export const test = base.extend<{server: any, mount: MountFn}>({
  // This boots up our cli server on a unique port for e2e tests.
  server: async (_context, use) => {
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

  mount: async ({page, server}: {page: Page, server: any}, use) => {
    let errors: string[] = []
    page.on('console', msg => { if (msg.type() == 'error' || msg.type() == 'warning') errors.push(msg.text()) })
    page.on('pageerror', e => errors.push(e?.message ?? String(e)))

    let mountFn = async (componentPath: string, props: any) => {
      errors = []
      await page.goto(server.url() + '/__ct')
      await page.evaluate(p => window.__props = p, props)
      await page.addScriptTag({type: 'module', content: `
        import Component from '@graphenedata/ui/${componentPath}'

        window.__inst = new Component({
          target: document.getElementById('app'),
          props: window.__props,
        })
      `})
    }

    await use(mountFn)
    await expect(page.locator('#app > :not(dialog)').first()).toBeVisible()
    expect(errors).toEqual([])
    page.removeAllListeners('console')
    page.removeAllListeners('pageerror')
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



declare global {
  interface Window {
    $GRAPHENE: any
    __props: any
  }
}

export async function waitForGrapheneQueries (page: Page, timeout = 20_000) {
  await page.waitForFunction(() => Boolean(window.$GRAPHENE), null, {timeout})
  await page.waitForFunction(() => window.$GRAPHENE.loadingQueries?.size === 0, null, {timeout})
  await page.evaluate((ms) => window.$GRAPHENE.waitForQueries?.(ms), timeout)
}
