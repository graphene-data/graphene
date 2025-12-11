import path from 'path'
import {fileURLToPath} from 'url'
import {setSnapshotDir} from './matchers.ts'

setSnapshotDir(path.join(path.dirname(fileURLToPath(import.meta.url)), 'snapshots'))
