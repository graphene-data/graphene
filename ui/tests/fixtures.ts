import {type Page, chromium, type Browser, type Locator} from '@playwright/test'
import net from 'net'
import path from 'path'
import {fileURLToPath} from 'url'
import {test as base, onTestFinished} from 'vitest'

import {mockFileMap} from '../../cli/mockFiles.ts'
import {clearSvelteWarnings, serve2, svelteWarnings} from '../../cli/serve2.ts'
import {type Config, setConfig} from '../../lang/config.ts'
import {trackBrowserConsole} from './logWatcher.ts'
import {playwrightExpect as expect} from './matchers.ts'

export {expect}

process.env.NODE_ENV = 'test'
process.env.VITE_TEST = '1'

declare global {
  interface Window {
    __inst?: any
  }
}

export type MountFn = (componentPath: string, props: any) => Promise<Locator>
export type ChartConfigFn = <T>(selector: (config: any) => T) => Promise<T | null>

export interface ChartFixture {
  config: ChartConfigFn
  chartDispatchAction: (action: any) => Promise<void>
  el: any
}

export interface ServerFixture {
  url: (options?: Config) => string
  mockFile: (path: string, content: string) => void
  /** Update a mock file and trigger HMR, simulating a real file edit */
  updateMockFile: (path: string, content: string) => void
}

const chromeConfig = {
  viewport: {width: 1280, height: 720},
  deviceScaleFactor: 1,
  locale: 'en-US' as const,
  timezoneId: 'UTC' as const,
  colorScheme: 'light' as const,
  reducedMotion: 'reduce' as const,
}

