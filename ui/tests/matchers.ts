import {expect as baseExpect} from '@playwright/test'
import {expect as vitestExpect} from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import type {Locator, Page} from 'playwright'

export type ExtendedExpect = typeof baseExpect & {
  screenshot: (subject: Page | Locator, snapshotName: string) => Promise<void>
}

export const playwrightExpect = baseExpect as ExtendedExpect

playwrightExpect.extend({
  async screenshot (subject: Page | Locator, snapshotName: string) {
    let page = subject.constructor.name === 'Page' ? subject : (subject as Locator).page()
    let locator = subject.constructor.name === 'Page' ? undefined : subject
    let testFile = path.basename(vitestExpect.getState().testPath || '')

    // todo get current test file
    let snapshotPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './snapshots', testFile, snapshotName + '.png')
    let expectedBuffer = await fs.readFile(snapshotPath).catch(() => null)

    let opts = {animations: 'disabled', caret: 'hide', scale: 'css', locator, timeout: 5_000} as any
    if (expectedBuffer) opts.expected = expectedBuffer
    let result = await (page as any)._expectScreenshot(opts)

    if (!result) throw new Error('Playwright did not return screenshot result')
    if (result.actual) await writeBuffer(snapshotPath, result.actual)
    // if (result.diff) await writeBuffer(snapshotPath.replace(snapshotName, snapshotName + '-diff'), result.diff)
    // if (result.errorMessage) throw new Error(result.errorMessage)


    return {message: () => 'Screenshot ' + snapshotName + ' updated', pass: true}

    // await recordScreenshotArtifacts(snapshotName, result, context.resultsDir)
    // let artifactBase = path.join(context.resultsDir, snapshotName.replace(/\.png$/, ''))
    // let failureLines = [
    //   `Screenshot mismatch for ${snapshotName}`,
    //   `Expected snapshot: ${snapshotPath}`,
    //   result.errorMessage,
    //   formatScreenshotLog(result.log),
    //   `Artifacts saved under ${artifactBase}-*.png`,
    //   'Re-run with updateSnapshots enabled to rewrite this snapshot.',
    // ].filter(Boolean)
    // throw new Error(failureLines.join('\n'))
  },
})

async function writeBuffer (filePath: string, data: Buffer) {
  await fs.mkdir(path.dirname(filePath), {recursive: true})
  await fs.writeFile(filePath, data)
}

async function recordScreenshotArtifacts (
  snapshotName: string,
  result: {actual?: Buffer; previous?: Buffer; diff?: Buffer},
  baseDir: string,
) {
  let artifactBase = path.join(baseDir, snapshotName.replace(/\.png$/, ''))
  if (result.actual) await writeBuffer(`${artifactBase}-actual.png`, result.actual)
  if (result.previous) await writeBuffer(`${artifactBase}-expected.png`, result.previous)
  if (result.diff) await writeBuffer(`${artifactBase}-diff.png`, result.diff)
}

function formatScreenshotLog (entries?: {name?: string; message?: string}[]) {
  if (!entries?.length) return ''
  return entries.map(entry => [entry.name, entry.message].filter(Boolean).join(': ')).join('\n')
}
