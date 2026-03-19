import {describe} from 'vitest'

import {waitForGrapheneLoad} from '../../core/ui/tests/fixtures.ts'
import {test, expectConsoleError} from './fixtures.ts'

describe('chat preview', () => {
  test('captures failed renderMd state full-page', async ({page, cloud}) => {
    expectConsoleError(/Failed to load resource: the server responded with a status of 400/)
    await page.goto(`${cloud.url}/chats/latest`, {waitUntil: 'commit'})
    await page.locator('.preview-button[data-render-index="1"]').click()
    await waitForGrapheneLoad(page)
    await page.screenshot({path: 'tests/snapshots/chats.test.ts/chat-preview-failed-render.png', fullPage: true})
  })

  test('captures successful renderMd with code full-page', async ({page, cloud}) => {
    await page.goto(`${cloud.url}/chats/latest`, {waitUntil: 'commit'})
    await page.locator('.preview-button[data-render-index="2"]').click()
    await page.getByRole('button', {name: 'Show code'}).click()
    await waitForGrapheneLoad(page)
    await page.screenshot({path: 'tests/snapshots/chats.test.ts/chat-preview-successful-render.png', fullPage: true})
  })
})
