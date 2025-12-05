import path from 'path'
import {fileURLToPath} from 'url'
import {setSnapshotDir} from '../../core/ui/tests/matchers'

setSnapshotDir(path.join(path.dirname(fileURLToPath(import.meta.url)), 'snapshots'))
