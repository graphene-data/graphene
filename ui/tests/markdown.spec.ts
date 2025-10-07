import {test, expect, waitForGrapheneQueries} from './fixtures'

test('loads markdown files', async ({server, page}) => {
  await server.mockFile('/index.md', `
    # Flight Delay Analysis

    \`\`\`gsql delays
    select carrier, avg(dep_delay) as delay from flights
    \`\`\`

    <BarChart data="delays" x="carrier" y="delay" />
  `)
  await page.goto(await server.url() + '/')
  await expect(page.getByRole('heading', {level: 1, name: 'Flight Delay Analysis'})).toBeVisible()
  await expect(page.locator('main canvas').first()).toBeVisible()

  let errors = await page.evaluate(() => window.$GRAPHENE.getErrors())
  expect(errors).toEqual([])
  await expect(page).toHaveScreenshot('loads-markdown-files.png')
})

test('reports query errors', async ({server, page}) => {
  server.mockFile('/index.md', `
    # Broken Dashboard

    This view intentionally triggers an error.

    \`\`\`sql broken_query
    select not_a_function() as boom from flights
    \`\`\`

    <BarChart data="broken_query" x="origin" y="boom" />
  `)
  await page.goto(await server.url() + '/')
  await waitForGrapheneQueries(page)

  let errors = await page.evaluate(() => window.$GRAPHENE.getErrors())
  expect(errors.length).toBeGreaterThan(0)
  await expect(page).toHaveScreenshot('reports-query-errors.png')
})
