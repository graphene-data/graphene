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

  test('unit formatting', async ({mount, sharedPage}) => {
    await mount('components/Value.svelte', {data: unitData(), column: 'duration'})
    await expect(sharedPage.getByText('42 minutes')).toBeVisible()
  })

  test('null renders em dash', async ({mount, sharedPage}) => {
    await mount('components/Value.svelte', {data: nullValueData(), column: 'value'})
    await expect(sharedPage.getByText('—')).toBeVisible()
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
