import {
  captureScreenshot,
  captureScreenshotBrowserbase,
  captureScreenshotModalSnapshot,
  setupModalSnapshot,
} from '../server/agent/tools.ts'
import fs from 'node:fs'

async function main () {
  let args = process.argv.slice(2)

  // Check for setup mode
  if (args.includes('--setup')) {
    console.log('Setting up Modal snapshot...')
    await setupModalSnapshot()
    return
  }

  let useBrowserbase = args.includes('--browserbase') || args.includes('-b')
  let useSnapshot = args.includes('--snapshot') || args.includes('-s')
  args = args.filter(a => !a.startsWith('-'))

  let url = args[0] || 'https://www.nytimes.com'
  let selector = args[1]

  let backend = useSnapshot ? 'Modal-Snapshot' : useBrowserbase ? 'Browserbase' : 'Modal'
  console.log(`[${backend}] Capturing screenshot of ${url}${selector ? ` (waiting for ${selector})` : ''}...`)

  let start = Date.now()
  let result = useSnapshot
    ? await captureScreenshotModalSnapshot(url, selector)
    : useBrowserbase
      ? await captureScreenshotBrowserbase(url, selector)
      : await captureScreenshot(url, selector)
  let elapsed = Date.now() - start

  if (result.success && result.imageBase64) {
    console.log(`Screenshot captured in ${elapsed}ms. Base64 length: ${result.imageBase64.length}`)

    let buffer = Buffer.from(result.imageBase64, 'base64')
    fs.writeFileSync('/tmp/screenshot.png', buffer)
    console.log('Screenshot saved to /tmp/screenshot.png')
  } else {
    console.error('Failed:', result.error)
  }
}

main().catch(console.error)
