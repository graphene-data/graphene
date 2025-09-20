import {Page} from '@playwright/test'
import {test, expect} from './fixtures'

test('shows bars', async ({server, page}) => {
  await mount(server, page, 'components/barChart.svelte', {data: makeData(), x: 'origin', y: 'avg_delay'})
  await page.pause()
  // expect(page).toHaveScreenshot
})

function makeData () {
  return [
    {origin: 'SFO', avg_delay: 8},
    {origin: 'LAX', avg_delay: 12},
  ]
}

async function mount (server: any, page: Page, componentPath: string, props: any) {
  let errors: any[] = []

  let logError = (e) => {
    if (!e.type || e.type == 'error' || e.type == 'warning') {
      errors.push(e)
    }
  }

  page.on('console', logError)
  page.on('pageerror', logError)

  await page.goto(server.url() + '/__ct')
  await page.evaluate(p => window.__props = p, props)
  await page.addScriptTag({type: 'module', content: `
    import Component from '/node_modules/@graphene/ui/${componentPath}'

    window.__inst = new Component({
      target: document.getElementById('app'),
      props: window.__props,
    })
  `})

  await expect(page.locator('#app > *')).toBeVisible()
  // await use()
  expect(errors).toEqual([])
}
