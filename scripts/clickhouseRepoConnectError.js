#!/usr/bin/env node

// This reproduces an issue we're seeing where the first connection to a clickhouse server sometimes times out trying to do a TLS handshake.
// I did some investigation but couldn't come up with a satisfying answer on exactly why this happens.
// It is interesting that within the same node process it will always succeed once the version succeeds.
// It is also interesting that if you do this similar test but with curl in the shell, curl will always succeed.

import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'

let DEFAULT_URL = 'https://kzo1vb16sa.us-east-1.aws.clickhouse.cloud:8443/'
let args = process.argv.slice(2)

if (args[0] == '--child-once') {
  let url = args[1]
  let timeoutMs = Number(args[2])
  let startedAt = Date.now()

  try {
    let res = await fetch(url, {signal: AbortSignal.timeout(timeoutMs), headers: {connection: 'close'}})
    await res.arrayBuffer()
    console.log(JSON.stringify({ok: true, status: res.status, durationMs: Date.now() - startedAt}))
    process.exit(0)
  } catch (err) {
    let code = err?.code || err?.cause?.code || 'UNKNOWN'
    let name = err?.name || 'Error'
    let message = err?.message || String(err)
    let durationMs = Date.now() - startedAt
    let timeout = code == 'UND_ERR_CONNECT_TIMEOUT' || code == 'UND_ERR_HEADERS_TIMEOUT' || name == 'AbortError'
    console.error(JSON.stringify({ok: false, timeout, code, name, message, durationMs}))
    process.exit(timeout ? 2 : 1)
  }
}

let url = args[0] || DEFAULT_URL
let maxAttempts = Number(args[1] || 10)
let timeoutMs = Number(args[2] || 12_000)
let mode = args[3] || 'isolated'

if (!Number.isFinite(maxAttempts) || maxAttempts < 1) {
  console.error('Usage: node scripts/fetchUntilTimeout.js [url] [maxAttempts=10] [timeoutMs=12000] [mode=isolated|same-process]')
  process.exit(1)
}

async function runOneInChild() {
  return await new Promise(resolve => {
    let child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--child-once', url, String(timeoutMs)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', d => {
      stdout += d.toString()
    })
    child.stderr.on('data', d => {
      stderr += d.toString()
    })
    child.on('close', code => resolve({code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim()}))
  })
}

function parseLine(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

for (let i = 1; i <= maxAttempts; i++) {
  if (mode == 'same-process') {
    let startedAt = Date.now()
    try {
      let res = await fetch(url, {signal: AbortSignal.timeout(timeoutMs), headers: {connection: 'close'}})
      await res.arrayBuffer()
      console.log(`[fetchUntilTimeout] attempt ${i}/${maxAttempts} ok status=${res.status} durationMs=${Date.now() - startedAt}`)
      continue
    } catch (err) {
      let code = err?.code || err?.cause?.code || 'UNKNOWN'
      let name = err?.name || 'Error'
      let timeout = code == 'UND_ERR_CONNECT_TIMEOUT' || code == 'UND_ERR_HEADERS_TIMEOUT' || name == 'AbortError'
      console.error(`[fetchUntilTimeout] attempt ${i}/${maxAttempts} ${timeout ? 'TIMEOUT' : 'ERROR'} code=${code} durationMs=${Date.now() - startedAt} msg=${err?.message || String(err)}`)
      process.exit(1)
    }
  }

  let result = await runOneInChild()
  if (result.code == 0) {
    let payload = parseLine(result.stdout)
    let status = payload?.status ?? '?'
    let durationMs = payload?.durationMs ?? '?'
    console.log(`[fetchUntilTimeout] attempt ${i}/${maxAttempts} ok status=${status} durationMs=${durationMs}`)
    continue
  }

  let payload = parseLine(result.stderr)
  let timeout = result.code == 2 || payload?.timeout
  let code = payload?.code || `EXIT_${result.code}`
  let durationMs = payload?.durationMs || '?'
  let msg = payload?.message || result.stderr || result.stdout || 'unknown error'
  console.error(`[fetchUntilTimeout] attempt ${i}/${maxAttempts} ${timeout ? 'TIMEOUT' : 'ERROR'} code=${code} durationMs=${durationMs} msg=${msg}`)
  process.exit(1)
}

console.log(`[fetchUntilTimeout] completed ${maxAttempts} attempts without timeout`)
