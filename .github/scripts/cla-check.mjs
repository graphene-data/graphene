// CLA-check script. Runs in the cla-check.yml workflow on every PR open /
// synchronize / reopen and on /recheck comments.
//
// Decision flow:
//   1. Skip bots (`*[bot]`).
//   2. If the PR author is a member of graphene-data, pass.
//   3. Otherwise, look up the author in column C of the CLA signatures sheet.
//      Signed → pass. Unsigned → fail and post (or update) a PR comment.
//
// Side effects: GitHub commit status on the PR head SHA, and at most one
// PR comment identified by the marker below.

import {createSign} from 'node:crypto'

const ORG = 'graphene-data'
const COMMENT_MARKER = '<!-- cla-check-bot -->'
const STATUS_CONTEXT = 'CLA'

function need(name) {
  let v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function ghFetch(token, path, init = {}) {
  let res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'graphene-cla-check',
      ...(init.headers ?? {}),
    },
  })
  return res
}

export async function isOrgMember(login, {fetchOrgMembership}) {
  if (!login || login.endsWith('[bot]')) return true
  return await fetchOrgMembership(login)
}

export async function isSignedInSheet(login, {fetchSignedUsernames}) {
  let usernames = await fetchSignedUsernames()
  let target = login.toLowerCase()
  return usernames.some(u => u.toLowerCase() === target)
}

export async function runCheck(deps) {
  let {author, log = console.log} = deps

  if (!author) {
    log('No PR author; nothing to check.')
    return {decision: 'skip'}
  }

  if (author.endsWith('[bot]')) {
    log(`Author ${author} is a bot; marking CLA as not required.`)
    await deps.setStatus('success', 'Bot author — CLA not required')
    return {decision: 'bot'}
  }

  if (await isOrgMember(author, deps)) {
    log(`${author} is a member of ${ORG}; CLA not required.`)
    await deps.setStatus('success', 'Internal contributor — CLA not required')
    await deps.dismissCommentIfPresent()
    return {decision: 'internal'}
  }

  if (await isSignedInSheet(author, deps)) {
    log(`${author} is in the signatures sheet.`)
    await deps.setStatus('success', 'CLA signed')
    await deps.dismissCommentIfPresent()
    return {decision: 'signed'}
  }

  log(`${author} has not signed; posting comment and failing status.`)
  await deps.upsertComment(buildBlockingComment(author))
  await deps.setStatus('failure', 'CLA not signed')
  return {decision: 'unsigned'}
}

function buildBlockingComment(author) {
  let url = `https://graphenedata.com/cla?username=${encodeURIComponent(author)}`
  return [
    COMMENT_MARKER,
    `Hi @${author}, thanks for the contribution! Before we can merge, we need you to sign our Contributor License Agreement at ${url}.`,
    '',
    "Signing is a one-time thing — once your GitHub username is on file you're covered for any future contributions to this repo. After you submit the form, comment `/recheck` on this PR (or push a new commit) and I'll re-check.",
  ].join('\n')
}

function buildClearedComment(author) {
  return [COMMENT_MARKER, `Thanks for signing the CLA, @${author}! You're cleared to contribute — this check will stay green for any future PRs you open.`].join('\n')
}

// ----- Google service-account JWT → access token -----

function b64url(input) {
  return Buffer.from(input).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export async function getGoogleAccessToken(saKeyJson, scope = 'https://www.googleapis.com/auth/spreadsheets.readonly') {
  let key = typeof saKeyJson === 'string' ? JSON.parse(saKeyJson) : saKeyJson
  let now = Math.floor(Date.now() / 1000)
  let header = b64url(JSON.stringify({alg: 'RS256', typ: 'JWT'}))
  let claim = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  let signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claim}`)
  let sig = b64url(signer.sign(key.private_key))
  let assertion = `${header}.${claim}.${sig}`

  let res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`)
  let json = await res.json()
  return json.access_token
}

export async function fetchSheetUsernames({sheetId, accessToken, range = 'Signatures!C:C'}) {
  let url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`
  let res = await fetch(url, {headers: {Authorization: `Bearer ${accessToken}`}})
  if (!res.ok) throw new Error(`Sheets API failed: ${res.status} ${await res.text()}`)
  let json = await res.json()
  let rows = json.values ?? []
  // Drop the header row and any blanks; the first row is the column label.
  return rows
    .slice(1)
    .map(row => (row?.[0] ?? '').toString().trim())
    .filter(Boolean)
}

// ----- Real GitHub-flavored implementations of the deps -----

async function buildLiveDeps() {
  let githubToken = need('GITHUB_TOKEN')
  let claBotToken = need('CLA_BOT_TOKEN')
  let repo = need('REPO')
  let prNumber = Number(need('PR_NUMBER'))
  let author = need('PR_AUTHOR')

  let pr = await ghFetch(githubToken, `/repos/${repo}/pulls/${prNumber}`).then(r => r.json())
  let headSha = pr.head?.sha
  if (!headSha) throw new Error(`Could not resolve head SHA for PR #${prNumber}`)

  return {
    author,
    prNumber,

    async fetchOrgMembership(login) {
      let res = await ghFetch(claBotToken, `/orgs/${ORG}/members/${encodeURIComponent(login)}`)
      if (res.status === 204) return true
      if (res.status === 404 || res.status === 302) return false
      throw new Error(`Org membership lookup failed: ${res.status} ${await res.text()}`)
    },

    async fetchSignedUsernames() {
      let accessToken = await getGoogleAccessToken(need('GCP_SA_KEY'))
      return fetchSheetUsernames({sheetId: need('SHEET_ID'), accessToken})
    },

    async setStatus(state, description) {
      let res = await ghFetch(githubToken, `/repos/${repo}/statuses/${headSha}`, {
        method: 'POST',
        body: JSON.stringify({
          state,
          context: STATUS_CONTEXT,
          description,
          target_url: 'https://graphenedata.com/cla',
        }),
      })
      if (!res.ok) throw new Error(`setStatus failed: ${res.status} ${await res.text()}`)
    },

    async upsertComment(body) {
      let existing = await findBotComment(githubToken, repo, prNumber)
      if (existing) {
        let res = await ghFetch(githubToken, `/repos/${repo}/issues/comments/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({body}),
        })
        if (!res.ok) throw new Error(`comment update failed: ${res.status} ${await res.text()}`)
      } else {
        let res = await ghFetch(githubToken, `/repos/${repo}/issues/${prNumber}/comments`, {
          method: 'POST',
          body: JSON.stringify({body}),
        })
        if (!res.ok) throw new Error(`comment create failed: ${res.status} ${await res.text()}`)
      }
    },

    async dismissCommentIfPresent() {
      let existing = await findBotComment(githubToken, repo, prNumber)
      if (!existing) return
      let res = await ghFetch(githubToken, `/repos/${repo}/issues/comments/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({body: buildClearedComment(author)}),
      })
      if (!res.ok) throw new Error(`comment dismiss failed: ${res.status} ${await res.text()}`)
    },
  }
}

async function findBotComment(token, repo, prNumber) {
  // PRs rarely have many comments; one page (default 30) is fine for v1.
  let res = await ghFetch(token, `/repos/${repo}/issues/${prNumber}/comments?per_page=100`)
  if (!res.ok) throw new Error(`list comments failed: ${res.status} ${await res.text()}`)
  let comments = await res.json()
  return comments.find(c => typeof c.body === 'string' && c.body.includes(COMMENT_MARKER))
}

// ----- CLI entry point -----

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  let deps = await buildLiveDeps()
  let result = await runCheck(deps)
  console.log('result:', result)
}
