import chromium from '@sparticuz/chromium'
import {chromium as playwright} from 'playwright-core'

// Lambda handler - invoked directly via AWS SDK
export async function handler (event) {
  let timings = {}
  let last = Date.now()
  let mark = (key) => {
    let now = Date.now()
    timings[key] = now - last
    last = now
  }

  let browser
  try {
    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
    mark('launch')

    let context = await browser.newContext({viewport: {width: 1280, height: 720}})
    let page = await context.newPage()
    mark('newPage')

    if (event.type === 'renderMd') {
      if (!event.markdown || !event.token || !event.baseUrl) {
        return {success: false, error: 'Missing required fields for renderMd: markdown, token, baseUrl'}
      }

      // Navigate to the base URL first
      await page.goto(event.baseUrl, {waitUntil: 'domcontentloaded', timeout: 30000})
      mark('pageLoad')

      // Fetch rendered HTML via the dynamic endpoint
      let html = await page.evaluate(async ({markdown, token}) => {
        let res = await fetch('/_api/dynamic', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({markdown, token}),
        })
        if (!res.ok) {
          throw new Error('Failed to render: ' + res.status + ' ' + (await res.text()))
        }
        return res.text()
      }, {markdown: event.markdown, token: event.token})
      mark('fetch')

      // Set the rendered content
      await page.setContent(html, {waitUntil: 'domcontentloaded'})
      mark('setContent')

      // Wait for charts/components to render (they load data async after initial mount)
      await page.waitForTimeout(2000)
      mark('renderWait')

      let screenshot = await page.screenshot({
        type: 'png',
        animations: 'disabled',
        fullPage: true,
      })
      mark('screenshot')

      return {
        success: true,
        screenshot: screenshot.toString('base64'),
        timings,
      }
    } else if (event.type === 'screenshot') {
      if (!event.url) {
        return {success: false, error: 'Missing required field: url'}
      }

      await page.goto(event.url, {waitUntil: 'domcontentloaded', timeout: 30000})
      mark('pageLoad')

      if (event.selector) {
        await page.waitForSelector(event.selector, {timeout: 10000})
        mark('selector')
      }

      let screenshot = await page.screenshot({
        type: 'png',
        animations: 'disabled',
      })
      mark('screenshot')

      return {
        success: true,
        screenshot: screenshot.toString('base64'),
        timings,
      }
    } else {
      return {success: false, error: `Unknown request type: ${event.type}`}
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      timings,
    }
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
