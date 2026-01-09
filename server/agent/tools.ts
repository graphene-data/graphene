import {tool} from 'ai'
import {z} from 'zod'
import {eq, like, or, and} from 'drizzle-orm'
import {getDb} from '../db.ts'
import {files} from '../../schema.ts'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {App, ModalClient, type Sandbox} from 'modal'
import Browserbase from '@browserbasehq/sdk'
import {chromium} from 'playwright-core'

let rootDir = path.resolve(fileURLToPath(import.meta.url), '../../..')

// Lazy-initialized Modal client and sandbox
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
  imageBase64?: string
  error?: string
}

/**
 * Capture a screenshot of a URL using a Modal sandbox with Playwright.
 * @param url - The URL to capture
 * @param selector - Optional CSS selector to wait for before capturing
 * @returns Base64-encoded PNG screenshot or error
 */
export async function captureScreenshot (url: string, selector?: string): Promise<CaptureResult> {
  try {
    let last = Date.now()
    let log = (msg: string) => {
      let now = Date.now()
      console.log(`[modal] ${msg}: ${now - last}ms`)
      last = now
    }

    let client = getModalClient()
    log('client created')

    let app = await client.apps.fromName('graphene-sandbox', {createIfMissing: true})
    log('app lookup')

    let image = client.images
      .fromRegistry('python:3.11-slim')
      .dockerfileCommands([
        'RUN pip install playwright',
        'RUN playwright install chromium',
        'RUN playwright install-deps chromium',
      ])

    let sb = await client.sandboxes.create(app, image, {timeoutMs: 300_000})
    log('sandbox created')

    let waitForSelector = selector
      ? `page.wait_for_selector('${selector.replace(/'/g, "\\'")}', timeout=10000)`
      : ''

    let proc = await sb.exec([
      'python3', '-c', `
import base64
import sys
import time

last = time.time()
def log(msg):
    global last
    now = time.time()
    print(f"[pw] {msg}: {int((now - last) * 1000)}ms", file=sys.stderr)
    last = now

from playwright.sync_api import sync_playwright
log("import")

with sync_playwright() as p:
    log("playwright start")
    browser = p.chromium.launch()
    log("browser launch")
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    log("new page")
    page.goto('${url.replace(/'/g, "\\'")}', wait_until='domcontentloaded', timeout=30000)
    log("page load")
    ${waitForSelector ? waitForSelector + '\n    log("selector")' : ''}
    screenshot = page.screenshot(type='png', animations='disabled')
    log("screenshot")
    encoded = base64.b64encode(screenshot).decode('utf-8')
    log("encode")
    print(encoded)
    log("print")
    browser.close()
    log("close")
`,
    ], {stdout: 'pipe', stderr: 'pipe'})
    log('exec started')

    let [stdout, stderr] = await Promise.all([
      proc.stdout.readText(),
      proc.stderr.readText(),
    ])
    log('output read')
    if (stderr) console.log(stderr.trim())

    let exitCode = await proc.wait()
    log('process wait')
    await sb.terminate()

    if (exitCode !== 0) {
      return {success: false, error: stderr || `Process exited with code ${exitCode}`}
    }

    return {success: true, imageBase64: stdout.trim()}
  } catch (err) {
    return {success: false, error: String(err)}
  }
}

/**
 * Setup function to build the image and create a snapshot with Chrome ready.
 * Run this once and save the IDs to environment variables.
 */
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
  console.log('image built', builtImage.imageId)
  let imageId = builtImage.imageId

  // Create sandbox with snapshot enabled using low-level API
  // The high-level sandboxes.create() doesn't expose enableSnapshot
  let createResp = await client.cpClient.sandboxCreate({
    appId: app.appId,
    definition: {
      imageId,
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
      enableSnapshot: true, // This is the key field!
      cloudProviderStr: '',
      verbose: false,
    },
  })

  let sb = await client.sandboxes.fromId(createResp.sandboxId)
  console.log('sandbox retrieved')


  // Wait for Chrome to start. We can't easily read from the stream while
  // keeping the process running, so just wait a fixed amount of time.
  // 10 seconds should be plenty for Playwright + Chrome to start.
  await new Promise(r => setTimeout(r, 10000))
  console.log('waited 10s for chrome')

  // Take memory snapshot using low-level API
  let snapshotResp = await client.cpClient.sandboxSnapshot({sandboxId: sb.sandboxId})
  console.log('snapshot taken', snapshotResp.snapshotId)
}

