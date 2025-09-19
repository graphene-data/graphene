import {test, expect} from 'vitest'

let page: any, baseUrl: string, setVirtualFile: any
beforeAll(() => {
  // populated by e2eSetup.ts
  // @ts-ignore
  page = globalThis.__E2E__?.page
  // @ts-ignore
  baseUrl = globalThis.__E2E__?.baseUrl || 'http://localhost:4100'
  // @ts-ignore
  setVirtualFile = globalThis.__E2E__?.setVirtualFile
})

async function vitestWriteVirtual(filePath: string, contents: string) {
  await setVirtualFile(filePath, contents)
}

async function gotoAndWait(urlPath: string) {
  await page.goto(baseUrl + urlPath)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(200)
  // wait for any queries to finish
  await page.waitForFunction(() => window.$GRAPHENE?.loadingQueries?.size === 0)
}

test('it loads markdown files', async () => {
  await vitestWriteVirtual('/index.md', `# Test

\`\`\`sql test
select 1 as a
\`\`\`

<BarChart data="test" x="a" y="a" />
`)

  await gotoAndWait('/')
  // Evidence renders SVGs; assert at least one SVG is present
  let svgs = await page.locator('svg').all()
  expect(svgs.length).toBeGreaterThan(0)
  let errs = await page.evaluate(() => window.$GRAPHENE.errors?.length || 0)
  expect(errs).toBe(0)
})

test('it reports query errors', async () => {
  await vitestWriteVirtual('/index.md', `# Bad Query

\`\`\`sql bad
select doesnt_exist as nope from nowhere
\`\`\`

<BarChart data="bad" x="nope" y="nope" />
`)

  await page.goto(baseUrl + '/')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(200)
  // wait until an error is recorded
  await page.waitForFunction(() => (window as any).$GRAPHENE?.errors?.length > 0)
  let errorMessages = await page.evaluate(() => (window as any).$GRAPHENE.errors.map(e => e?.message || String(e)))
  expect(errorMessages.join('\n')).toMatch(/failed|doesnt_exist|no such/i)
})

test('it can explore', async () => {
  await gotoAndWait('/explore')
  // Fill the prompt and submit
  await page.locator('textarea').fill('mock')
  await page.locator('button[type="submit"]').click()

  // Wait for messages to appear
  await page.waitForSelector('.message')
  let messagesCount = await page.locator('.message').count()
  expect(messagesCount).toBeGreaterThan(0)

  // Wait for content to render
  await page.waitForSelector('.workspace__content')
  let hasContent = await page.locator('.workspace__content').count()
  expect(hasContent).toBeGreaterThan(0)
})

