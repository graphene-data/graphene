import {captureScreenshot, setupModalSnapshot, type CaptureResult} from '../server/agent/runMd.ts'
import fs from 'node:fs'

function printTimings (timings: CaptureResult['timings']) {
  if (!timings) return
  console.log('\nTimings:')
  for (let [key, val] of Object.entries(timings)) {
    if (typeof val === 'number') {
      console.log(`  ${key}: ${val}ms`)
    } else if (typeof val === 'object') {
      console.log(`  ${key}:`)
      for (let [k, v] of Object.entries(val)) {
        console.log(`    ${k}: ${v}ms`)
      }
    }
  }
}

async function main () {
  let args = process.argv.slice(2)

  // Check for setup mode
  if (args.includes('--setup')) {
    console.log('Setting up Modal snapshot...')
    await setupModalSnapshot()
    return
  }

  args = args.filter(a => !a.startsWith('-'))

  let url = args[0] || 'https://example.com'
  let selector = args[1]

  console.log(`Capturing screenshot of ${url}${selector ? ` (waiting for ${selector})` : ''}...`)

  let start = Date.now()
  let result = await captureScreenshot(url, selector)
  let elapsed = Date.now() - start

  if (result.success && result.screenshot) {
    console.log(`Screenshot captured in ${elapsed}ms. Base64 length: ${result.screenshot.length}`)
    printTimings(result.timings)

    let buffer = Buffer.from(result.screenshot, 'base64')
    fs.writeFileSync('/tmp/screenshot.png', buffer)
    console.log('\nScreenshot saved to /tmp/screenshot.png')
  } else {
    console.error('Failed:', result.error)
    printTimings(result.timings)
  }
}

main().catch(console.error)
