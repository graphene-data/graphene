import {type ConsoleMessage, type Page} from '@playwright/test'

type Matcher = string | RegExp | ((text: string) => boolean)
type ExpectedMatcher = {matcher: Matcher, optional: boolean}
type Tracker = {errors: string[], expectedMatchers: ExpectedMatcher[], onConsole: (msg: ConsoleMessage) => void, onPageError: (error: Error) => void}

const trackerKey = Symbol.for('graphene.console.errors')

/** Register an expected console error. Matching errors will be suppressed from output. */
export function expectConsoleError (page: Page, matcher: Matcher, optional = false) {
  let tracker = getTracker(page)
  tracker.expectedMatchers.push({matcher, optional})
}

/** Asserts that all expected errors occurred and no unexpected errors were logged. */
export function assertConsoleErrors (page: Page) {
  let tracker = getTracker(page)
  let unexpected = tracker.errors.filter(e => !tracker.expectedMatchers.some(m => matches(e, m.matcher)))
  let missed = tracker.expectedMatchers.filter(m => !m.optional && !tracker.errors.some(e => matches(e, m.matcher)))

  let problems: string[] = []
  if (unexpected.length) problems.push(`Unexpected errors:\n${unexpected.map(e => `  - ${e}`).join('\n')}`)
  if (missed.length) problems.push(`Expected errors not seen:\n${missed.map(m => `  - ${describe(m.matcher)}`).join('\n')}`)
  if (problems.length) throw new Error(problems.join('\n\n'))
}

/** Stop tracking console errors. Call after assertConsoleErrors to avoid catching teardown errors. */
export function stopTrackingConsole (page: Page) {
  let tracker = getTracker(page)
  page.off('console', tracker.onConsole)
  page.off('pageerror', tracker.onPageError)
}

export function trackerBrowserConsole (page: Page) {
  let existing: Tracker | undefined = (page as any)[trackerKey]
  if (existing) return existing

  let errors: string[] = []
  let expectedMatchers: ExpectedMatcher[] = []
  let isExpected = (text: string) => expectedMatchers.some(m => matches(text, m.matcher))
  let onConsole = (msg: ConsoleMessage) => {
    let type = msg.type()
    if (type == 'debug') return // noisy
    let text = msg.text()
    if (msg.location()?.url) text += ' @ ' + msg.location().url
    if (msg.location()?.lineNumber) text += ':' + msg.location().lineNumber
    if (type === 'warning' || type === 'error') {
      errors.push(text.trim())
      if (isExpected(text)) return
    }
    console.log(`[browser ${type}] ${text}`)
  }
  let onPageError = (error: Error) => {
    let text = (error.message || String(error)).trim()
    errors.push(text)
    if (isExpected(text)) return
    console.error(`[browser error] ${text}`)
  }

  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  ;(page as any)[trackerKey] = {errors, expectedMatchers, onConsole, onPageError}
}

function getTracker (page: Page) {
  let tracker: Tracker | undefined = (page as any)[trackerKey]
  if (!tracker) throw new Error('browser console tracking has not been initialised for this page')
  return tracker
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
