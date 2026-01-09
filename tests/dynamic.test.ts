import {test, expect} from './fixtures.ts'
import jwt from 'jsonwebtoken'
import {orgId, repoId} from '../server/dev.ts'

function createToken () {
  let secret = process.env.AGENT_TOKEN_SECRET || process.env.CONNECTION_ENCRYPTION_KEY || 'dev-secret-key'
  return jwt.sign({orgId, repoId, purpose: 'agent-render'}, secret, {expiresIn: '5m'})
}

test('renders simple markdown via dynamic endpoint', async ({page, cloud}) => {
  let markdown = `# Hello World

This is a test page.

- Item 1
- Item 2
`
  // Intercept requests to /dynamic-test and serve our dynamic HTML
  let dynamicHtml: string
  let response = await page.request.post(`${cloud.url}/_api/dynamic`, {
    data: {markdown, token: createToken()},
  })
  expect(response.ok()).toBe(true)
  dynamicHtml = await response.text()
  expect(dynamicHtml).toContain('Hello World')

  // Route a test URL to serve our dynamic HTML
  await page.route(`${cloud.url}/_test/dynamic`, route => {
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: dynamicHtml,
    })
  })

  // Navigate to the routed URL (scripts will load from the same origin)
  await page.goto(`${cloud.url}/_test/dynamic`)

  // Wait for $GRAPHENE to be ready and component to mount
  await page.waitForFunction(() => window.$GRAPHENE?.svelte, {timeout: 10000})
  await page.waitForSelector('h1', {timeout: 5000})

  await expect(page.locator('h1')).toHaveText('Hello World')
  await expect(page.locator('li').first()).toHaveText('Item 1')
})

test('renders markdown with chart via dynamic endpoint', async ({page, cloud}) => {
  let markdown = `# Flight Delays

\`\`\`sql delays
from flights select
  carrier,
  avg(dep_delay) as avg_delay
group by carrier
order by avg_delay desc
limit 5
\`\`\`

<Table data=delays title="Top 5 Carriers by Delay" />
`
  let response = await page.request.post(`${cloud.url}/_api/dynamic`, {
    data: {markdown, token: createToken()},
  })
  expect(response.ok()).toBe(true)
  let dynamicHtml = await response.text()

  // Route a test URL to serve our dynamic HTML
  await page.route(`${cloud.url}/_test/dynamic-chart`, route => {
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: dynamicHtml,
    })
  })

  await page.goto(`${cloud.url}/_test/dynamic-chart`)

  // Wait for component to be ready
  await page.waitForFunction(() => window.$GRAPHENE?.svelte, {timeout: 10000})
  await page.waitForSelector('h1', {timeout: 5000})

  await expect(page.locator('h1')).toHaveText('Flight Delays')
  // Table should render (may take a moment for query)
  await expect(page.locator('table')).toBeVisible({timeout: 15000})
  await expect(page).screenshot('dynamic-flight-delays')
})
