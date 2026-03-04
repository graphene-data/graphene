import type {FastifyReply, FastifyRequest} from 'fastify'
import crypto from 'node:crypto'
import {and, desc, eq} from 'drizzle-orm'
import SlackOauth from '@slack/oauth'
import {WebClient, type WebAPICallResult, type ConversationsRepliesResponse, type OauthV2AccessResponse} from '@slack/web-api'
import type {AppMentionEvent, SlackEvent} from '@slack/types'
import {runAgent} from './agent/agent.ts'
import {auth} from './auth.ts'
import {PROD, TEST} from './consts.ts'
import {getDb} from './db.ts'
import {decryptSecret, encryptSecret} from './secrets.ts'
import {agentSessions, repos, type SlackInstallation, slackInstallations} from '../schema.ts'
import { type StepResult } from 'ai'

const slackClientId = process.env.SLACK_CLIENT_ID || ''
const slackClientSecret = process.env.SLACK_CLIENT_SECRET || ''
if (!TEST && (!slackClientId || !slackClientSecret)) throw new Error('Missing SLACK_CLIENT_ID or SLACK_CLIENT_SECRET')
const {ClearStateStore} = SlackOauth

let slackMock: ((endpoint: string, body: any) => any | Promise<any>) | null = null
let slackStateStore: InstanceType<typeof ClearStateStore> | null = null
let slackWebClient = new WebClient()

let slackScopes = ['app_mentions:read', 'chat:write', 'channels:history', 'im:history', 'files:write', 'users:read', 'reactions:write']

export function mockSlackApi (handler: ((endpoint: string, body: any) => any | Promise<any>) | null) {
  slackMock = handler
}

// Returns whether the current Graphene org has a Slack workspace connected.
export async function slackStatus (req: FastifyRequest, reply: FastifyReply) {
  await auth(req, reply)
  let installation = await getDb().select({teamId: slackInstallations.teamId, teamName: slackInstallations.teamName})
    .from(slackInstallations)
    .where(eq(slackInstallations.orgId, req.auth.orgId))
    .then(rows => rows[0])

  if (!installation) return reply.send({connected: false})
  reply.send({connected: true, teamId: installation.teamId, teamName: installation.teamName})
}

// Starts Slack OAuth for the authenticated org and embeds orgId in OAuth state metadata.
export async function slackInstall (req: FastifyRequest, reply: FastifyReply) {
  await auth(req, reply)
  let state = await getSlackStateStore().generateStateParam({
    scopes: slackScopes,
    metadata: req.auth.orgId,
    redirectUri: getSlackRedirectUri(req),
  }, new Date())

  let url = new URL('https://slack.com/oauth/v2/authorize')
  url.searchParams.set('client_id', slackClientId)
  url.searchParams.set('scope', slackScopes.join(','))
  url.searchParams.set('redirect_uri', getSlackRedirectUri(req))
  url.searchParams.set('state', state)
  reply.redirect(url.toString())
}

// Handles Slack OAuth callback and upserts workspace->org installation credentials.
export async function slackOauthCallback (req: FastifyRequest, reply: FastifyReply) {
  let query = req.query as {code?: string; state?: string; error?: string}
  if (query.error) return reply.code(400).send({error: `Slack OAuth failed: ${query.error}`})
  if (!query.code || !query.state) return reply.code(400).send({error: 'Missing code or state'})

  let installOptions = await getSlackStateStore().verifyStateParam(new Date(), query.state)
  if (!installOptions.metadata) return reply.code(400).send({error: 'Missing org mapping metadata in OAuth state'})

  let oauth = await exchangeSlackOauthCode(query.code, installOptions.redirectUri || getSlackRedirectUri(req))
  if (!oauth.team?.id || !oauth.access_token) throw new Error('Slack OAuth did not return team ID and access token')

  let encryptedToken = await encryptSecret(oauth.access_token)
  let db = getDb()
  await db.delete(slackInstallations).where(eq(slackInstallations.orgId, installOptions.metadata))
  await db.insert(slackInstallations).values({
    teamId: oauth.team.id,
    teamName: oauth.team.name || oauth.team.id,
    enterpriseId: oauth.enterprise?.id || '',
    orgId: installOptions.metadata,
    oauthToken: encryptedToken,
    installedByUserId: oauth.authed_user?.id,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [slackInstallations.teamId, slackInstallations.enterpriseId],
    set: {
      orgId: installOptions.metadata,
      teamName: oauth.team.name || oauth.team.id,
      oauthToken: encryptedToken,
      installedByUserId: oauth.authed_user?.id,
      updatedAt: new Date(),
    },
  })

  reply.redirect('/settings/repos')
}

