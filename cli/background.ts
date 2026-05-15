import {spawn, exec} from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import {fileURLToPath} from 'url'
import {promisify} from 'util'

import {config} from '../lang/config.ts'

const execAsync = promisify(exec)

export async function runServeInBackground(options: {entryPoint?: string; log?: (chunk: string) => void} = {}): Promise<void> {
  let grapheneCache = getGrapheneCache(config.root)
  let logFile = path.join(grapheneCache, 'serve.log')
  await fs.ensureDir(grapheneCache)

  let log = fs.openSync(logFile, 'w')
  let entryPoint = options.entryPoint || process.argv[1] || fileURLToPath(import.meta.url)
  let childArgs = [...process.execArgv, entryPoint, 'serve']
  let child = spawn(process.execPath, childArgs, {
    cwd: config.root,
    detached: true,
    env: {...process.env},
    stdio: ['ignore', log, log],
  })

  if (!child.pid) throw new Error('Failed to start server process')

  await new Promise<void>((resolve, reject) => {
    let buffer = ''
    let settled = false
    let close = () => {
      if (settled) return false
      settled = true
      fs.unwatchFile(logFile)
      fs.closeSync(log)
      return true
    }

    fs.watchFile(logFile, {interval: 200}, (curr, prev) => {
      if (curr.size > prev.size) {
        let stream = fs.createReadStream(logFile, {start: prev.size, end: curr.size - 1})
        stream.on('data', d => {
          if (options.log) options.log(d.toString())
          else process.stdout.write(d)
          buffer = (buffer + d.toString()).slice(-200)
          if (buffer.includes('Server running at http://localhost:') && close()) resolve()
        })
      }
    })

    child.once('exit', async (code, signal) => {
      if (!close()) return
      reject(new Error(await serverStartupErrorMessage({logFile, code, signal})))
    })
    child.once('error', async e => {
      if (!close()) return
      reject(new Error(await serverStartupErrorMessage({logFile, err: e})))
    })
  })
}

async function serverStartupErrorMessage({logFile, code = null, signal = null, err}: {logFile: string; code?: number | null; signal?: NodeJS.Signals | null; err?: Error}): Promise<string> {
  let status = err ? err.message : `exited before startup finished${code === null ? '' : ` (code ${code})`}${signal ? ` (signal ${signal})` : ''}`
  let logTail = await readLogTail(logFile)
  return `Graphene server ${status}.\n\nLast output from ${logFile}:\n${logTail}`
}

async function readLogTail(logFile: string): Promise<string> {
  let contents = await fs.readFile(logFile, 'utf8').catch(() => '')
  let lines = contents.trimEnd().split('\n').slice(-20).join('\n').trim()
  return lines || '<no output>'
}

export function getGrapheneCache(root: string): string {
  return path.join(root, 'node_modules', '.graphene')
}

function sendSignal(pid: number, signal: NodeJS.Signals): boolean {
  let pids = process.platform === 'win32' ? [pid] : [pid, -pid]

  for (let target of pids) {
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

export async function stopGrapheneIfRunning(): Promise<void> {
  let port = Number(process.env.GRAPHENE_PORT) || 4000
  let pid = await getPidOnPort(port)
  if (!pid) return

  console.log(`Stopping server (${pid})`)
  sendSignal(pid, 'SIGTERM')

  let end = Date.now() + 5000
  while (Date.now() < end) {
    if (!(await getPidOnPort(port))) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (await getPidOnPort(port)) {
    sendSignal(pid, 'SIGKILL')
  }

  if (await getPidOnPort(port)) {
    console.error('Failed to stop previous Graphene server')
  }
}

export async function isServerRunning(portOverride?: number): Promise<boolean> {
  let port = portOverride || Number(process.env.GRAPHENE_PORT) || 4000
  return !!(await getPidOnPort(port))
}

async function getPidOnPort(port: number): Promise<number | undefined> {
  try {
    if (process.platform === 'win32') {
      let {stdout} = await execAsync(`netstat -ano | findstr :${port}`)
      let lines = stdout.trim().split('\n')
      for (let line of lines) {
        let parts = line.trim().split(/\s+/)
        if (parts.length < 5) continue
        let localAddress = parts[1]
        let pid = parseInt(parts[parts.length - 1], 10)
        if (localAddress.endsWith(`:${port}`)) {
          return pid
        }
      }
    } else {
      return new Promise(resolve => {
        let child = spawn('lsof', ['-i', `:${port}`, '-t', '-sTCP:LISTEN'])
        let stdout = ''
        child.stdout.on('data', d => (stdout += d.toString()))
        child.on('close', code => {
          if (code !== 0) return resolve(undefined)
          let pid = parseInt(stdout.trim(), 10)
          resolve(isNaN(pid) ? undefined : pid)
        })
        child.on('error', () => resolve(undefined))
      })
    }
  } catch (e: any) {
    console.warn('Failed to check for server:', e.message)
    return undefined
  }
  return undefined
}