/**
 * Capture screenshot using pre-built image and memory snapshot.
 * Requires MODAL_APP_ID, MODAL_IMAGE_ID, and MODAL_SNAPSHOT_ID env vars.
 */
export async function captureScreenshotModalSnapshot (url: string, selector?: string): Promise<CaptureResult> {
  let snapshotId = 'sn-XaUMhIfobX5LFwawwCcvx4'

  let last = Date.now()
  let log = (msg: string) => {
    let now = Date.now()
    console.log(`[modal-snap] ${msg}: ${now - last}ms`)
    last = now
  }

  // Build the script to run in the sandbox
  let script = `
let last = Date.now();
function log(msg) {
  let now = Date.now();
  console.error('[pw] ' + msg + ': ' + (now - last) + 'ms');
  last = now;
}

const {chromium} = require('playwright-core');
log('require');

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  log('connected');
  const context = await browser.newContext({viewport: {width: 1280, height: 720}});
  log('context');
  const page = await context.newPage();
  log('new page');
  await page.goto(${JSON.stringify(url)}, {waitUntil: 'domcontentloaded', timeout: 30000});
  log('page load');
  ${selector ? `await page.waitForSelector(${JSON.stringify(selector)}, {timeout: 10000});\n  log('selector');` : ''}
  const screenshot = await page.screenshot({type: 'png', animations: 'disabled'});
  log('screenshot');
  console.log(JSON.stringify({success: true, imageBase64: screenshot.toString('base64')}));
  log('printed');
  await context.close();
  log('close');
  await browser.close();
  log('browser close');
  process.exit(0);
}

log('calling main');
main().catch(err => {
  console.error('[pw] ERROR:', err.message);
  console.log(JSON.stringify({success: false, error: err.message}));
  process.exit(1);
});
`

  try {
    let client = getModalClient()
    let restoreResp = await client.cpClient.sandboxRestore({snapshotId})
    log('restored from snapshot')

    let sb = await client.sandboxes.fromId(restoreResp.sandboxId)
    log('sandbox retrieved')

    // Pass the script directly to node -e
    let proc = await sb.exec(['node', '-e', script], {stdout: 'pipe', stderr: 'pipe'})
    log('exec started')

    await proc.wait()
    log('process wait')

    // Read stdout and stderr
    let [stdout, stderr] = await Promise.all([
      proc.stdout.readText(),
      proc.stderr.readText(),
    ])
    log('output read')

    // Print the script's stderr (timing logs)
    if (stderr) console.log(stderr.trim())

    await sb.terminate()
    log('terminated')

    // Find the JSON result line (starts with {)
    for (let line of stdout.split('\n')) {
      if (line.startsWith('{')) {
        return JSON.parse(line)
      }
    }

    return {success: false, error: `No JSON result found in stdout: ${stdout}`}
  } catch (err) {
    return {success: false, error: String(err)}
  }
}

/**
 * Capture a screenshot using Browserbase (cloud browser service).
 * @param url - The URL to capture
 * @param selector - Optional CSS selector to wait for before capturing
 * @returns Base64-encoded PNG screenshot or error
 */
export async function captureScreenshotBrowserbase (url: string, selector?: string): Promise<CaptureResult> {
  try {
    let last = Date.now()
    let log = (msg: string) => {
      let now = Date.now()
      console.log(`[browserbase] ${msg}: ${now - last}ms`)
      last = now
    }

    let bb = new Browserbase({apiKey: process.env.BROWSERBASE_API_KEY})
    log('client created')

    let session = await bb.sessions.create({projectId: process.env.BROWSERBASE_PROJECT_ID!})
    log('session created')

    let browser = await chromium.connectOverCDP(session.connectUrl)
    log('browser connected')

    let context = browser.contexts()[0]
    let page = context.pages()[0]
    await page.setViewportSize({width: 1280, height: 720})
    log('page ready')

    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 30000})
    log('page load')

    if (selector) {
      await page.waitForSelector(selector, {timeout: 10000})
      log('selector')
    }

    let screenshot = await page.screenshot({type: 'png', animations: 'disabled'})
    log('screenshot')

    await browser.close()
    log('close')

    return {success: true, imageBase64: screenshot.toString('base64')}
  } catch (err) {
    return {success: false, error: String(err)}
  }
}

