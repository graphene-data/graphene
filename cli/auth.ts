import {spawn} from 'child_process'
import http from 'http'
import fs from 'node:fs/promises'
import os from 'os'
import path from 'path'

import {config} from '../lang/config.ts'

export const AUTH_CLIENT_ID =
  process.env.AUTH_CLIENT_ID || (process.env.NODE_ENV == 'test' ? 'connected-app-test-1e207553-009e-4382-9bc1-27aceac2a7a0' : 'connected-app-live-8264d0af-df18-4021-af96-157482d17856')

export const AUTH_SCOPES = 'offline_access'

export interface Cred {
  access_token: string
  refresh_token?: string
  token_type: string
  scope?: string
  expires_in: number // oauth gives us this
  expires_at: number // we also store this, so we can see if it the token has expired
}

const cfgDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
const credsPath = path.join(cfgDir, 'graphene', 'credentials.json')

async function readStore(): Promise<any> {
  try {
    let txt = await fs.readFile(credsPath, 'utf8')
    return JSON.parse(txt) || {}
  } catch {
    return {}
  }
}

async function readEntry(): Promise<Cred | null> {
  let store = await readStore()
  return store[config.root]
}

async function updateEntry(cred: Cred) {
  let store = await readStore()
  cred.refresh_token ||= store[config.root]?.refresh_token
  cred.expires_at = Date.now() + cred.expires_in
  store[config.root] = cred

  await fs.mkdir(path.dirname(credsPath), {recursive: true, mode: 0o700})
  await fs.writeFile(credsPath, JSON.stringify(store, null, 2) + '\n', {mode: 0o600})
  if (process.platform !== 'win32') {
    await fs.chmod(credsPath, 0o600).catch(() => {})
  }
}

export function openInBrowser(url: string) {
  try {
    let plat = process.platform
    let cmd = 'xdg-open'
    if (plat == 'darwin') cmd = 'open'
    if (plat == 'win32') cmd = 'start'
    let p = spawn(cmd, [url], {stdio: 'ignore', shell: plat === 'win32'})
    p.unref()
  } catch {
    console.log(`Open this URL to authenticate:\n${url}`)
  }
}

// PKCE login flow (Authorization Code with loopback)
function base64url(buf: ArrayBuffer | Uint8Array): string {
  let b64 = Buffer.from(buf as any).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function randomBytes(len = 32): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(len))
}

// Temporary local server that listens for the callback url after at the end of oauth.
async function startLoopback() {
  let server = http.createServer()
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()))
  let addr = server.address()
  if (!addr || typeof addr !== 'object') throw new Error('Couldnt start oauth callback server')
  let redirectBase = `http://127.0.0.1:${addr.port}`

  let waitForCode = new Promise<{code: string; state: string}>(resolve => {
    server.on('request', (req, res) => {
      let url = new URL(req.url || '/', redirectBase)
      if (url.pathname !== '/callback') {
        res.statusCode = 404
        res.end('Not Found')
        return
      }
      let code = url.searchParams.get('code') || ''
      let state = url.searchParams.get('state') || ''
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.end('<html><body>Login complete. You may close this window.</body></html>')
      resolve({code, state})
    })
  })
  return {url: redirectBase, waitForCode, close: () => server.close()}
}

export async function loginPkce(opener?: (url: string) => Promise<void>) {
  let verifier = base64url(randomBytes(48))
  let data = new TextEncoder().encode(verifier)
  let digest = await crypto.subtle.digest('SHA-256', data)
  let code_challenge = base64url(digest) // pkce challenge

  let state = base64url(randomBytes(16))
  let loop = await startLoopback()
  let redirect_uri = `${loop.url}/callback`

  // Build authorize URL (merge with provided URL if present)
  let authorizeUrl = new URL(`${config.host}/authenticate`)
  authorizeUrl.search = new URLSearchParams({
    redirect_uri,
    code_challenge,
    state,
    client_id: AUTH_CLIENT_ID,
    response_type: 'code',
    code_challenge_method: 'S256',
    scope: AUTH_SCOPES,
  }).toString()

  if (opener) await opener(authorizeUrl.toString())
  else openInBrowser(authorizeUrl.toString())

  let result = await loop.waitForCode
  if (!result.code) throw new Error('No authorization code received')
  if (result.state !== state) throw new Error('State mismatch')

  let res = await fetch(`${config.host}/_api/oauth2/token`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: result.code,
      redirect_uri,
      client_id: AUTH_CLIENT_ID,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`)
  let tokenResp = await res.json()
  await updateEntry(tokenResp)
}

async function refreshAccessToken() {
  let refresh_token = (await readEntry())?.refresh_token
  let res = await fetch(new URL('/_api/oauth2/token', config.host).toString(), {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({grant_type: 'refresh_token', refresh_token, client_id: AUTH_CLIENT_ID}),
  })
  if (!res.ok) throw new Error(`refresh failed: ${res.status}`)
  let json = await res.json()
  await updateEntry(json)
}

// Makes a request to your Graphene cloud server with credentials stored from `graphene login`
export async function authenticatedFetch(pathOrUrl: string, init: RequestInit = {}): Promise<Response> {
  let entry = await readEntry()
  if (!entry) throw new Error('Not logged in; run `graphene login`')

  // if we know the access token is no good, refresh it now
  if (!entry.access_token || entry.expires_at < Date.now()) {
    await refreshAccessToken()
    entry = await readEntry()
  }
  let token = entry?.access_token
  if (!token) throw new Error('Failed to obtain access token')

  // make a request with the authorization header set
  let url = new URL(pathOrUrl, config.host)
  let headers = new Headers(init.headers || {})
  headers.set('authorization', `Bearer ${token}`)

  let res = await fetch(url.toString(), {...init, headers})

  // if the request failed, try refreshing our access token
  if (res.status === 401 || res.status === 403) {
    await refreshAccessToken()
    token = (await readEntry())?.access_token
    if (token) {
      headers.set('cookie', `access_token=${token}`)
      res = await fetch(url.toString(), {...init, headers})
    }
  }
  return res
}
