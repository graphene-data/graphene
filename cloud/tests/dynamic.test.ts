import {test, expect} from './fixtures.ts'
import {describe} from 'vitest'
import jwt from 'jsonwebtoken'
import {orgId, repoId} from '../server/dev.ts'

function createToken () {
  let secret = process.env.AGENT_TOKEN_SECRET || 'dev-secret-key'
  return jwt.sign({orgId, repoId, purpose: 'agent-render'}, secret, {expiresIn: '5m'})
}

// Test with realAuth to verify cookie-based agent token auth works
// This simulates what the Lambda does: set cookie, then navigate
describe('dynamic endpoint', () => {
  test.scoped({realAuth: true})

  test('renders bar chart with cookie auth', {timeout: 20000}, async ({browser, cloud}) => {
    let context = await browser.newContext({deviceScaleFactor: 2})
    let page = await context.newPage()

    let token = createToken()
    let urlObj = new URL(cloud.url)

    // Set the agent token cookie (like Lambda does)
    await context.addCookies([{
      name: 'graphene_agent_token',
      value: token,
      domain: urlObj.hostname,
      path: '/',
    }])

    let markdown = `# Flight Delays

\`\`\`sql delays
from flights select carrier, avg(dep_delay) as avg_delay order by avg_delay desc limit 5
\`\`\`

<BarChart data=delays x=carrier y=avg_delay />
`
    let md = Buffer.from(markdown).toString('base64')
    let url = `${cloud.url}/_api/dynamic?md=${encodeURIComponent(md)}&token=${encodeURIComponent(token)}`

    await page.goto(url)

    // Wait for component to be ready
    await page.waitForFunction(() => window.$GRAPHENE?.svelte, {timeout: 10000})
    await page.waitForSelector('h1', {timeout: 5000})

    await expect(page.locator('h1')).toHaveText('Flight Delays')
    await expect(page.locator('canvas')).toBeVisible({timeout: 15000})

    await expect(page).screenshot('dynamic-bar-chart')

    await context.close()
  })
})
