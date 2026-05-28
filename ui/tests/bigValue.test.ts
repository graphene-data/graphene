import {expect, test} from './fixtures.ts'
import {singleDim} from './testData.ts'

test.beforeEach(async ({sharedPage}) => {
  await sharedPage.setViewportSize({width: 1280, height: 720})
})

test('big value', async ({mount, sharedPage, chart}) => {
  await mount('components/BigValue.svelte', {data: singleDim(), value: 'value', title: 'Sales'})
  await expect(sharedPage.getByText('Sales')).toBeVisible()
  await expect(sharedPage.getByText('$611.1k')).toBeVisible()
  await expect(chart.el).screenshot('big-value')
})

test('big value percent formatting', async ({mount, sharedPage}) => {
  await mount('components/BigValue.svelte', {
    data: percentData(),
    value: 'ratio',
    title: 'Conversion',
  })

  await expect(sharedPage.getByText('Conversion')).toBeVisible()
  await expect(sharedPage.getByText('31%')).toBeVisible()
  await expect(sharedPage.locator('#component-test')).screenshot('big-value-percent')
})

test('big value can render a non-default row', async ({mount, sharedPage}) => {
  await mount('components/BigValue.svelte', {
    data: rowData(),
    value: 'value',
    row: 1,
    title: 'Selected Row',
  })

  await expect(sharedPage.getByText('Selected Row')).toBeVisible()
  await expect(sharedPage.getByText('$200')).toBeVisible()
  await expect(sharedPage.getByText('$100')).not.toBeVisible()
  await expect(sharedPage.locator('#component-test')).screenshot('big-value-row')
})

test('big value null renders em dash', async ({mount, sharedPage}) => {
  await mount('components/BigValue.svelte', {
    data: nullValueData(),
    value: 'value',
    title: 'Nullable Metric',
  })

  await expect(sharedPage.getByText('Nullable Metric')).toBeVisible()
  await expect(sharedPage.getByText('—')).toBeVisible()
  await expect(sharedPage.locator('#component-test')).screenshot('big-value-null')
})

function percentData() {
  let rows = [{ratio: 0.314}] as any
  let fields = [{name: 'ratio', type: 'number', metadata: {ratio: true}}] as any
  return {rows, fields}
}

function rowData() {
  let rows = [{value: 100}, {value: 200}] as any
  let fields = [{name: 'value', type: 'number', metadata: {currency: 'USD'}}] as any
  return {rows, fields}
}

function nullValueData() {
  let rows = [{value: null}] as any
  let fields = [{name: 'value', type: 'number'}] as any
  return {rows, fields}
}
