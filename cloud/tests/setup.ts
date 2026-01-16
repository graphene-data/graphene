import path from 'path'
import {fileURLToPath} from 'url'
import {setSnapshotDir} from '../../core/ui/tests/matchers.ts'

setSnapshotDir(path.join(path.dirname(fileURLToPath(import.meta.url)), 'snapshots'))
