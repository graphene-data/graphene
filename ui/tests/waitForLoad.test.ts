// Tests the page-level load contract used by screenshots, CLI runs, and test fixtures.

import {expect, test, waitForGrapheneLoad} from './fixtures.ts'

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
