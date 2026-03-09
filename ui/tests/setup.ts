import path from 'path'
import {fileURLToPath} from 'url'
import {beforeEach, afterEach} from 'vitest'

import {assertOnlyExpectedLogs, resetExpectedLogs} from './logWatcher.ts'
import {setSnapshotDir} from './matchers.ts'

setSnapshotDir(path.join(path.dirname(fileURLToPath(import.meta.url)), 'snapshots'))

beforeEach(() => {
  resetExpectedLogs()
})

afterEach(() => {
  assertOnlyExpectedLogs()
})
