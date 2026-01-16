import {ModalClient} from 'modal'
import {eq} from 'drizzle-orm'
import {getDb} from '../db.ts'
import {repos, orgs} from '../../schema.ts'
import {generateAgentToken} from './tokens.ts'

// Lazy-initialized Modal client
let modalClient: ModalClient | null = null

export function getModalClient () {
  if (!modalClient) {
    modalClient = new ModalClient({
      tokenId: process.env.MODAL_TOKEN_ID,
      tokenSecret: process.env.MODAL_TOKEN_SECRET,
    })
  }
  return modalClient
}

export interface CaptureResult {
  success: boolean
  screenshot?: string
  error?: string
  timings?: Record<string, number | Record<string, number>>
}

// Render markdown to an image by posting to the dynamic endpoint
export async function renderMd (markdown: string, repoId: string): Promise<CaptureResult> {
  // Look up org for this repo to get the subdomain and generate token
  let repo = await getDb().select({orgId: repos.orgId}).from(repos).where(eq(repos.id, repoId)).get()
  if (!repo) return {success: false, error: 'Repo not found'}

  let org = await getDb().select({slug: orgs.slug}).from(orgs).where(eq(orgs.id, repo.orgId)).get()
  if (!org) return {success: false, error: 'Org not found'}

  let token = generateAgentToken(repo.orgId, repoId)
  let url = `https://${org.slug}.graphenedata.com`

  return execInSandbox(url, `
    const html = await page.evaluate(async ({markdown, token}) => {
      const res = await fetch('/_api/dynamic', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({markdown, token})
      });
      if (!res.ok) throw new Error('Failed to render: ' + res.status + ' ' + (await res.text()));
      return res.text();
    }, {markdown: ${JSON.stringify(markdown)}, token: ${JSON.stringify(token)}});
    mark('fetch');

    await page.setContent(html, {waitUntil: 'domcontentloaded'});
    mark('setContent');

    await page.waitForTimeout(2000);
    mark('renderWait');

    resp.screenshot = (await page.screenshot({type: 'png', animations: 'disabled', fullPage: true})).toString('base64');
    resp.success = true;
  `)
}

async function execInSandbox (url: string, code: string): Promise<CaptureResult> {
  let timings: Record<string, number> = {}
  let last = Date.now()
  let mark = (key: string) => {
    let now = Date.now()
    timings[key] = now - last
    last = now
  }

  // Build the script to run in the sandbox
  let script = `
(async () => {
  let timings = {};
  let last = Date.now();
  function mark(key) {
    let now = Date.now();
    timings[key] = now - last;
    last = now;
  }

  try {
    const {chromium} = require('playwright-core');
    mark('require');

    const browser = await chromium.connectOverCDP('http://localhost:9222');
    mark('connected');
    const context = await browser.newContext({viewport: {width: 1280, height: 720}});
    const page = await context.newPage();
    mark('newPage');
    await page.goto(${JSON.stringify(url)}, {waitUntil: 'domcontentloaded', timeout: 30000});
    mark('pageLoad');

    let resp = {timings};
    ${code}
    console.log(JSON.stringify(resp));
  } catch (err) {
    console.log(JSON.stringify({success: false, error: err.message, timings}));
  }
  process.exit(0);
})();
`

  let client = getModalClient()

  // let cfg = await getDb().select({modalSnapshotId: config.modalSnapshotId}).from(config).get()
  let snapshotId = await setupModalSnapshot()
  let restoreResp = await client.cpClient.sandboxRestore({snapshotId})
  mark('restore')

  let sb = await client.sandboxes.fromId(restoreResp.sandboxId)
  let proc = await sb.exec(['node', '-e', script], {stdout: 'pipe', stderr: 'pipe'})
  mark('execStart')

  await proc.wait()
  mark('execFinish')

  let [stdout, stderr] = await Promise.all([
    proc.stdout.readText(),
    proc.stderr.readText(),
  ])

  sb.terminate() // intentionally don't wait on this

  try {
    let resp = JSON.parse(stdout.trim().split('\n').pop() || '{}')
    return {...resp, timings: {...timings, pw: resp.timings}}
  } catch {
    console.error('stdout:', stdout)
    console.error('stderr:', stderr)
    return {success: false, error: 'Failed to parse sandbox output', timings}
  }
}

/**
 * Capture a screenshot of a URL using a Modal memory snapshot.
 * Chrome is already running when the snapshot is restored, making this fast.
 */
export async function captureScreenshot (url: string, selector?: string): Promise<CaptureResult> {
  return await execInSandbox(url, `
    ${selector ? `await page.waitForSelector(${JSON.stringify(selector)}, {timeout: 10000});\nmark('selector');` : ''}
    resp.screenshot = (await page.screenshot({type: 'png', animations: 'disabled'})).toString('base64');
    resp.success = true;
  `)
}

// Create a snapshot on Modal that has chrome running, waiting for a cdp connection
export async function setupModalSnapshot () {
  let client = getModalClient()
  let app = await client.apps.fromName('graphene-sandbox', {createIfMissing: true})

  // Build image with playwright-core installed
  let image = client.images
    .fromRegistry('node:24-slim')
    .dockerfileCommands([
      'RUN npx playwright install chromium --with-deps',
      'WORKDIR /app',
      'RUN npm install playwright-core',
    ])
  let builtImage = await image.build(app)

  // Create sandbox with snapshot enabled using low-level API, as `enableSnapshot` isn't in the api yet
  let createResp = await client.cpClient.sandboxCreate({
    appId: app.appId,
    definition: {
      imageId: builtImage.imageId,
      entrypointArgs: [
        '/root/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell',
        '--no-sandbox',
        '--remote-debugging-port=9222',
        'https://app.graphenedata.com', // prime the cache
      ],
      resources: {
        memoryMb: 256,
        milliCpu: 1000,
      },
      mountIds: [],
      secretIds: [],
      timeoutSecs: 300,
      runtimeDebug: false,
      blockNetwork: false,
      nfsMounts: [],
      s3Mounts: [],
      cloudBucketMounts: [],
      volumeMounts: [],
      i6pnEnabled: false,
      enableSnapshot: true,
      cloudProviderStr: '',
      verbose: false,
    },
  })

  let sb = await client.sandboxes.fromId(createResp.sandboxId)
  await new Promise(r => setTimeout(r, 10000)) // Wait for Chrome to start and prime the cache
  let snapshotResp = await client.cpClient.sandboxSnapshot({sandboxId: sb.sandboxId})
  let modalSnapshotId = snapshotResp.snapshotId

  return modalSnapshotId
}
