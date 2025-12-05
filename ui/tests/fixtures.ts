import {test as base, onTestFinished} from 'vitest'
import {type Page, chromium, type Browser} from '@playwright/test'
import {playwrightExpect as expect} from './matchers.ts'
import path from 'path'
import {fileURLToPath} from 'url'
import net from 'net'
import {type Config, config, setConfig} from '../../lang/config.ts'
import {clearWorkspace, loadWorkspace} from '../../lang/core.ts'
import {serve2} from '../../cli/serve2.ts'
import {assertConsoleErrors, trackerBrowserConsole} from './browserConsole.ts'
import {mockFileMap} from '../../cli/mockFiles.ts'

export {expect}

process.env.NODE_ENV = 'test'

export type MountFn = (componentPath: string, props: any) => Promise<void>
export type ChartConfigFn = <T>(selector: (config: any) => T) => Promise<T | null>

export interface ChartFixture {
  config: ChartConfigFn
  el: any
}

export interface ServerFixture {
  url: (options?: Config) => string
  mockFile: (path: string, content: string) => void
}

export const test = base.extend<{ browser: Browser, page: Page, server: ServerFixture, mount: MountFn, chart: ChartFixture }>({
  browser: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      let b = await chromium.launch({headless: !process.env.GRAPHENE_DEBUG, devtools: !!process.env.GRAPHENE_DEBUG})
      await use(b)
      await b.close()
    },
    {scope: 'worker'},
  ],

  page: async ({browser}, use) => {
    let context = await browser.newContext()
    let page = await context.newPage()
    trackerBrowserConsole(page)
    onTestFinished(() => assertConsoleErrors(page))
    await use(page)
    if (process.env.GRAPHENE_DEBUG) await new Promise(() => { })
    await context.close()
  },

  // This boots up our cli server on a unique port for e2e tests.
  server: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use: (fixture: ServerFixture) => Promise<void>) => {
      let port = await getAvailablePort()
      let viteRoot = path.join(fileURLToPath(import.meta.url), '../../../examples/flights')
      process.env.GRAPHENE_PORT = String(port)
      setConfig({port, root: viteRoot})
      let server = await serve2()

      function cleanup () {
        clearWorkspace()
        Object.keys(mockFileMap).forEach((key) => delete mockFileMap[key])

        // Vite caches our mocked files, so we need to clear them out after each test.
        let keys = Array.from(server?.moduleGraph?.idToModuleMap?.keys()) || []
        keys = Array.from(keys.filter(k => k.endsWith('?mock') || k == '\0virtual:nav'))
        let mods = keys.map(k => server.moduleGraph.getModuleById(k)).filter(m => !!m)
        mods.forEach(m => server.moduleGraph.invalidateModule(m))
      }

      await use({
        url: (options: Config = {} as Config) => {
          setConfig({...options, root: options.root || viteRoot, port})
          loadWorkspace(config.root, false)
          onTestFinished(cleanup)
          return `http://localhost:${port}`
        },
        mockFile: (path: string, content: string) => {
          mockFileMap[path.replace(/^\//, '')] = trimIndentation(content)
        },
      })
    },
    {scope: 'worker'} as any,
  ],

  mount: async ({page, server}: {page: Page, server: ServerFixture}, use) => {
    let mountFn = async (componentPath: string, props: any) => {
      await page.goto(`${server.url()}/__ct`)

      // evidence depends on the object being set on an array, but wont serialize when playwright sends it to the frontend, so unpack it here
      let modifiedProps = {...props}
      if (props.data?.rows?._evidenceColumnTypes) modifiedProps._evidenceColumnTypes = props.data.rows._evidenceColumnTypes

      await page.evaluate(p => {
        window.__props = p
        if (p._evidenceColumnTypes) {
          p.data.rows._evidenceColumnTypes = p._evidenceColumnTypes
          p.data.rows.dataLoaded = true // hack since evidence expects this on an array
          delete p._evidenceColumnTypes
        }
      }, modifiedProps)
      let uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
      let resolvedComponentPath = path.resolve(uiRoot, componentPath)
      let browserPath = '/@fs/' + resolvedComponentPath.replace(/\\/g, '/')
      await page.addScriptTag({type: 'module', content: `
        import Component from ${JSON.stringify(browserPath)}

        document.getElementById('nav').remove()
        let el = document.createElement('div')
        el.id = 'component-test'
        document.getElementById('content').appendChild(el)

        window.__inst = new Component({target: el, props: window.__props})
      `})
    }

    await use(mountFn)
    await expect(page.locator('#component-test > :not(dialog)').first()).toBeVisible()
  },

  chart: async ({page}, use) => {
    let readConfig: ChartConfigFn = async (selector) => {
      if (typeof selector !== 'function') throw new Error('chartConfig selector must be a function')
      let selectorSource = selector.toString()
      return await page.evaluate((source) => {
        let chart = Object.values(window[Symbol.for('__evidence-chart-window-debug__') as any])[0] as any
        let option = chart.getModel().getOption()
        try {
          let fn = new Function('config', `return (${source})(config)`)
          return fn(option)
        } catch (error) {
          console.error('chartConfig selector error', error)
          return null
        }
      }, selectorSource)
    }

    await use({config: readConfig, el: page.locator('#component-test')})
  },
})

test.beforeEach(() => {
  let root = path.join(fileURLToPath(import.meta.url), '../../../examples/flights')
  setConfig({root})
  clearWorkspace()
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
  await page.evaluate((ms) => window.$GRAPHENE.waitForQueries?.(ms), timeout)
}
