import {type Page} from '@playwright/test'
import {expect} from 'vitest'

// This lets us listen for and fail tests on unexpected console errors in both browsers and the server.

type Matcher = string | RegExp

let expected: Matcher[] = []
let unexpected: string[] = []

// Registers an expected console error for the current test.
export function expectConsoleError(matcher: Matcher) {
  expected.push(matcher)
}

export function resetExpectedLogs() {
  expected = []
  unexpected = []
}

function isExpected(log: string): boolean {
  for (let ex of expected) {
    if (typeof ex == 'string' && log.includes(ex)) return true
    if (ex instanceof RegExp && log.match(ex)) return true
  }
  return false
}

// Handles Vitest console output and fails fast on unexpected lines.
export function onServerLog(log: string) {
  if (isExpected(log)) return false
  console.log(log)
  unexpected.push(log)
}

// Starts tracking warning/error browser console output for a page.
export function trackBrowserConsole(page: Page) {
  page.on('console', msg => {
    if (msg.type() !== 'warning' && msg.type() !== 'error') return
    let text = msg.text()
    if (isExpected(text)) return

    let location = msg.location()
    let locationText = location.url ? ` (${location.url}:${location.lineNumber}:${location.columnNumber})` : ''
    throw new Error(`Unexpected log ${text}${locationText}`)
  })
  page.on('pageerror', err => {
    let text = String(err?.message || err)
    if (isExpected(text)) return
    throw new Error(`Unexpected error ${text}`)
  })
}

export function assertOnlyExpectedLogs() {
  expect(unexpected).toEqual([])
}