// Entry point for Slack Events API requests; verifies signature before routing.
export async function slackEvents (req: FastifyRequest, reply: FastifyReply) {
  if (!verifySlackRequest(req)) return reply.code(401).send({error: 'Invalid Slack signature'})
  let body = req.body as any

  // Slack sends a challenge payload when validating the request URL.
  if (body?.type === 'url_verification') return reply.code(200).send({challenge: body.challenge})

  // We only handle the `event` style api callbacks (not RTM)
  if (body?.type !== 'event_callback') return reply.code(200).send({ok: true})

  let install = await getDb().select().from(slackInstallations)
    .where(eq(slackInstallations.teamId, body.team_id))
    .then(rows => rows[0])
  if (!install) throw new Error('Got slackEvent for unknown team')

  reply.code(200).send({ok: true}) // send response immediately so slack doesn't retry

  let event = body.event as SlackEvent
  if (event.type == 'app_mention') {
    await handleAppMention(install, event as AppMentionEvent)
  } else {
    console.warn('Unexpected event', event.type)
  }
}

// Resolves installation + repo for a workspace mention, then posts an agent answer.
async function handleAppMention (install: SlackInstallation, mention: AppMentionEvent) {
  let db = getDb()
  let repo = await db.select({id: repos.id}).from(repos)
    .where(eq(repos.orgId, install.orgId))
    .orderBy(desc(repos.updatedAt))
    .then(rows => rows[0])
  if (!repo) throw new Error('No repo for slackbot to use')

  let threadTs = mention.thread_ts || mention.ts
  // await slackApi('reactions.add', {channel: mention.channel, timestamp: mention.ts, name: 'eyes'}, install)

  let session = await findOrCreateSlackSession({orgId: install.orgId, repoId: repo.id, channel: mention.channel, threadTs})

  // load all the messages in the tread that mentions Graphene.
  let lastSentMessgeId = session.messages.map(m => m.messageId).filter(x => !!x).at(-1)
  let response = await slackApi<ConversationsRepliesResponse>('conversations.replies', {channel: mention.channel, ts: threadTs, limit: 50}, install)
  let threadMessages = (response.messages || [])
    .filter(m => !lastSentMessgeId || !m.ts || m.ts > lastSentMessgeId) // if resuming a session, exclude messages we already gave to the agent
    .filter(m => m.text && (!m.ts || m.ts < mention.ts)) // only include messages before the mention
    .map(m => `user:${m.user || m.bot_id || 'unknown'}: ${m.text}`)

  // If this is a thread, add all the messages in the thread to the prompt.
  let prompt = `Latest mention: ${mention.text}`
  if (threadMessages.length) prompt += `\nThread context:\n${threadMessages.join('\n')}`

  session.messages.push({role: 'user', content: [{type: 'text', text: prompt}]})
  let result = await runAgent(session)

  // look at the agent result and pull out runMd/respondToUser calls
  let toolResults = (result.steps || []).flatMap((s: StepResult<any>) => s.toolResults || []) as {toolName?: string, output?: any}[]
  let respondToUser = toolResults.find(tr => tr.toolName === 'respondToUser')
  let mdId = respondToUser?.output?.mdId
  let runMd = toolResults.find(tr => tr.toolName === 'renderMd' && tr.output?.mdId === mdId)
  let screenshot = runMd?.output.screenshot
  let text = respondToUser?.output?.text || result.text

  if (screenshot) {
    let file = Buffer.from(screenshot, 'base64')
    await slackApi('files.uploadV2', {channel_id: mention.channel, thread_ts: threadTs, filename: `chart.png`, file, initial_comment: text}, install)
  } else {
    await slackApi('chat.postMessage', {channel: mention.channel, text, thread_ts: threadTs}, install)
  }
  // // await slackApi('reactions.remove', {channel: mention.channel, timestamp: mention.ts, name: 'eyes'}, install)
}

