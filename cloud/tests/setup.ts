import path from 'path'
import {fileURLToPath} from 'url'
import {beforeEach, afterEach} from 'vitest'

import {assertOnlyExpectedLogs, resetExpectedLogs} from '../../core/ui/tests/logWatcher.ts'
import {setSnapshotDir} from '../../core/ui/tests/matchers.ts'

setSnapshotDir(path.join(path.dirname(fileURLToPath(import.meta.url)), 'snapshots'))

beforeEach(() => {
  resetExpectedLogs()
})

afterEach(() => {
  assertOnlyExpectedLogs()
})
