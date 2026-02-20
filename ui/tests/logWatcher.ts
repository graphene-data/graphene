import {type ConsoleMessage, type Page} from '@playwright/test'

// We don't want to print out random stuff to the logs when running tests, but some logs are expected, and often
// the presence of a log message helps us understand why a given test is failing.
// This file has watchers for both browser and stdout that tracks logs, and allows us to ignore expected lines and assert no unexpected ones.

export type Matcher = string | RegExp | ((text: string) => boolean)

type ExpectedMatcher = {matcher: Matcher, optional: boolean}
type LineWatcher = {label: string, lines: string[], expectedMatchers: ExpectedMatcher[]}
type BrowserTracker = {
  watcher: LineWatcher
  onConsole: (msg: ConsoleMessage) => void
  onPageError: (error: Error) => void
}

const browserTrackerKey = Symbol.for('graphene.logWatcher.browser')
const stdoutTrackerKey = Symbol.for('graphene.logWatcher.stdout')

export function createLineWatcher (label: string): LineWatcher {
  return {label, lines: [], expectedMatchers: []}
}

export function expectLine (watcher: LineWatcher, matcher: Matcher, optional = false) {
  watcher.expectedMatchers.push({matcher, optional})
}

export function recordLine (watcher: LineWatcher, text: string) {
  watcher.lines.push(text.trim())
}

export function assertLines (watcher: LineWatcher) {
  let unexpected = watcher.lines.filter(line => !watcher.expectedMatchers.some(m => matches(line, m.matcher)))
  let missed = watcher.expectedMatchers.filter(m => !m.optional && !watcher.lines.some(line => matches(line, m.matcher)))

  let problems: string[] = []
  if (unexpected.length) problems.push(`Unexpected ${watcher.label} logs:\n${unexpected.map(line => `  - ${line}`).join('\n')}`)
  if (missed.length) problems.push(`Expected ${watcher.label} logs not seen:\n${missed.map(m => `  - ${describe(m.matcher)}`).join('\n')}`)
  if (problems.length) throw new Error(problems.join('\n\n'))
}

export function isExpectedLine (text: string, expected: Matcher[]) {
  return expected.some(matcher => matches(text, matcher))
}

export function unexpectedLineError (type: string | undefined, text: string) {
  return new Error(`Unexpected ${type || 'console'} output during tests: ${text}`)
}

export function trackBrowserConsole (page: Page) {
  let existing: BrowserTracker | undefined = (page as any)[browserTrackerKey]
  if (existing) return existing

  let watcher = createLineWatcher('browser')
  let isExpected = (text: string) => watcher.expectedMatchers.some(m => matches(text, m.matcher))
  let onConsole = (msg: ConsoleMessage) => {
    let type = msg.type()
    if (type == 'debug') return
    let text = msg.text()
    if (msg.location()?.url) text += ' @ ' + msg.location().url
    if (msg.location()?.lineNumber) text += ':' + msg.location().lineNumber
    if (type === 'warning' || type === 'error') {
      recordLine(watcher, text)
      if (isExpected(text)) return
    }
    console.log(`[browser ${type}] ${text}`)
  }
  let onPageError = (error: Error) => {
    let text = (error.message || String(error)).trim()
    let stack = error.stack || ''
    recordLine(watcher, text)
    if (isExpected(text)) return
    console.error(`[browser error] ${text}`)
    if (stack) console.error(`[browser stack] ${stack}`)
  }

  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  let tracker = {watcher, onConsole, onPageError}
  ;(page as any)[browserTrackerKey] = tracker
  return tracker
}

export function stopTrackingBrowserConsole (page: Page) {
  let tracker = getBrowserTracker(page)
  page.off('console', tracker.onConsole)
  page.off('pageerror', tracker.onPageError)
}

export function expectConsoleError (page: Page, matcher: Matcher, optional = false) {
  expectLine(getBrowserTracker(page).watcher, matcher, optional)
}

export function assertConsoleErrors (page: Page) {
  assertLines(getBrowserTracker(page).watcher)
}

export function installStdoutWatcher ({
  key = stdoutTrackerKey,
  shouldWatch = () => true,
  expected = [],
}: {
  key?: symbol
  shouldWatch?: (text: string) => boolean
  expected?: Matcher[]
}) {
  if ((globalThis as any)[key]) return

  let watcher = createLineWatcher('server')
  expected.forEach(matcher => expectLine(watcher, matcher, true))
  let stdoutWrite = process.stdout.write.bind(process.stdout)
  let stderrWrite = process.stderr.write.bind(process.stderr)

  ;(globalThis as any)[key] = {watcher, stdoutWrite, stderrWrite}

  process.stdout.write = ((chunk: any, ...args: any[]) => handleStdIo('stdout', watcher, shouldWatch, stdoutWrite, chunk, ...args)) as typeof process.stdout.write
  process.stderr.write = ((chunk: any, ...args: any[]) => handleStdIo('stderr', watcher, shouldWatch, stderrWrite, chunk, ...args)) as typeof process.stderr.write
}

function handleStdIo (stream: 'stdout' | 'stderr', watcher: LineWatcher, shouldWatch: (text: string) => boolean, write: typeof process.stdout.write, chunk: any, ...args: any[]) {
  let text = toText(chunk)
  if (!text || !shouldWatch(text)) return write(chunk, ...args)
  recordLine(watcher, text)
  if (watcher.expectedMatchers.some(m => matches(text, m.matcher))) return true
  throw new Error(`Unexpected ${stream} output during tests: ${text.trim()}`)
}

function getBrowserTracker (page: Page) {
  let tracker: BrowserTracker | undefined = (page as any)[browserTrackerKey]
  if (!tracker) throw new Error('browser log tracking has not been initialised for this page')
  return tracker
}

function toText (chunk: any) {
  if (typeof chunk === 'string') return chunk
  if (Buffer.isBuffer(chunk)) return chunk.toString('utf8')
  return String(chunk)
}

function matches (text: string, matcher: Matcher) {
  if (typeof matcher === 'string') return text.includes(matcher)
  if (matcher instanceof RegExp) return matcher.test(text)
  return matcher(text)
}

function describe (matcher: Matcher) {
  if (typeof matcher === 'string') return JSON.stringify(matcher)
  if (matcher instanceof RegExp) return matcher.toString()
  return matcher.name || matcher.toString()
}
