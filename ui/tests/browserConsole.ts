import {expect, type ConsoleMessage, type Page} from '@playwright/test'

type Matcher = string | RegExp | ((text: string) => boolean)
type Tracker = {errors: string[], stop: () => void}

const trackerKey = Symbol.for('graphene.console.errors')

export function expectConsoleError (page: Page, matcher: Matcher) {
  let tracker = getTracker(page)
  let index = tracker.errors.findIndex(text => matches(text, matcher))
  if (index === -1) {
    let lines = tracker.errors.map(text => `- ${text}`).join('\n')
    throw new Error(`Expected browser console error matching ${describe(matcher)}, but none matched.\nCurrent errors:\n${lines || '- <none>'}`)
  }
  tracker.errors.splice(index, 1)
}

export function assertNoConsoleErrors (page: Page) {
  let tracker = getTracker(page)
  expect(tracker.errors).toMatchObject([])
}

export function getTrackerForPage (page: Page): Tracker {
  let existing: Tracker | undefined = (page as any)[trackerKey]
  if (existing) return existing

  let errors: string[] = []
  let push = (text: string) => {
    let message = text.trim()
    errors.push(message)
    console.error(`[browser error] ${message}`)
  }
  let onConsole = (msg: ConsoleMessage) => {
    let type = msg.type()
    if (type == 'debug') return // noisy
    if (type === 'warning' || type === 'error') push(msg.text())
    console.log(`[browser ${type}] ${msg.text()}`)
  }
  let onPageError = (error: Error) => push(error.message || String(error))

  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  let tracker: Tracker = {
    errors,
    stop: () => {
      if (!(page as any)[trackerKey]) return
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
      delete (page as any)[trackerKey]
    },
  }
  ;(page as any)[trackerKey] = tracker
  return tracker
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
