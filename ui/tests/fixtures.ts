import {test as base, expect, type Page} from '@playwright/test'
import path from 'path'
import {fileURLToPath} from 'url'
import net from 'net'
import {setConfig} from '../../lang/config.ts'

export {expect}

process.env.NODE_ENV = 'test'

export type MountFn = (componentPath: string, props: any) => Promise<void>
export type ChartConfigFn = <T>(selector: (config: any) => T) => Promise<T | null>

export interface ChartHandle {
  config: ChartConfigFn
  el: any
}

let uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const test = base.extend<{server: any, mount: MountFn, chart: ChartHandle}>({
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
    let mountFn = async (componentPath: string, props: any) => {
      await page.goto(server.url() + '/__ct')

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
      let resolvedComponentPath = path.resolve(uiRoot, componentPath)
      let browserPath = '/@fs/' + resolvedComponentPath.replace(/\\/g, '/')
      await page.addScriptTag({type: 'module', content: `
        import Component from ${JSON.stringify(browserPath)}

        window.__inst = new Component({
          target: document.getElementById('app'),
          props: window.__props,
        })
      `})

      // todo: await data load and chart animation completion
    }

    await use(mountFn)
    await expect(page.locator('#app > :not(dialog)').first()).toBeVisible()
    // let errors = page.evaluate(() => window.$GRAPHENE.getErrors())
    // expect(errors).toEqual([])
  },

  chart: async ({page}, use) => {
    let readConfig: ChartConfigFn = async (selector) => {
      if (typeof selector !== 'function') throw new Error('chartConfig selector must be a function')
      let selectorSource = selector.toString()
      return await page.evaluate((source) => {
        let chart = Object.values(window[Symbol.for('__evidence-chart-window-debug__')])[0] as any
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

    await use({
      config: readConfig,
      el: page.locator('#app'),
    })
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
  await page.evaluate((ms) => window.$GRAPHENE.waitForQueries?.(ms), timeout)
}