/** Find the existing Slack thread session, or create a new one. */
async function findOrCreateSlackSession ({orgId, repoId, channel, threadTs}: {orgId: string, repoId: string, channel: string, threadTs: string}) {
  let db = getDb()
  let existing = await db.select()
    .from(agentSessions)
    .where(and(
      eq(agentSessions.orgId, orgId),
      eq(agentSessions.slackChannel, channel),
      eq(agentSessions.slackThreadTs, threadTs),
    ))
    .then(rows => rows[0])

  if (existing) return existing

  let created = await db.insert(agentSessions).values({
    orgId,
    repoId,
    slackChannel: channel,
    slackThreadTs: threadTs,
    messages: [],
    updatedAt: new Date(),
  }).returning().then(rows => rows[0])

  if (!created) throw new Error('Failed to create agent session')
  return created
}

// Exchanges a Slack OAuth code for install credentials via Slack Web API.
async function exchangeSlackOauthCode (code: string, redirectUri: string): Promise<OauthV2AccessResponse> {
  if (process.env.NODE_ENV === 'test' && slackMock) {
    return await slackMock('oauth.v2.access', {client_id: slackClientId, client_secret: slackClientSecret, code, redirect_uri: redirectUri})
  }

  let payload = await slackWebClient.oauth.v2.access({client_id: slackClientId, client_secret: slackClientSecret, code, redirect_uri: redirectUri}) as OauthV2AccessResponse
  if (!payload.ok) throw new Error(`Slack OAuth error: ${payload.error ?? 'unknown error'}`)
  return payload
}

// Shared wrapper for Slack API calls with test interception and token handling.
export async function slackApi<T = {ok: boolean; error?: string}> (method: string, params: any, installation?: SlackInstallation): Promise<T> {
  if (process.env.NODE_ENV === 'test' && slackMock) {
    return await slackMock(method, params)
  }

  if (!installation) throw new Error('Missing Slack installation for API call')
  let authToken = await decryptSecret(installation.oauthToken)

  let payload = await new WebClient(authToken).apiCall(method, params) as WebAPICallResult
  if (!payload.ok) throw new Error(`Slack API error: ${payload.error ?? 'unknown error'}`)
  return payload as T
}

// Lazily initializes the OAuth state store used to prevent CSRF/replay on installs.
function getSlackStateStore () {
  if (slackStateStore) return slackStateStore
  let secret = process.env.SLACK_STATE_SECRET
  if (!secret) throw new Error('Missing SLACK_STATE_SECRET')
  slackStateStore = new ClearStateStore(secret, 60 * 15)
  return slackStateStore
}

// Computes OAuth callback URL from explicit env override or request host headers.
function getSlackRedirectUri (req: FastifyRequest) {
  if (process.env.SLACK_REDIRECT_URI) return process.env.SLACK_REDIRECT_URI
  let forwardedProto = req.headers['x-forwarded-proto']
  let proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || (PROD ? 'https' : 'http')
  let forwardedHost = req.headers['x-forwarded-host']
  let host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.headers.host
  if (!host) throw new Error('Missing host header for Slack OAuth redirect URI')
  return `${proto}://${host}/_api/slack/oauth/callback`
}

// Verifies Slack request signatures using raw body + timestamp (5 minute skew window).
function verifySlackRequest (req: FastifyRequest) {
  let signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) throw new Error('Missing SLACK_SIGNING_SECRET')

  let timestampHeader = req.headers['x-slack-request-timestamp']
  let signatureHeader = req.headers['x-slack-signature']
  let timestamp = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader
  let signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader
  if (!timestamp || !signature) return false

  let reqTs = Number(timestamp)
  if (!Number.isFinite(reqTs)) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - reqTs) > 60 * 5) return false

  let rawBody = (typeof req.rawBody === 'string' ? req.rawBody : req.rawBody?.toString('utf8')) || JSON.stringify(req.body)
  let expected = 'v0=' + crypto.createHmac('sha256', signingSecret).update(`v0:${timestamp}:${rawBody}`).digest('hex')
  if (signature.length !== expected.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
