import chromium from '@sparticuz/chromium'
import {chromium as playwright} from 'playwright-core'

// Lambda handler - takes a URL and optional token, returns a screenshot
export async function handler (event) {
  if (!event.url) {
    return {success: false, error: 'Missing required field: url'}
  }

  // Parse the URL to get the origin for cookie setting
  let urlObj = new URL(event.url)
  let cookieDomain = urlObj.hostname

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

    let context = await browser.newContext({
      viewport: {width: 1280, height: 720},
      userAgent: 'GrapheneScreenshot/1.0',  // Non-browser UA to bypass ngrok warning page
    })

    // Set agent token as cookie if provided (for authenticating query requests)
    if (event.token) {
      await context.addCookies([{
        name: 'graphene_agent_token',
        value: event.token,
        domain: cookieDomain,
        path: '/',
      }])
    }

    let page = await context.newPage()
    mark('newPage')

    // Capture console errors from the page
    let pageErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        pageErrors.push(msg.text())
      }
    })
    page.on('pageerror', err => {
      pageErrors.push(err.message)
    })

    await page.goto(event.url, {waitUntil: 'load', timeout: 30000})
    mark('navigation')

    // Wait for network to be idle (JS modules loading, data fetching)
    await page.waitForLoadState('networkidle')
    mark('networkIdle')

    let screenshot = await page.screenshot({type: 'png', animations: 'disabled', fullPage: true})
    mark('screenshot')

    return {success: true, screenshot: screenshot.toString('base64'), timings, pageErrors}
  } catch (err) {
    let error = err instanceof Error ? err.message : String(err)
    return {success: false, error, timings}
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
