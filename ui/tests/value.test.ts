import {expect, test} from './fixtures.ts'
import {singleDim} from './testData.ts'

describe('<Value/>', () => {
  test.beforeEach(async ({sharedPage}) => {
    await sharedPage.setViewportSize({width: 1280, height: 720})
  })

  test('currency formatting', async ({mount, sharedPage, chart}) => {
    await mount('components/Value.svelte', {data: singleDim(), column: 'value'})
    await expect(sharedPage.getByText('$611.1k')).toBeVisible()
    await expect(chart.el).screenshot('currency-formatting')
  })

  test('percent formatting', async ({mount, sharedPage}) => {
    await mount('components/Value.svelte', {data: percentData(), column: 'ratio'})
    await expect(sharedPage.getByText('31%')).toBeVisible()
  })

  test('unit formatting', async ({mount, sharedPage, chart}) => {
    await mount('components/Value.svelte', {data: unitData(), column: 'duration'})
    await expect(sharedPage.getByText('42 minutes')).toBeVisible()
    await expect(chart.el).screenshot('unit-formatting')
  })

  test('null renders em dash', async ({mount, sharedPage}) => {
    await mount('components/Value.svelte', {data: nullValueData(), column: 'value'})
    await expect(sharedPage.getByText('—')).toBeVisible()
  })

  test('renders loading state while query is pending', async ({sharedPage, server}) => {
    await sharedPage.goto(`${server.url()}/__ct`)
    await sharedPage.evaluate(async () => {
      let g = window.$GRAPHENE
      let originalQuery = g.query
      let originalUnsubscribe = g.unsubscribe
      ;(window as any).__restoreQueryHooks = () => {
        g.query = originalQuery
        g.unsubscribe = originalUnsubscribe
        delete (window as any).__queryCallback
        delete (window as any).__restoreQueryHooks
      }

      g.query = (_data: string, _fields: Record<string, string>, callback: (result?: unknown) => void) => {
        ;(window as any).__queryCallback = callback
        callback()
        return 'loading-test'
      }
      g.unsubscribe = () => {}

      if (window.__inst) g.svelte.unmount(window.__inst)
      let container = document.getElementsByTagName('main')[0] || document.createElement('main')
      if (!container.isConnected) document.body.appendChild(container)
      container.innerHTML = '<div id="component-test"></div>'
      let target = document.getElementById('component-test')
      if (!target) throw new Error('component test target was not created')
      window.__inst = g.svelte.mount(g.components.Value, {target, props: {data: 'slow_query', column: 'value'}})
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    })

    try {
      let component = sharedPage.locator('#component-test')
      await expect(component.getByRole('status')).toBeVisible()
      await expect(component.getByText('Dataset is empty')).toHaveCount(0)

      await sharedPage.evaluate(async () => {
        ;(window as any).__queryCallback({rows: [{value: 42}], fields: [{name: 'value', type: 'number'}]})
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      })
      await expect(component.getByText('42')).toBeVisible()
    } finally {
      await sharedPage.evaluate(() => (window as any).__restoreQueryHooks?.())
    }
  })

  test('query error renders inline tooltip', async ({mount, sharedPage}) => {
    await mount('components/Value.svelte', {data: errorData(), column: 'value'})
    let errorIcon = sharedPage.getByRole('button', {name: 'Query failed'})
    await errorIcon.hover()
    await expect(sharedPage.getByText('Could not resolve column "value"')).toBeVisible()
    await expect(sharedPage).screenshot('inline-error-tooltip')
  })

  function percentData() {
    let rows = [{ratio: 0.314}] as any
    let fields = [{name: 'ratio', type: 'number', metadata: {ratio: true}}] as any
    return {rows, fields}
  }

  function nullValueData() {
    let rows = [{value: null}] as any
    let fields = [{name: 'value', type: 'number'}] as any
    return {rows, fields}
  }

  function unitData() {
    let rows = [{duration: 42}] as any
    let fields = [{name: 'duration', type: 'number', metadata: {unit: 'minutes'}}] as any
    return {rows, fields}
  }

  function errorData() {
    let error = {message: 'Could not resolve column "value"', componentId: 'broken_value'} as any
    return {rows: [], fields: [], error}
  }
})
