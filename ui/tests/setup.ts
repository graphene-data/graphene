import path from 'path'
import {fileURLToPath} from 'url'
import {beforeEach, afterEach} from 'vitest'
import {setSnapshotDir} from './matchers.ts'
import {assertOnlyExpectedLogs, resetExpectedLogs} from './logWatcher.ts'

setSnapshotDir(path.join(path.dirname(fileURLToPath(import.meta.url)), 'snapshots'))

beforeEach(() => {
  resetExpectedLogs()
})

afterEach(() => {
  assertOnlyExpectedLogs()
})
