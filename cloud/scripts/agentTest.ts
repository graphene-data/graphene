import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {LambdaClient, InvokeCommand} from '@aws-sdk/client-lambda'
import {generateAgentToken} from '../server/auth.ts'

const localBaseUrl = 'http://localhost:4016'
const screenshotLambda = process.env.SCREENSHOT_LAMBDA_ARN || 'graphene-screenshot'
const slackMentionTs = '1773090520.155079'
const devOrgId = 'organization-test-fe0fbae3-a479-4b60-8e80-7a76e76cc35d'
const devRepoId = 'testrepo'

const markdown = `
\`\`\`sql flights_by_carrier
SELECT
    carriers.name as carrier_name,
    count(*) as flight_count
FROM flights
JOIN carriers ON flights.carrier = carriers.code
GROUP BY carriers.name
ORDER BY flight_count DESC
\`\`\`

<BarChart data="flights_by_carrier" x="carrier_name" y="flight_count" title="Number of Flights by Carrier" />
`.trim()

function main() {
  let subcommand = process.argv[2]
  if (!subcommand || !['slack', 'renderMd', 'dynamic'].includes(subcommand)) {
    throw new Error('Usage: node scripts/agentTest.ts <slack|renderMd|dynamic>')
  }

  if (subcommand === 'slack') return runSlack()
  if (subcommand === 'renderMd') return runRenderMd()
  return runDynamic()
}

async function runSlack() {
  let signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) throw new Error('Missing SLACK_SIGNING_SECRET')

  let reqTs = String(Math.floor(Date.now() / 1000))
  let body = JSON.stringify({
    type: 'event_callback',
    team_id: 'T096DPPTGEM',
    event: {
      type: 'app_mention',
      channel: 'C0AG074FSGJ',
      user: 'U999',
      text: '<@U_BOT> make a simple bar chart showing number of flights by carrier',
      ts: slackMentionTs,
    },
  })

  let signature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(`v0:${reqTs}:${body}`).digest('hex')
  let response = await fetch(`${localBaseUrl}/_api/slack/events`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-slack-request-timestamp': reqTs,
      'x-slack-signature': signature,
    },
    body,
  })

  console.log(`Slack event status: ${response.status}`)
  console.log(await response.text())
}

async function runRenderMd() {
  let baseUrl = await getDevTunnelUrl()
  let token = generateAgentToken(devOrgId)
  let md = Buffer.from(markdown).toString('base64')
  let url = `${baseUrl}/_api/dynamic?md=${encodeURIComponent(md)}&repoId=${encodeURIComponent(devRepoId)}`

  let lambda = new LambdaClient({region: process.env.AWS_REGION || 'us-east-1'})
  let response = await lambda.send(new InvokeCommand({
    FunctionName: screenshotLambda,
    Payload: JSON.stringify({url, token}),
  }))
  let payload = response.Payload && JSON.parse(Buffer.from(response.Payload).toString())

  let renderErrors = Array.isArray(payload?.errors) ? payload.errors : []
  let pageErrors = Array.isArray(payload?.pageErrors) ? payload.pageErrors : []
  let rows = payload?.queryData?.flights_by_carrier?.rows
  if (response.FunctionError || !payload?.success || !payload?.screenshot || renderErrors.length || pageErrors.length || !Array.isArray(rows) || rows.length === 0) {
    throw new Error(JSON.stringify({
      error: payload?.error || payload?.errorMessage || 'renderMd invocation failed',
      renderErrors,
      pageErrors,
      hasScreenshot: !!payload?.screenshot,
      rowCount: Array.isArray(rows) ? rows.length : 0,
    }))
  }

  let rootDir = path.resolve(fileURLToPath(import.meta.url), '../..')
  let outputPath = path.join(rootDir, 'agentTest-renderMd-screenshot.png')
  await fs.writeFile(outputPath, Buffer.from(payload.screenshot, 'base64'))
  console.log(`Wrote screenshot to ${outputPath}`)
}

function runDynamic() {
  let md = Buffer.from(markdown).toString('base64')
  let url = `${localBaseUrl}/_api/dynamic?md=${encodeURIComponent(md)}&repoId=${encodeURIComponent(devRepoId)}`
  openUrl(url)
  console.log(url)
}

async function getDevTunnelUrl() {
  let response = await fetch(`${localBaseUrl}/_api/dev/ngrok-url`)
  if (!response.ok) throw new Error(`Could not load ngrok URL from ${localBaseUrl}. Is cloud dev server running with --ngrok?`)
  let body = await response.json() as {url?: string}
  if (!body.url) throw new Error('Dev ngrok URL response missing url')
  return body.url
}

function openUrl(url: string) {
  let cmd = 'xdg-open'
  if (process.platform === 'darwin') cmd = 'open'
  if (process.platform === 'win32') cmd = 'cmd'

  let args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  let child = spawn(cmd, args, {stdio: 'ignore', detached: true})
  child.on('error', () => {})
  child.unref()
}

await main()
