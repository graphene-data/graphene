import {analyze, toSql, getDiagnostics} from './analyze.ts'
import {expect as vitestExpect} from 'vitest'

const DEBUG = !!process.env.DEBUG

let TEST_PRELUDE = ''

export function setTestPrelude (sql: string) {
  TEST_PRELUDE = sql || ''
}

function normalizeSql (s: string) {
  return s.toLowerCase().replace(/[\s\n]+/g, ' ').replace(/\s+$/, '')
}

function codeFrame (source: string, from: number, to: number): string {
  let lineStart = source.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  let lineEnd = source.indexOf('\n', to)
  let end = lineEnd === -1 ? source.length : lineEnd
  let lineText = source.slice(lineStart, end)
  let col = Math.max(0, from - lineStart)
  let width = Math.max(1, to - from)
  let marker = `${' '.repeat(col)}^${'~'.repeat(Math.max(0, width - 1))}`
  return `${lineText}\n${marker}`
}

function formatDiagnostics (source: string, diagnostics: {from:number; to:number; message:string}[]): string {
  if (!diagnostics.length) return ''
  return diagnostics.map((d, i) => {
    let frame = codeFrame(source, d.from, d.to)
    return `#${i + 1}: ${d.message}\n${frame}`
  }).join('\n\n')
}

vitestExpect.extend({
  toRenderSql (received: string, expectedSql: string) {
    let sql = `${TEST_PRELUDE}\n\n${received}`
    let queries = analyze(sql)
    let diagnostics = getDiagnostics()

    if (DEBUG) console.log('Query:', received)

    if (diagnostics.length > 0) {
      return {
        pass: false,
        message: () => `Expected no diagnostics, but found ${diagnostics.length}:\n\n${formatDiagnostics(sql, diagnostics)}`,
      }
    }

    if (queries.length !== 1) {
      return {
        pass: false,
        message: () => `Expected exactly one query, but found ${queries.length}`,
      }
    }

    let result = toSql(queries[0])
    let pass = normalizeSql(result) === normalizeSql(expectedSql)
    return {
      pass,
      message: () => pass
        ? 'expected SQL not to match (but it did)'
        : 'Rendered SQL did not match.',
      actual: normalizeSql(result),
      expected: normalizeSql(expectedSql),
    }
  },

  toHaveDiagnostic (received: string, pattern: RegExp | string) {
    let sql = `${TEST_PRELUDE}\n\n${received}`
    analyze(sql)
    let diagnostics = getDiagnostics()

    let regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern
    let match = diagnostics.find(d => regex.test(d.message))

    let pass = !!match
    return {
      pass,
      message: () => pass
        ? `Expected no diagnostic matching ${regex}, but found one:\n${formatDiagnostics(sql, [match!])}`
        : `Expected a diagnostic matching ${regex}, but found ${diagnostics.length}.\n\n${formatDiagnostics(sql, diagnostics) || 'No diagnostics.'}`,
    }
  },
})

// Vitest type augmentation
declare module 'vitest' {
  interface Assertion {
    toRenderSql (expectedSql: string): void
    toHaveDiagnostic (pattern: RegExp | string): void
  }

  interface AsymmetricMatchersContaining {
    toRenderSql (expectedSql: string): void
    toHaveDiagnostic (pattern: RegExp | string): void
  }
}
