import {spawn} from 'child_process'
import {fileURLToPath} from 'url'
import fs from 'fs-extra'
import path from 'path'

export type StopStatus = 'none' | 'stale' | 'stopped'

export async function runServeInBackground (): Promise<void> {
  let root = process.cwd()
  let grapheneCache = getGrapheneCache(root)
  let logFile = path.join(grapheneCache, 'serve.log')
  await fs.ensureDir(grapheneCache)
  await stopGrapheneIfRunning(root)

  let log = fs.openSync(logFile, 'w')
  let entryPoint = process.argv[1] || fileURLToPath(import.meta.url)
  let childArgs = [...process.execArgv, entryPoint, 'serve', '--fg', ...process.argv.slice(3)]
  let child = spawn(process.execPath, childArgs, {
    cwd: root,
    detached: true,
    env: {...process.env},
    stdio: ['ignore', log, log],
  })

  if (!child.pid) throw new Error('Failed to start server process')

  await new Promise<void>((resolve, reject) => {
    let buffer = ''
    fs.watchFile(logFile, {interval: 200}, (curr, prev) => {
      if (curr.size > prev.size) { // File has grown, read the new data
        let stream = fs.createReadStream(logFile, {start: 0, end: curr.size - 1})
        stream.on('data', (d) => {
          process.stdout.write(d)
          buffer = (buffer + d.toString()).slice(-200)
          if (buffer.includes('Server running at http://localhost:')) resolve()
        })
      }
    })

    child.once('exit', () => {
      process.stdout.write(fs.readFileSync(logFile))
      reject(new Error('Exited before server started'))
    })
    child.once('error', e => reject(e))
  })
}

export function getGrapheneCache (root: string): string {
  return path.join(root, 'node_modules', '.graphene')
}

export function getPidFilePath (root: string): string {
  return path.join(getGrapheneCache(root), process.env.NODE_ENV == 'test' ? 'test.pid' : 'serve.pid')
}

export async function stopGrapheneIfRunning (root: string): Promise<boolean> {
  let pidFile = getPidFilePath(root)
  let pid = await readPid(pidFile)
  if (!pid) return true

  if (!isProcessRunning(pid)) {
    await fs.remove(pidFile)
    return true
  }

  try {
    console.log(`Stopping server (${pid})`)
    process.kill(pid, 'SIGTERM')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ESRCH') return true
    return false
  }

  let end = Date.now() + 5000
  while (Date.now() < end && isProcessRunning(pid)) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  await fs.remove(pidFile)
  return !isProcessRunning(pid)
}

export async function readPid (pidFile: string): Promise<number | undefined> {
  if (!(await fs.pathExists(pidFile))) return undefined
  let contents = (await fs.readFile(pidFile, 'utf8')).trim()
  if (!contents) return undefined
  let pid = Number.parseInt(contents, 10)
  if (Number.isNaN(pid)) return undefined
  return pid
}

export function isProcessRunning (pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch { return false }
}
