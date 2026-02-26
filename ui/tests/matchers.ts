import {expect as baseExpect} from '@playwright/test'
import {expect as vitestExpect} from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import type {Locator, Page} from 'playwright'

// Snapshot directory - must be set via setSnapshotDir() in a setupFiles script
let snapshotDir: string | undefined

export function setSnapshotDir (dir: string) {
  snapshotDir = dir
}

const extendedExpect = baseExpect.extend({
  async screenshot (subject: Page | Locator, snapshotName: string) {
    if (!snapshotDir) throw new Error('Snapshot directory not configured. Call setSnapshotDir() in a setup file.')
    if (process.env.GRAPHENE_DEBUG) return {message: () => '', pass: true} // don't check screenshots when debugging (browser might not be the same size)
    let page = subject.constructor.name === 'Page' ? subject : (subject as Locator).page()
    let locator = subject.constructor.name === 'Page' ? undefined : subject
    let testPath = vitestExpect.getState().testPath || ''
    let testFile = path.basename(testPath)

    // Wait for fonts to load to ensure consistent rendering across environments
    await (page as Page).evaluate(async () => {
      await document.fonts.ready
      await (window as any).$GRAPHENE?.waitForQueries?.()
      await new Promise(r => requestAnimationFrame(r))
    })

    let snapshotPath = path.resolve(snapshotDir, testFile, snapshotName + '.png')
    let expectedBuffer = await fs.readFile(snapshotPath).catch(() => null)

    let opts = {
      animations: 'disabled', caret: 'hide', scale: 'css', locator,
      maxDiffPixelRatio: 0.02, // allow minor cross-platform text AA while still catching structural changes
      threshold: 0.1, // even small color changes should count
      timeout: 5_000,
    } as any
    if (expectedBuffer) opts.expected = expectedBuffer
    let result = await (page as any)._expectScreenshot(opts)

    if (!result) throw new Error('Playwright did not return screenshot result')

    // In CI, fail if screenshots don't match and save diffs. Locally, update the snapshot.
    if (process.env.CI) {
      if (!expectedBuffer) {
        return {message: () => `Screenshot ${snapshotName} does not exist. Run tests locally to create it.`, pass: false}
      }
      if (result.diff) {
        let resultsDir = path.resolve(snapshotDir, '..', 'results', testFile)
        if (result.actual) await writeBuffer(path.join(resultsDir, snapshotName + '-actual.png'), result.actual)
        if (result.previous) await writeBuffer(path.join(resultsDir, snapshotName + '-expected.png'), result.previous)
        await writeBuffer(path.join(resultsDir, snapshotName + '-diff.png'), result.diff)
        return {message: () => `Screenshot ${snapshotName} does not match expected`, pass: false}
      }
    } else {
      if (result.actual) await writeBuffer(snapshotPath, result.actual)
    }

    return {message: () => 'Screenshot ' + snapshotName + ' matches', pass: true}
  },
})

async function writeBuffer (filePath: string, data: Buffer) {
  await fs.mkdir(path.dirname(filePath), {recursive: true})
  await fs.writeFile(filePath, data)
}

// async function recordScreenshotArtifacts (
//   snapshotName: string,
//   result: {actual?: Buffer; previous?: Buffer; diff?: Buffer},
//   baseDir: string,
// ) {
//   let artifactBase = path.join(baseDir, snapshotName.replace(/\.png$/, ''))
//   if (result.actual) await writeBuffer(`${artifactBase}-actual.png`, result.actual)
//   if (result.previous) await writeBuffer(`${artifactBase}-expected.png`, result.previous)
//   if (result.diff) await writeBuffer(`${artifactBase}-diff.png`, result.diff)
// }

// function formatScreenshotLog (entries?: {name?: string; message?: string}[]) {
//   if (!entries?.length) return ''
//   return entries.map(entry => [entry.name, entry.message].filter(Boolean).join(': ')).join('\n')
// }

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
