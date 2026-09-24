// Tests the page-level load contract used by screenshots, CLI runs, and test fixtures.

import {expect, test, waitForGrapheneLoad} from './fixtures.ts'
import {waitForAnimations} from './matchers.ts'

// Compare against an instant-scroll reference, not a baseline recorded while still moving.
// Calling readiness immediately also exercises smooth scroll's initial, not-yet-moving frame.
test('screenshot readiness settles page and nested scrolling with animations', async ({page}) => {
  await page.setContent(`
    <style>
      html, #nested { scroll-behavior: smooth; }
      body { margin: 0; height: 2400px; background: linear-gradient(#fff, #246); }
      #nested { position: fixed; top: 20px; left: 20px; width: 200px; height: 180px; overflow: auto; }
      #content { width: 1000px; height: 1800px; background: linear-gradient(135deg, #f00, #00f); }
      #animated { position: fixed; top: 220px; width: 80px; height: 80px; background: green; }
      #offscreen { position: absolute; top: 1800px; width: 100px; height: 100px; background: orange; }
    </style>
    <div id="nested"><div id="content"></div></div><div id="animated"></div><div id="offscreen"></div>
  `)
  await waitForAnimations(page) // Empty animations and no scrolling must terminate.

  await page.evaluate(() => {
    window.scrollTo({top: 900, behavior: 'instant'})
    document.querySelector('#nested')!.scrollTo({top: 1000, left: 500, behavior: 'instant'})
    document.querySelector<HTMLElement>('#animated')!.style.transform = 'translateX(300px)'
  })
  let expectedPage = await page.screenshot()
  let expectedNested = await page.locator('#nested').screenshot()

  for (let phase of ['immediate', 'moving', 'animation', 'already idle'] as const) {
    if (phase !== 'already idle') {
      await page.evaluate(() => {
        window.scrollTo({top: 0, behavior: 'instant'})
        document.querySelector('#nested')!.scrollTo({top: 0, left: 0, behavior: 'instant'})
      })
      await waitForAnimations(page)
    }
    await page.evaluate(animate => {
      let scroll = () => {
        window.scrollTo({top: 900})
        document.querySelector('#nested')!.scrollTo({top: 1000, left: 500})
      }
      if (!animate) return scroll()
      // Finishing an animation can itself start scrolling; readiness must handle both together.
      let animation = document.querySelector('#animated')!.animate([{transform: 'translateX(0)'}, {transform: 'translateX(300px)'}], {duration: 1000, fill: 'forwards'})
      animation.onfinish = scroll
    }, phase === 'animation')
    if (phase === 'moving') await page.waitForFunction(() => window.scrollY > 0 && window.scrollY < 900)
    await waitForAnimations(page)
    // Assert readiness itself, before Playwright's screenshot can give scrolling more time.
    expect(await page.evaluate(() => [scrollY, document.querySelector('#nested')!.scrollTop, document.querySelector('#nested')!.scrollLeft])).toEqual([900, 1000, 500])
    expect((await page.screenshot()).equals(expectedPage)).toBe(true)
    expect((await page.locator('#nested').screenshot()).equals(expectedNested)).toBe(true)
  }

  // Playwright's locator capture scrolls offscreen targets into view via the browser protocol,
  // not CSS smooth scrolling. Its own stable/visible checks handle that capture-time movement.
  let offscreen = page.locator('#offscreen')
  let first = await offscreen.screenshot()
  let viewport = await page.screenshot()
  await waitForAnimations(page)
  expect((await page.screenshot()).equals(viewport)).toBe(true)
  expect((await offscreen.screenshot()).equals(first)).toBe(true)
})

test('waitForLoad completes when animation frames are suspended', async ({server, page}) => {
  server.mockFile('/index.md', '# Background load')
  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)

  let result = await page.evaluate(async () => {
    let requestFrame = window.requestAnimationFrame
    Object.defineProperty(document, 'hidden', {value: true, configurable: true})
    window.requestAnimationFrame = () => 0
    let result = await Promise.race([
      window.$GRAPHENE.waitForLoad().then(() => 'loaded'),
      new Promise(resolve => setTimeout(() => resolve('timed out'), 500)),
    ])
    delete (document as any).hidden
    window.requestAnimationFrame = requestFrame
    return result
  })

  expect(result).toBe('loaded')
})

test('waitForLoad identifies each kind of outstanding work', async ({server, page}) => {
  server.mockFile('/index.md', '# Load tracking')
  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)

  let stillLoading = await page.evaluate(async () => {
    let graphene = window.$GRAPHENE
    let getLoadingQueries = graphene.getLoadingQueries
    graphene.appLoading = true
    graphene.getLoadingQueries = () => ['sales']
    graphene.renderStart('chart:revenue')

    let result = await graphene.waitForLoad(1)

    graphene.appLoading = false
    graphene.getLoadingQueries = getLoadingQueries
    graphene.renderComplete('chart:revenue')
    return {result, idle: await graphene.waitForLoad(0)}
  })

  expect(stillLoading).toEqual({result: ['app', 'query:sales', 'chart:revenue'], idle: null})
})
