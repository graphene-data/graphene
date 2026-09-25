// Browser helpers shared by core and cloud tests: stable example font CSS and screenshot matching against LFS PNGs.
// Settle rendering without changing the user's scroll destination; write expected/actual/diff PNGs on mismatch.
import type {BrowserContext, Locator, Page} from 'playwright'

import {expect as baseExpect} from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import {expect as vitestExpect} from 'vitest'

// Snapshot directory - must be set via setSnapshotDir() in a setupFiles script
let snapshotDir: string | undefined
export function setSnapshotDir(dir: string) {
  snapshotDir = dir
}

export const exampleFontCssUrl = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap'

// Google serves different @font-face URLs for the same CSS request over time, which shifted glyphs in screenshots.
// Serve a captured copy of the flights example's CSS so the same gstatic font files load every run; the font
// requests themselves still go over the network under the real CSP.
export async function useExampleFontCss(context: BrowserContext) {
  await context.route(url => url.href === exampleFontCssUrl, route => route.fulfill({
    contentType: 'text/css', path: path.join(import.meta.dirname, 'example-fonts.css'),
  }))
}

interface ScreenshotOptions {
  fullPage?: boolean
  mouseHover?: boolean // Preserve the pointer when the hover state is part of the snapshot.
}

const extendedExpect = baseExpect.extend({
  async screenshot(subject: Page | Locator, snapshotName: string, options: ScreenshotOptions = {}) {
    if (!snapshotDir) throw new Error('Snapshot directory not configured. Call setSnapshotDir() in a setup file.')
    if (process.env.GRAPHENE_DEBUG) return {message: () => '', pass: true} // don't check screenshots when debugging (browser might not be the same size)
    let page = subject.constructor.name === 'Page' ? subject : (subject as Locator).page()
    let locator = subject.constructor.name === 'Page' ? undefined : subject
    let testPath = vitestExpect.getState().testPath || ''
    let testFile = path.basename(testPath)

    // Hover state is usually incidental and can differ between local and CI browsers.
    if (!options.mouseHover) await (page as Page).mouse.move(-1, -1)

    // Wait for fonts, Graphene renders, animations, and scrolling before comparing pixels.
    let stillLoading = await (page as Page).evaluate(async () => {
      await document.fonts.ready
      return await (window as any).$GRAPHENE?.waitForLoad?.()
    })
    if (stillLoading?.length) throw new Error(`Timed out waiting for Graphene: ${stillLoading.join(', ')}`)
    await waitForAnimations(page as Page)

    let resultsDir = path.resolve(snapshotDir, '..', 'results', testFile)
    let snapshotPath = path.resolve(snapshotDir, testFile, snapshotName + '.png')
    let expectedBuffer = await fs.readFile(snapshotPath).catch(() => undefined)

    if (expectedBuffer && !isPng(expectedBuffer)) {
      return {message: () => `Screenshot ${snapshotName} is not a valid png (might need to LFS pull)`, pass: false}
    }

    let result = await (page as any)._expectScreenshot({
      animations: 'allow',
      caret: 'hide',
      scale: 'css',
      locator,
      fullPage: options.fullPage,
      maxDiffPixelRatio: 0, // strict: no differing pixels allowed
      threshold: 0.01, // strict per-pixel color matching
      timeout: 5_000,
      expected: expectedBuffer,
    })
    if (!result) throw new Error('Playwright did not return screenshot result')

    // update snapshot if needed/allowed
    let updateSnapshot = (vitestExpect.getState().snapshotState as any)?._updateSnapshot
    let updateAllowed = updateSnapshot == 'all' || (updateSnapshot == 'new' && !expectedBuffer)
    if (result.actual && updateAllowed) {
      await writeBuffer(snapshotPath, result.actual)
      return {message: () => `Screenshot ${snapshotName} updated`, pass: true}
    }

    if (!expectedBuffer) {
      return {message: () => `Screenshot ${snapshotName} is missing`, pass: false}
    }

    if (result.diff) {
      if (expectedBuffer) await writeBuffer(path.join(resultsDir, snapshotName + '-expected.png'), expectedBuffer)
      await writeBuffer(path.join(resultsDir, snapshotName + '-actual.png'), result.actual)
      await writeBuffer(path.join(resultsDir, snapshotName + '-zdiff.png'), result.diff)
      return {message: () => `Screenshot ${snapshotName} does not match expected`, pass: false}
    } else {
      return {message: () => 'Screenshot ' + snapshotName + ' matches', pass: true}
    }
  },
})

function isPng(buffer: Buffer) {
  if (buffer.length < 8) return false
  return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
}

async function writeBuffer(filePath: string, data: Buffer) {
  await fs.mkdir(path.dirname(filePath), {recursive: true})
  await fs.writeFile(filePath, data)
}

interface ScreenshotMatchers {
  screenshot(snapshotName: string, options?: ScreenshotOptions): Promise<void>
}

type BaseMatchers<T> = ReturnType<typeof baseExpect<T>>

// Playwright's MakeMatchers type doesn't properly expose custom matchers, so we define our own
interface ExpectWithScreenshot {
  <T>(actual: T): BaseMatchers<T> & ScreenshotMatchers
  poll: typeof baseExpect.poll
  soft: typeof baseExpect.soft
  extend: typeof baseExpect.extend
  configure: typeof baseExpect.configure
  getState: typeof baseExpect.getState
}

export const playwrightExpect: ExpectWithScreenshot = extendedExpect as any

// Finish Web Animations as before, but let native smooth scrolling reach its actual destination.
export async function waitForAnimations(page: Page) {
  await page.evaluate(async () => {
    let positions = scrollPositions()
    let idlePaints = 0
    while (idlePaints < 2) {
      // Cross paints even on animation-free pages: a compositor scroll may not have moved yet.
      await nextPaint()
      let current = scrollPositions()
      let animations = document.getAnimations().filter(animation => animation.playState === 'running' || animation.pending)
      let scrolling = current.size !== positions.size || [...current].some(([element, [x, y]]) => {
        let previous = positions.get(element)
        return !previous || previous[0] !== x || previous[1] !== y
      })
      idlePaints = scrolling || animations.length ? 0 : idlePaints + 1
      positions = current

      for (let animation of animations) {
        if (Number.isFinite(animation.effect?.getComputedTiming().endTime)) animation.finish()
        else {
          animation.currentTime = 0
          animation.pause()
        }
      }

      // Let finish/cancel events and any animations they trigger run before checking again.
      if (animations.length) await new Promise(resolve => setTimeout(resolve))
    }

    // Include the document scroller and nested scrollers, even for locator screenshots.
    // Zero offsets need no entry; starting/stopping at zero still changes the map.
    function scrollPositions() {
      let positions = new Map<Element, [number, number]>()
      for (let element of document.querySelectorAll('*')) {
        if (element.scrollLeft || element.scrollTop) positions.set(element, [element.scrollLeft, element.scrollTop])
      }
      return positions
    }

    function nextPaint() {
      return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    }
  })
}
