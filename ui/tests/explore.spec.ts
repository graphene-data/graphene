import {test, expect, waitForGrapheneQueries} from './fixtures'

test('it can explore with a mocked agent response', async ({server, page}) => {
  await page.goto(server.url() + '/explore')
  let promptBox = page.locator('textarea')
  await promptBox.fill('mock')
  await promptBox.press('Enter')

  await expect(page.locator('.message-assistant')).toContainText("I'll analyze flight delays by carrier for you.")
  await expect(page.locator('.message-tool')).toContainText('Glob')

  await waitForGrapheneQueries(page)
  // await page.pause()
  await expect(page.locator('main h1')).toHaveText('Flight Delay Analysis')
  await expect(page.locator('main table').first()).toBeVisible()
})
