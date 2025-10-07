import {spawn} from 'child_process'
import {fileURLToPath} from 'url'
import fs from 'fs-extra'
import path from 'path'

export async function runServeInBackground (): Promise<void> {
  let grapheneCache = path.join(process.cwd(), 'node_modules', '.graphene')
  let pidFile = path.join(grapheneCache, process.env.NODE_ENV == 'test' ? 'test.pid' : 'serve.pid')
  let logFile = path.join(grapheneCache, 'serve.log')
  await fs.ensureDir(grapheneCache)

  let existingPid = await readPid(pidFile)
  if (existingPid && isProcessRunning(existingPid)) {
    console.log(`Stopping existing server (pid ${existingPid})`)
    let stopped = await stopProcess(existingPid)
    if (!stopped) throw new Error(`Failed to stop existing server (pid ${existingPid}). Please kill it manually.`)
  }

  let log = fs.openSync(logFile, 'w')
  let entryPoint = process.argv[1] || fileURLToPath(import.meta.url)
  let childArgs = [...process.execArgv, entryPoint, 'serve', '--fg', ...process.argv.slice(3)]
  let child = spawn(process.execPath, childArgs, {
    cwd: process.cwd(),
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

export async function readPid (pidFile: string): Promise<number | undefined> {
  if (!(await fs.pathExists(pidFile))) return undefined
  let contents = (await fs.readFile(pidFile, 'utf8')).trim()
  if (!contents) return undefined
  let pid = Number.parseInt(contents, 10)
  if (Number.isNaN(pid)) return undefined
  return pid
}

export async function stopProcess (pid: number): Promise<boolean> {
  try {
    process.kill(pid, 'SIGTERM')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ESRCH') return true
    return false
  }

  let end = Date.now() + 5000
  while (Date.now() < end) {
    if (!isProcessRunning(pid)) return true
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  if (!isProcessRunning(pid)) return true

  try {
    process.kill(pid, 'SIGKILL')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ESRCH') return true
    return false
  }

  let killEnd = Date.now() + 2000
  while (Date.now() < killEnd) {
    if (!isProcessRunning(pid)) return true
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return !isProcessRunning(pid)
}

export function isProcessRunning (pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch { return false }
}
