import {test as base, expect, type Page} from '@playwright/test'
import fs from 'fs/promises'
import path from 'path'
import {fileURLToPath} from 'url'
import net from 'net'
import {setConfig} from '../../lang/config.ts'

export {expect}

process.env.NODE_ENV = 'test'

export type MountFn = (componentPath: string, props: any) => Promise<void>
export type ChartConfigFn = <T>(selector: (config: any) => T) => Promise<T | null>

let uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let screenshotRoot = path.join(uiRoot, 'tests', 'snapshots')

export const test = base.extend<{server: any, mount: MountFn, chartConfig: ChartConfigFn}>({
  // This boots up our cli server on a unique port for e2e tests.
  // eslint-disable-next-line no-empty-pattern
  server: async ({}, use:any) => {
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
    page.on('console', msg => {
      if (msg.type() != 'error' && msg.type() != 'warning') return
      errors.push(`${msg.text()} at ${JSON.stringify(msg.location())}`)
    })
    page.on('pageerror', e => {
      console.log('page-error', e)
      errors.push(e?.message ?? String(e))
    })

    let mountFn = async (componentPath: string, props: any) => {
      errors = []
      await page.goto(server.url() + '/__ct')
      await page.evaluate(p => {
        window.__props = p
        if (p.data) p.data.rows.dataLoaded = true // hack since evidence expects this on an array
      }, props)
      let resolvedComponentPath = path.resolve(uiRoot, componentPath)
      let browserPath = '/@fs/' + resolvedComponentPath.replace(/\\/g, '/')
      await page.addScriptTag({type: 'module', content: `
        import Component from ${JSON.stringify(browserPath)}

        window.__inst = new Component({
          target: document.getElementById('app'),
          props: window.__props,
        })
      `})
    }

    await use(mountFn)
    try {
      await expect(page.locator('#app > :not(dialog)').first()).toBeVisible()
    } catch (err) {
      console.error('mount errors:', errors)
      throw err
    }
    if (errors.length) console.error('component errors:', errors)
    expect(errors).toEqual([])
    page.removeAllListeners('console')
    page.removeAllListeners('pageerror')
  },

  chartConfig: async ({page}, use) => {
    let readConfig: ChartConfigFn = async (selector) => {
      if (typeof selector !== 'function') throw new Error('chartConfig selector must be a function')
      let selectorSource = selector.toString()
      return await page.evaluate((source) => {
        let charts = window[Symbol.for('__evidence-chart-window-debug__')]
        if (!charts) return null
        let chart = Object.values(charts)[0]
        let option = chart?.getModel?.()?.getOption?.()
        if (!option) return null
        try {
          // eslint-disable-next-line no-new-func
          let fn = new Function('config', `return (${source})(config)`)
          return fn(option)
        } catch (error) {
          console.error('chartConfig selector error', error)
          return null
        }
      }, selectorSource)
    }

    await use(readConfig)
  },
})

test.afterEach(async ({page}, testInfo) => {
  if (!page) return
  if (testInfo.status === 'skipped' || testInfo.status === 'interrupted') return
  if (process.env.DEBUG) await page.pause() // DEBUG should pause so we can check out the page

  // Take a screenshot of each test in its final form
  let filename = [
    path.basename(testInfo.file ?? '').replace(/\.[^/.]+/g, ''),
    testInfo.title,
  ].map(toSlug).join('-') + '.png'
  let screenshotPath = path.join(screenshotRoot, filename)

  await fs.mkdir(screenshotRoot, {recursive: true})
  await waitForChartsToRender(page)
  await page.locator('#app').screenshot({path: screenshotPath})

  // if (process.env.DEBUG || testInfo.config.grep.toString() != '/.*/') {
  console.log(`screenshot saved to ${testInfo.config.grep.toString()} ${path.relative(uiRoot, screenshotPath)}`)
  // }
})

function toSlug (value: string) {
  let slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
  return slug || null
}

async function waitForChartsToRender (page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => {
    let pendingKey = Symbol.for('graphene.pendingCharts')
    let waitForIdle = () => {
      let pending = window[pendingKey]
      if (!pending || pending.size === 0) {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        return
      }
      requestAnimationFrame(waitForIdle)
    }
    waitForIdle()
  }))
}

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