export function listDirTool (repoId: string) {
  return tool({
    description: 'List files and directories at a path in the repository',
    inputSchema: z.object({
      path: z.string().describe('Directory path to list (use "" for root)'),
    }),
    execute: async ({path}) => {
      let prefix = path ? `${path}/` : ''
      let allFiles = await getDb()
        .select({path: files.path, extension: files.extension})
        .from(files)
        .where(eq(files.repoId, repoId))
        .all()

      // Filter to files that start with the prefix and extract immediate children
      let entries = new Set<string>()
      for (let file of allFiles) {
        let fullPath = `${file.path}.${file.extension}`
        if (!fullPath.startsWith(prefix)) continue

        let remainder = fullPath.slice(prefix.length)
        let slashIndex = remainder.indexOf('/')
        if (slashIndex === -1) {
          entries.add(remainder) // It's a file in this directory
        } else {
          entries.add(remainder.slice(0, slashIndex) + '/') // It's a subdirectory
        }
      }

      return Array.from(entries).sort()
    },
  })
}

export function readFileTool (repoId: string) {
  return tool({
    description: 'Read the contents of a file',
    inputSchema: z.object({
      path: z.string().describe('File path to read (without extension)'),
    }),
    execute: async ({path: filePath}) => {
      // Special case: docs/graphene.md is a core documentation file
      if (filePath.endsWith('docs/graphene.md') || filePath.endsWith('docs/graphene')) {
        let docsPath = path.resolve(rootDir, '../core/docs/graphene.md')
        if (fs.existsSync(docsPath)) {
          return {content: fs.readFileSync(docsPath, 'utf-8'), extension: 'md'}
        }
      }

      // Remove extension if provided
      let cleanPath = filePath.replace(/\.(md|gsql)$/, '')

      let file = await getDb()
        .select({content: files.content, extension: files.extension})
        .from(files)
        .where(and(eq(files.repoId, repoId), eq(files.path, cleanPath)))
        .get()

      if (!file) return {error: `File not found: ${filePath}`}
      return {content: file.content, extension: file.extension}
    },
  })
}

export function searchTool (repoId: string) {
  return tool({
    description: 'Search for files containing a string in their path or content',
    inputSchema: z.object({
      query: z.string().describe('Search query string'),
    }),
    execute: async ({query}) => {
      let pattern = `%${query}%`
      let results = await getDb()
        .select({path: files.path, extension: files.extension, content: files.content})
        .from(files)
        .where(and(
          eq(files.repoId, repoId),
          or(like(files.path, pattern), like(files.content, pattern)),
        ))
        .limit(20)
        .all()

      return results.map(r => {
        let preview = extractPreview(r.content, query)
        return {path: `${r.path}.${r.extension}`, preview}
      })
    },
  })
}

function extractPreview (content: string, query: string, contextChars = 100): string {
  let lowerContent = content.toLowerCase()
  let lowerQuery = query.toLowerCase()
  let index = lowerContent.indexOf(lowerQuery)

  if (index === -1) return content.slice(0, 200) + (content.length > 200 ? '...' : '')

  let start = Math.max(0, index - contextChars)
  let end = Math.min(content.length, index + query.length + contextChars)

  let preview = content.slice(start, end)
  if (start > 0) preview = '...' + preview
  if (end < content.length) preview = preview + '...'

  return preview
}

export function renderMdTool (_orgId: string, _repoId: string) {
  return tool({
    description: 'Render markdown containing a chart to an image. Returns a screenshot or errors. Use this when the user wants to see a visualization.',
    inputSchema: z.object({
      markdown: z.string().describe('Markdown content with graphene chart blocks to render'),
    }),
    execute: async ({markdown}) => {
      // TODO: Need a way to make the dynamic endpoint accessible to the sandbox
      // Options: deploy to public URL, use Modal tunneling, or ngrok
      // For now, return a placeholder indicating markdown was received
      console.log('renderMd called with markdown:', markdown.slice(0, 200) + '...')
      return {
        success: true,
        message: 'Markdown received (screenshot rendering requires public URL)',
        markdownPreview: markdown.slice(0, 200) + (markdown.length > 200 ? '...' : ''),
      }
    },
  })
}
