import {test, expect, waitForGrapheneQueries} from './fixtures'

test('explore with a mocked agent response', async ({server, page}) => {
  await server.mockFile('/index.md', `
    # Flight Delay Analysis

    \`\`\`gsql delays
    select carrier, avg(dep_delay) as delay from flights
    \`\`\`

    <BarChart data="delays" x="carrier" y="delay" />
  `)
  await page.goto(await server.url() + '/explore')
  let promptBox = page.locator('textarea')
  await promptBox.fill('mock')
  await promptBox.press('Enter')

  await expect(page.locator('.message-assistant')).toContainText("I'll analyze flight delays by carrier for you.")
  await expect(page.locator('.message-tool')).toContainText('Glob')

  await waitForGrapheneQueries(page)
  await expect(page.locator('main h1')).toHaveText('Flight Delay Analysis')
  await expect(page.locator('main table').first()).toBeVisible()
})
