import type {Page} from 'playwright'

import {test, expect} from './fixtures.ts'

// Styling for rendered markdown lives in ui/app.css. These tests pin the parts of it that are easy
// to break from a distance — list layout in particular, which regressed when `ul`/`ol` were turned
// into flex containers and stopped behaving like lists.

const PROSE_PAGE = `
  # Prose Styling

  An opening paragraph that establishes the body rhythm for the rest of the page.

  A second paragraph, so paragraph-to-paragraph spacing is measurable.

  ## Bullets

  - Alpha
  - Beta is long enough that it has to wrap onto a second line, which lets us check that the marker hangs outside the text column
  - Gamma
    - Nested gamma
      - Deeply nested gamma

  ## Numbers

  1. First
  2. Second
     1. Nested second

  ## Loose bullets

  - Alpha loose

  - Beta loose

  - Gamma loose

  Closing paragraph.
`

async function loadProsePage(server: {url: () => string, mockFile: (path: string, content: string) => void}, page: Page) {
  server.mockFile('/index.md', PROSE_PAGE)
  await page.goto(server.url() + '/')
  await expect(page.getByRole('heading', {level: 1, name: 'Prose Styling'})).toBeVisible()
  // Metrics below are font dependent, so don't measure until the webfonts have swapped in.
  await page.evaluate(() => document.fonts.ready)
}

test('styles markdown block elements consistently', async ({server, page}) => {
  await loadProsePage(server, page)

  let heading = page.getByRole('heading', {level: 1, name: 'Prose Styling'})
  await expect(heading).toHaveCSS('font-family', /Inter/)
  await expect(heading).toHaveCSS('font-size', '28px') // 1.75rem
  await expect(heading).toHaveCSS('font-weight', '700')

  let paragraph = page.locator('main p').first()
  await expect(paragraph).toHaveCSS('font-family', /Source Serif 4/)
  await expect(paragraph).toHaveCSS('font-size', '18px')
  await expect(paragraph).toHaveCSS('line-height', '28.8px') // 1.6
  await expect(paragraph).toHaveCSS('margin-block-end', '24px') // 1.5rem

  // Paragraphs, lists and headings all separate blocks by the same 1.5rem step.
  let spacing = await page.evaluate(() => {
    let blocks = [...document.querySelectorAll('main > p, main > ul, main > ol')] as HTMLElement[]
    return blocks
      .map(block => {
        let next = block.nextElementSibling as HTMLElement | null
        if (!next || next.tagName == 'H1' || next.tagName == 'H2') return null
        return +(next.getBoundingClientRect().top - block.getBoundingClientRect().bottom).toFixed(2)
      })
      .filter(gap => gap !== null)
  })
  expect(spacing.length).toBeGreaterThan(0)
  expect(spacing).toEqual(spacing.map(() => 24))
})

test('renders lists as lists, with hanging markers', async ({server, page}) => {
  await loadProsePage(server, page)

  let bullets = page.locator('main > ul').first()
  // A flex (or grid) container blockifies its children, which moves or drops the ::marker depending
  // on the engine. Lists have to stay in normal flow for markers to hang the way they should.
  await expect(bullets).toHaveCSS('display', 'block')
  await expect(bullets.locator('> li').first()).toHaveCSS('display', 'list-item')
  await expect(bullets).toHaveCSS('padding-inline-start', '24px') // 1.5rem

  let markers = await page.evaluate(() => {
    let markerStyle = (selector: string) => {
      let element = document.querySelector(selector)!
      let style = getComputedStyle(element, '::marker')
      return {type: getComputedStyle(element).listStyleType, color: style.color}
    }
    return {
      bullet: markerStyle('main > ul > li'),
      nested: markerStyle('main > ul > li ul > li'),
      deep: markerStyle('main > ul > li ul ul > li'),
      number: markerStyle('main > ol > li'),
      nestedNumber: markerStyle('main > ol > li ol > li'),
    }
  })
  expect(markers.bullet.type).toBe('disc')
  expect(markers.nested.type).toBe('circle')
  expect(markers.deep.type).toBe('square')
  expect(markers.number.type).toBe('decimal')
  expect(markers.nestedNumber.type).toBe('lower-alpha')
  expect(markers.bullet.color).toBe('rgb(12, 10, 9)') // --color-primary-strong

  let layout = await page.evaluate(() => {
    let list = document.querySelector('main > ul')! as HTMLElement
    let items = [...list.children] as HTMLElement[]
    let lineRects = (item: HTMLElement) => {
      let range = document.createRange()
      range.selectNodeContents(item.firstChild!)
      return [...range.getClientRects()]
    }
    let firstLines = lineRects(items[0])
    let wrappedLines = lineRects(items[1])
    return {
      indent: +(firstLines[0].left - list.getBoundingClientRect().left).toFixed(2),
      wrappedLineCount: wrappedLines.length,
      hangingIndent: +(wrappedLines[1].left - wrappedLines[0].left).toFixed(2),
      itemGap: +(items[1].getBoundingClientRect().top - items[0].getBoundingClientRect().bottom).toFixed(2),
    }
  })
  // Item text starts at the list's content edge, and the marker hangs in the padding to its left.
  expect(layout.indent).toBe(24)
  expect(layout.wrappedLineCount).toBe(2)
  expect(layout.hangingIndent).toBe(0)
  expect(layout.itemGap).toBe(8) // 0.5rem
})

test('keeps loose list items on the paragraph rhythm', async ({server, page}) => {
  await loadProsePage(server, page)

  // Markdown wraps the items of a loose list in <p>. Those margins have to collapse through the
  // item the way they do anywhere else in the page, or the list spaces itself twice.
  let loose = await page.evaluate(() => {
    let list = [...document.querySelectorAll('main > ul')].at(-1)! as HTMLElement
    let items = [...list.children] as HTMLElement[]
    let next = list.nextElementSibling as HTMLElement
    return {
      wrappedInParagraphs: items.every(item => item.firstElementChild?.tagName == 'P'),
      itemGap: +(items[1].getBoundingClientRect().top - items[0].getBoundingClientRect().bottom).toFixed(2),
      trailingGap: +(next.getBoundingClientRect().top - list.getBoundingClientRect().bottom).toFixed(2),
    }
  })
  expect(loose.wrappedInParagraphs).toBe(true)
  expect(loose.itemGap).toBe(24) // 1.5rem, same as between paragraphs
  expect(loose.trailingGap).toBe(24) // and no doubled-up space where the list ends
})
