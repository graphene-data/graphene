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

  test('null renders em dash', async ({mount, sharedPage}) => {
    await mount('components/BigValue.svelte', {data: nullValueData(), column: 'value'})
    await expect(sharedPage.getByText('—')).toBeVisible()
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
})
