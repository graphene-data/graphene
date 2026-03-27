import {expect, test} from './fixtures.ts'
import {singleDim} from './testData.ts'

test('big value', async ({mount, page, chart}) => {
  await mount('components/BigValue.svelte', {data: singleDim(), value: 'value', fmt: 'num0', title: 'Sales'})
  await expect(page.getByText('Sales')).toBeVisible()
  await expect(page.getByText('611,113')).toBeVisible()
  await expect(chart.el).screenshot('big-value')
})

test('big value percent formatting', async ({mount, page}) => {
  await mount('components/BigValue.svelte', {
    data: percentData(),
    value: 'ratio',
    fmt: 'pct1',
    title: 'Conversion',
    subtitle: 'This month',
  })

  await expect(page.getByText('Conversion')).toBeVisible()
  await expect(page.getByText('This month')).toBeVisible()
  await expect(page.getByText('31.4%')).toBeVisible()
  await expect(page.locator('#component-test')).screenshot('big-value-percent')
})

test('big value null renders em dash', async ({mount, page}) => {
  await mount('components/BigValue.svelte', {
    data: nullValueData(),
    value: 'value',
    title: 'Nullable Metric',
  })

  await expect(page.getByText('Nullable Metric')).toBeVisible()
  await expect(page.getByText('—')).toBeVisible()
  await expect(page.locator('#component-test')).screenshot('big-value-null')
})

function percentData() {
  let rows = [{ratio: 0.314}] as any
  rows._evidenceColumnTypes = [{name: 'ratio', evidenceType: 'number'}]
  return {rows}
}

function nullValueData() {
  let rows = [{value: null}] as any
  rows._evidenceColumnTypes = [{name: 'value', evidenceType: 'number'}]
  return {rows}
}
