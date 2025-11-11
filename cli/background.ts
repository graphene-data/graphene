import {spawn} from 'child_process'
import {fileURLToPath} from 'url'
import fs from 'fs-extra'
import path from 'path'
import {config} from '../lang/config.ts'

export type StopStatus = 'none' | 'stale' | 'stopped'

export async function runServeInBackground (): Promise<void> {
  let grapheneCache = getGrapheneCache(config.root)
  let logFile = path.join(grapheneCache, 'serve.log')
  await fs.ensureDir(grapheneCache)

  let log = fs.openSync(logFile, 'w')
  let entryPoint = process.argv[1] || fileURLToPath(import.meta.url)
  let childArgs = [...process.execArgv, entryPoint, 'serve', '--fg', ...process.argv.slice(3)]
  let child = spawn(process.execPath, childArgs, {
    cwd: config.root,
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

function targetPids (pid: number): number[] {
  if (process.platform === 'win32') return [pid]
  return [pid, -pid]
}

function sendSignal (pid: number, signal: NodeJS.Signals): boolean {
  for (let target of targetPids(pid)) {
    try {
      process.kill(target, signal)
    } catch (err) {
      let code = (err as NodeJS.ErrnoException).code
      if (code === 'ESRCH' || code === 'EINVAL') continue
      return false
    }
  }
  return true
}

export async function stopGrapheneIfRunning (): Promise<void> {
  let running = await isServerRunning()
  if (!running) return

  let pidFile = getPidFilePath(config.root)
  let pid = await readPid(pidFile)
  if (!pid) return

  console.log(`Stopping server (${pid})`)
  sendSignal(pid, 'SIGTERM')

  let end = Date.now() + 5000
  while (Date.now() < end && isServerRunning()) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (!isServerRunning()) return

  sendSignal(pid, 'SIGKILL')
  await fs.remove(pidFile)
}

export async function readPid (pidFile: string): Promise<number | undefined> {
  if (!(await fs.pathExists(pidFile))) return undefined
  let contents = (await fs.readFile(pidFile, 'utf8')).trim()
  if (!contents) return undefined
  let pid = Number.parseInt(contents, 10)
  if (Number.isNaN(pid)) return undefined
  return pid
}

export async function isServerRunning (): Promise<boolean> {
  let pidFile = getPidFilePath(config.root)
  let pid = await readPid(pidFile)
  if (!pid) return false
  try {
    process.kill(pid, 0) // sending `0` won't actually kill it, but will fail if that pid isnt running
    return true
  } catch {
    fs.removeSync(pidFile) // clean up pidfile since process wasn't running
    return false
  }
}
