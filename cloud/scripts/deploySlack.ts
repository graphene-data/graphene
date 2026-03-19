// This script deploys the Slack Graphene app manifest.
// Usage: `SLACK_APP_CONFIG_TOKEN=<token> node cloud/scripts/deploySlack.ts <local|staging|prod> <validate|update>`
// You'll need to generate a config token at https://api.slack.com/apps. They last 12h

type Mode = 'validate' | 'create' | 'update'
type Environment = 'local' | 'staging' | 'prod'

const baseUrls: Record<Environment, string> = {
  local: 'https://interruptedly-dauntless-cherrie.ngrok-free.dev',
  staging: 'https://app.graphene-staging.com',
  prod: 'https://app.graphenedata.com',
}

const appIds: Record<Environment, string> = {
  local: 'A0AFJNR00CF',
  staging: 'A0AJ0RR96F8',
  prod: 'A0AHMEDED9D',
}

let environment = process.argv[2] as Environment | undefined
let mode = process.argv[3] as Mode | undefined
if (!mode || !environment || !['validate', 'create', 'update'].includes(mode) || !['local', 'staging', 'prod'].includes(environment)) {
  throw new Error('Usage: node scripts/deploySlack.ts <local|staging|prod> <validate|create|update>')
}

let appConfigToken = process.env.SLACK_APP_CONFIG_TOKEN || ''
if (!appConfigToken) throw new Error('Missing slack app config token')

let baseUrl = baseUrls[environment]
if (!baseUrl) throw new Error(`Missing base URL for ${environment} in scripts/deploySlack.ts`)
let manifest = buildManifest(environment, baseUrl)

await slackManifestRequest('apps.manifest.validate', {manifest}, appConfigToken)
console.log(`Slack manifest is valid for ${environment}`)

if (mode === 'validate') process.exit(0)

if (mode === 'create') {
  let createResult = await slackManifestRequest('apps.manifest.create', {manifest}, appConfigToken)
  let appId = createResult.app_id
  if (!appId) throw new Error('Slack API did not return app_id')
  console.log(`Created Slack app (${environment}): ${appId}`)
  process.exit(0)
}

let appId = appIds[environment]
if (!appId) throw new Error('Missing SLACK_APP_ID for update mode')

await slackManifestRequest('apps.manifest.update', {app_id: appId, manifest}, appConfigToken)
console.log(`Updated Slack app (${environment}): ${appId}`)

interface SlackResponse {
  ok: boolean
  error?: string
  app_id?: string
}

function buildManifest(environment: Environment, baseUrl: string) {
  let appName = process.env.SLACK_APP_NAME || (environment === 'prod' ? 'Graphene' : `Graphene (${environment})`)
  return {
    _metadata: {
      major_version: 1,
      minor_version: 1,
    },
    display_information: {
      name: appName,
    },
    features: {
      bot_user: {
        display_name: appName,
        always_online: true,
      },
    },
    oauth_config: {
      redirect_urls: [`${baseUrl}/_api/slack/oauth/callback`],
      scopes: {
        bot: ['app_mentions:read', 'chat:write', 'channels:history', 'im:history', 'files:write', 'users:read', 'reactions:write'],
      },
    },
    settings: {
      event_subscriptions: {
        request_url: `${baseUrl}/_api/slack/events`,
        bot_events: ['app_mention', 'message.im'],
      },
      interactivity: {
        is_enabled: false,
      },
      org_deploy_enabled: false,
      socket_mode_enabled: false,
      token_rotation_enabled: false,
    },
  }
}

async function slackManifestRequest(method: string, body: Record<string, unknown>, token: string) {
  let response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) throw new Error(`Slack API ${method} failed with status ${response.status}`)

  let payload = (await response.json()) as SlackResponse
  if (!payload.ok) throw new Error(`Slack API ${method} error: ${payload.error ?? 'unknown error'}`)

  return payload
}
