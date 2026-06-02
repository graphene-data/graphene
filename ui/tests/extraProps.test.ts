import {expect, test} from './fixtures.ts'
import {singleDim} from './testData.ts'

test.beforeEach(async ({sharedPage}) => {
  await sharedPage.setViewportSize({width: 1280, height: 720})
})

test('display components report unsupported props', async ({mount, sharedPage}) => {
  await mount('components/Value.svelte', {data: singleDim(), column: 'value', fmt: 'usd'})
  await expectUnsupportedProp(sharedPage, 'Unsupported prop "fmt" on Value.')

  await mount('components/BigValue.svelte', {data: singleDim(), value: 'value', subtitle: 'Ignored'})
  await expectUnsupportedProp(sharedPage, 'Unsupported prop "subtitle" on BigValue.')

  await mount('components/ScatterPlot.svelte', {data: singleDim(), x: 'category', y: 'value', subtitle: 'Ignored'})
  await expectUnsupportedProp(sharedPage, 'Unsupported prop "subtitle" on ScatterPlot.')
})

test('input components report unsupported props', async ({mount, sharedPage}) => {
  await mount('components/TextInput.svelte', {name: 'search', title: 'Search', helperText: 'Ignored'})
  await expectUnsupportedProp(sharedPage, 'Unsupported prop "helperText" on TextInput.')

  await mount('components/Dropdown.svelte', {name: 'carrier', allowDeselect: true})
  await expectUnsupportedProp(sharedPage, 'Unsupported prop "allowDeselect" on Dropdown.')

  await mount('components/DateRange.svelte', {name: 'window', calendar: true})
  await expectUnsupportedProp(sharedPage, 'Unsupported prop "calendar" on DateRange.')

  await mount('components/DropdownOption.svelte', {value: 'AA', label: 'American'})
  await expectUnsupportedProp(sharedPage, 'Unsupported prop "label" on DropdownOption.')
})

async function expectUnsupportedProp(sharedPage: any, message: string) {
  let messages = await sharedPage.evaluate(() => (window as any).$GRAPHENE.getErrors().map((error: any) => error.message))
  expect(messages).toContain(message)
}
