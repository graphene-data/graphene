import type {Locator, Page} from 'playwright'

import {expect as baseExpect} from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import {expect as vitestExpect} from 'vitest'

// Snapshot directory - must be set via setSnapshotDir() in a setupFiles script
let snapshotDir: string | undefined
export function setSnapshotDir(dir: string) {
  snapshotDir = dir
}

const extendedExpect = baseExpect.extend({
  async screenshot(subject: Page | Locator, snapshotName: string) {
    if (!snapshotDir) throw new Error('Snapshot directory not configured. Call setSnapshotDir() in a setup file.')
    if (process.env.GRAPHENE_DEBUG) return {message: () => '', pass: true} // don't check screenshots when debugging (browser might not be the same size)
    let page = subject.constructor.name === 'Page' ? subject : (subject as Locator).page()
    let locator = subject.constructor.name === 'Page' ? undefined : subject
    let testPath = vitestExpect.getState().testPath || ''
    let testFile = path.basename(testPath)

    // Wait for fonts to load to ensure consistent rendering across environments
    await (page as Page).evaluate(async () => {
      await document.fonts.ready
      await (window as any).$GRAPHENE?.waitForLoad?.()
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    })

    let resultsDir = path.resolve(snapshotDir, '..', 'results', testFile)
    let snapshotPath = path.resolve(snapshotDir, testFile, snapshotName + '.png')
    let expectedBuffer = await fs.readFile(snapshotPath).catch(() => undefined)

    if (expectedBuffer && !isPng(expectedBuffer)) {
      return {message: () => `Screenshot ${snapshotName} is not a valid png (might need to LFS pull)`, pass: false}
    }

    let result = await (page as any)._expectScreenshot({
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      locator,
      maxDiffPixelRatio: 0, // strict: no differing pixels allowed
      threshold: 0.01, // strict per-pixel color matching
      timeout: 5_000,
      expected: expectedBuffer,
    })
    if (!result) throw new Error('Playwright did not return screenshot result')

    let updateSnapshot = (vitestExpect.getState().snapshotState as any)?._updateSnapshot
    if (updateSnapshot == 'all' || (updateSnapshot == 'new' && !expectedBuffer)) {
      if (!result.actual) throw new Error('no snapshot returned')
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
  screenshot(snapshotName: string): Promise<void>
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
