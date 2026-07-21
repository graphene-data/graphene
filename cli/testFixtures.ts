import {CommanderError} from 'commander'
import {Readable} from 'node:stream'
import {afterEach, expect, test as base, vi} from 'vitest'

import {config, setGlobalConfig, type Config} from '../lang/config.ts'
import {program} from './cli.ts'
import {resetDuckDbInstanceForTests} from './connections/index.ts'

export {expect}

export interface RunCliResult {
  code: number
  stdout: string
  stderr: string
}

export interface RunCliOptions {
  env?: NodeJS.ProcessEnv
  stdin?: string
}

export type RunCli = (args: string[], invocationConfig: Config, options?: RunCliOptions) => Promise<RunCliResult>

class ProcessExit extends Error {
  constructor(readonly code: number) {
    super(`Process exited with code ${code}`)
  }
}

// Runs the public Commander program in-process while capturing the same stdout, stderr, and exit code a user sees.
async function runCli(args: string[], invocationConfig: Config, options: RunCliOptions = {}): Promise<RunCliResult> {
  let stdout = ''
  let stderr = ''
  let originalConfig = structuredClone(config)
  let originalEnv = {...process.env}

  setGlobalConfig(structuredClone(invocationConfig))
  Object.assign(process.env, options.env)

  let spies = [
    vi.spyOn(console, 'log').mockImplementation((...parts) => (stdout += parts.map(String).join(' ') + '\n')),
    vi.spyOn(console, 'warn').mockImplementation((...parts) => (stderr += parts.map(String).join(' ') + '\n')),
    vi.spyOn(console, 'error').mockImplementation((...parts) => (stderr += parts.map(String).join(' ') + '\n')),
  ]
  let exitSpy = vi.spyOn(process, 'exit').mockImplementation(code => {
    throw new ProcessExit(Number(code || 0))
  })
  let stdinSpy = options.stdin === undefined ? undefined : vi.spyOn(process, 'stdin', 'get').mockReturnValue(Readable.from([options.stdin]) as typeof process.stdin)

  // Commander command instances retain option values between parse calls, so restore their declared defaults.
  for (let command of [program, ...program.commands]) {
    command.args = []
    command.processedArgs = []
    for (let option of command.options) {
      let value = option.defaultValue === undefined ? undefined : structuredClone(option.defaultValue)
      command.setOptionValueWithSource(option.attributeName(), value, 'default')
    }
  }
  program.configureOutput({writeOut: text => (stdout += text), writeErr: text => (stderr += text)}).exitOverride()

  let code = 0
  try {
    await program.parseAsync(args, {from: 'user'})
  } catch (err) {
    if (err instanceof ProcessExit) code = err.code
    else if (err instanceof CommanderError) code = err.exitCode
    else {
      code = 1
      stderr += (err instanceof Error ? err.message : String(err)) + '\n'
    }
  } finally {
    spies.forEach(spy => spy.mockRestore())
    exitSpy.mockRestore()
    stdinSpy?.mockRestore()
    setGlobalConfig(originalConfig)
    process.env = originalEnv
  }

  return {code, stdout, stderr}
}

afterEach(resetDuckDbInstanceForTests)

export const test = base.extend<{runCli: RunCli}>({
  // eslint-disable-next-line no-empty-pattern
  runCli: ({}, use) => use(runCli),
})
