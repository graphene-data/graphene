import {test, expect, waitForGrapheneLoad} from './fixtures.ts'
import {expectConsoleError} from './logWatcher.ts'

test('markdown pages render in a sandboxed frame with authored Svelte enabled', async ({server, page}) => {
  server.mockFile(
    '/index.md',
    `
    <script>
      window.childTouched = 'child-only'
      let label = 'Frame Script'
    </script>

    <h2>{label}</h2>
    <button onclick={() => window.clicked = 'yes'}>Run</button>
  `,
  )

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)

  let iframe = page.locator('iframe[title="Graphene page"]')
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-downloads')
  await expect(page.frameLocator('iframe[title="Graphene page"]').getByRole('heading', {name: 'Frame Script'})).toBeVisible()

  await page.frameLocator('iframe[title="Graphene page"]').getByRole('button', {name: 'Run'}).click()
  expect(await page.evaluate(() => (window as any).childTouched)).toBeUndefined()

  let frame = page.frames().find(f => f.url().includes('/_graphene/frame/'))
  expect(await frame?.evaluate(() => (window as any).childTouched)).toBe('child-only')
  expect(await frame?.evaluate(() => (window as any).clicked)).toBe('yes')
})

test('sandboxed page cannot reach parent globals or direct query API', async ({server, page}) => {
  expectConsoleError(/Content Security Policy|connect-src/)
  server.mockFile('/index.md', '# Isolation')

  await page.goto(server.url() + '/')
  await waitForGrapheneLoad(page)

  let frame = page.frames().find(f => f.url().includes('/_graphene/frame/'))
  expect(frame).toBeTruthy()

  expect(
    await frame!.evaluate(() => {
      try {
        return Boolean((window.parent as any).$GRAPHENE)
      } catch {
        return 'blocked'
      }
    }),
  ).toBe('blocked')

  let fetchResult = await frame!.evaluate(async () => {
    try {
      await fetch('/_api/query', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'})
      return 'ok'
    } catch (error: any) {
      return error.name || error.message
    }
  })
  expect(fetchResult).not.toBe('ok')
})
