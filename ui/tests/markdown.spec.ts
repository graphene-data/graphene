import {test, expect, waitForGrapheneQueries} from './fixtures'

test('loads markdown files without errors', async ({server, page}) => {
  await page.goto(server.url() + '/')
  await page.waitForSelector('h2:has-text("Average Departure Delay by Airport")')
  await waitForGrapheneQueries(page)

  await expect(page.locator('.chart canvas').first()).toBeVisible()

  let errors = await page.evaluate(() => window.$GRAPHENE.getErrors())
  expect(errors).toEqual([])
})

test('reports query errors to the runtime error buffer', async ({server, page}) => {
  server.mockFile('/index.md', `
    # Broken Dashboard

    This view intentionally triggers an error.

    \`\`\`sql broken_query
    select not_a_function() as boom from flights
    \`\`\`

    <BarChart data="broken_query" x="origin" y="boom" />
  `)
  await page.goto(server.url() + '/')
  await waitForGrapheneQueries(page)

  let errors = await page.evaluate(() => window.$GRAPHENE.getErrors())
  expect(errors.length).toBeGreaterThan(0)
})