export const test = base.extend<{browser: Browser; page: Page; sharedPage: Page; server: ServerFixture; mount: MountFn; chart: ChartFixture}>({
  browser: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      let b = await chromium.launch({
        headless: !process.env.GRAPHENE_DEBUG,
        args: [
          '--font-render-hinting=none', // Consistent font rendering across platforms
          '--disable-font-subpixel-positioning', // Avoid tiny per-glyph edge drift across OS builds
          '--disable-lcd-text', // Use grayscale AA instead of subpixel AA for more stable screenshots
          '--force-color-profile=srgb',
          '--lang=en-US',
          ...(process.env.GRAPHENE_DEBUG ? ['--auto-open-devtools-for-tabs'] : []),
        ],
      })
      await use(b)
      await b.close()
    },
    {scope: 'worker'},
  ],

  page: async ({browser}, use) => {
    let context = await browser.newContext(chromeConfig)
    let page = await context.newPage()
    trackBrowserConsole(page)
    await use(page)
    if (process.env.GRAPHENE_DEBUG) await new Promise(() => {})
    await context.close()
  },

  sharedPage: [
    async ({browser}, use) => {
      let context = await browser.newContext(chromeConfig)
      let page = await context.newPage()
      await page.setViewportSize({width: 680, height: 400})
      trackBrowserConsole(page)
      await use(page)
      if (process.env.GRAPHENE_DEBUG) await new Promise(() => {})
      await context.close()
    },
    {scope: 'worker'},
  ],

  // This boots up our cli server on a unique port for e2e tests.
  server: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use: (fixture: ServerFixture) => Promise<void>) => {
      let port = await getAvailablePort()
      let viteRoot = path.join(fileURLToPath(import.meta.url), '../../../examples/flights')
      process.env.GRAPHENE_PORT = String(port)
      setConfig({port, root: viteRoot})
      let server = await serve2()

      function cleanup() {
        Object.keys(mockFileMap).forEach(key => delete mockFileMap[key])

        // Vite caches our mocked files, so we need to clear them out after each test.
        // Vite 7 has separate module graphs for server.moduleGraph and environments.client — invalidate both.
        for (let graph of [server.moduleGraph, server.environments.client.moduleGraph] as any[]) {
          let keys: string[] = Array.from(graph?.idToModuleMap?.keys() || [])
          let mockKeys = keys.filter(k => k.endsWith('?mock') || k == '\0virtual:nav')
          mockKeys.forEach(k => {
            let m = graph.getModuleById(k)
            if (m) graph.invalidateModule(m)
          })
        }
      }

      await use({
        url: (options: Partial<Config> = {}) => {
          setConfig({...options, root: options.root || viteRoot, port} as any)
          onTestFinished(cleanup)
          return `http://localhost:${port}`
        },
        mockFile: (filePath: string, content: string) => {
          mockFileMap[filePath.replace(/^\//, '')] = trimIndentation(content)
        },
        updateMockFile: (filePath: string, content: string) => {
          let relativePath = filePath.replace(/^\//, '')
          mockFileMap[relativePath] = trimIndentation(content)
          let absPath = path.join(viteRoot, relativePath)
          // Emit a watcher 'change' event so Vite runs the full HMR pipeline (including hotUpdate hooks)
          server.watcher.emit('change', absPath)
        },
      })
    },
    {scope: 'worker'} as any,
  ],

  // mounts a given svelte component with props
  // This reuses an existing page, which is less isolated, but much faster
  // This is hard-coded for viz components, but an earlier (slower) version dynamically loaded svelte files, if that's ever needed
  mount: async ({sharedPage, server}: {sharedPage: Page; server: ServerFixture}, use) => {
    if (!sharedPage.url().endsWith('__ct')) {
      await sharedPage.goto(`${server.url()}/__ct`)
    }

    await use(async (componentPath: string, props: any) => {
      let modifiedProps = {...props}

      let compName = componentPath.match(/(\w+)\.svelte/)?.[1] || 'splat'
      await sharedPage.evaluate(
        async ({compName, props}) => {
          if (window.__inst) window.$GRAPHENE.svelte.unmount(window.__inst)

          // ensure fonts have loaded before we mount our component
          document.fonts.load("12px 'Source Sans 3'")
          await document.fonts.ready

          document.getElementById('nav')?.remove()
          let container = document.getElementById('content')
          if (container) container.innerHTML = ''
          let el = document.createElement('div')
          el.id = 'component-test'
          container?.appendChild(el)
          window.__inst = window.$GRAPHENE.svelte.mount(window.$GRAPHENE.components[compName], {target: el, props})

          // Wait for load
          await window.$GRAPHENE?.waitForLoad?.()
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        },
        {compName, props: modifiedProps},
      )

      return sharedPage.locator('#component-test')
    })
  },

  chart: async ({sharedPage}, use) => {
    let readConfig: ChartConfigFn = async selector => {
      if (typeof selector !== 'function') throw new Error('chartConfig selector must be a function')
      let selectorSource = selector.toString()
      await sharedPage.waitForFunction(() => {
        let charts = window.$GRAPHENE.components
        return charts && Object.keys(charts).length > 0
      })
      return await sharedPage.evaluate(source => {
        let chart = Object.values(window.$GRAPHENE.components)[0] as any
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

    let chartDispatchAction = async (action: any) => {
      await sharedPage.evaluate(async chartAction => {
        let domNode = document.querySelector('#component-test .echarts') as HTMLElement | null
        let chart = domNode ? window.$GRAPHENE.getChart(domNode) : null
        chart?.dispatchAction(chartAction)
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      }, action)
    }

    await use({config: readConfig, chartDispatchAction, el: sharedPage.locator('#component-test')})
  },
})

test.beforeEach(() => {
  let root = path.join(fileURLToPath(import.meta.url), '../../../examples/flights')
  setConfig({root})
  clearSvelteWarnings()
})

test.afterEach(() => {
  if (svelteWarnings.length) {
    let formatted = svelteWarnings.map(w => `  - [${w.code}] ${w.message} (${w.filename})`).join('\n')
    throw new Error(`Unexpected Svelte warnings:\n${formatted}`)
  }
})

export async function getAvailablePort(): Promise<number> {
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

function trimIndentation(str: string) {
  let lines = str.split('\n')
  let firstContentLine = lines[1] // Skip the first line (assumed to be empty) and find indentation of second line
  if (!firstContentLine) return str

  let indentMatch = firstContentLine.match(/^(\s*)/)
  let indentAmount = indentMatch ? indentMatch[1].length : 0

  return lines
    .map((line, index) => {
      if (index === 0) return line // Keep first line as-is
      if (line.trim() === '') return '' // Remove all whitespace from blank lines
      return line.slice(indentAmount) // Remove the indent amount from other lines
    })
    .join('\n')
}

declare global {
  interface Window {
    $GRAPHENE: any
    __props: any
  }
}

export async function waitForGrapheneLoad(page: Page, timeout = 20_000) {
  await page.waitForFunction(() => Boolean((window as any).$GRAPHENE), null, {timeout})
  await page.evaluate(ms => {
    let graphene = (window as any).$GRAPHENE
    return typeof graphene?.waitForLoad === 'function' ? graphene.waitForLoad(ms) : null
  }, timeout)
}
