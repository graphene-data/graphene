import {type DuckDBConnection, DuckDBInstance} from '@duckdb/node-api'
import {expect as vitestExpect} from 'vitest'

import {analysisOptions, analyzeProject, getFile, getTable, toSql, type AnalysisFileInput, type AnalysisResult, type Diagnostic} from './core.ts'
import {trimIndentation} from './util.ts'

const ECOMM_SETUP = `
  create table users (
    id integer primary key,
    name varchar,
    email varchar,
    created_at timestamp,
    age integer
  );

  create table orders (
    id integer primary key,
    user_id integer,
    amount integer,
    status varchar
  );

  create table order_items (
    id integer primary key,
    order_id integer,
    sku varchar,
    quantity integer
  );

  create table payments (
    id integer primary key,
    user_id integer,
    payment_date date,
    amount integer
  );

  insert into users values
    (1, 'Alice', 'alice@example.com', '2024-01-01', 30),
    (2, 'Bob',   'bob@example.com',   '2024-01-10', 40);

  insert into orders values
    (100, 1, 20, 'completed'),
    (101, 1, 40, 'pending'),
    (102, 2, 40, 'completed');

  insert into order_items values
    (1000, 100, 'WIDGET', 3),
    (1001, 100, 'GADGET', 2),
    (1002, 101, 'WIDGET', 1),
    (1003, 102, 'GIZMO', 5);

  insert into payments values
    (500, 1, '2024-01-05', 100),
    (501, 2, '2024-01-12', 50);
`

function codeFrame(source: string, from: number, to: number): string {
  let lineStart = source.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  let lineEnd = source.indexOf('\n', to)
  let end = lineEnd === -1 ? source.length : lineEnd
  let lineText = source.slice(lineStart, end)
  let col = Math.max(0, from - lineStart)
  let width = Math.max(1, to - from)
  let marker = `${' '.repeat(col)}^${'~'.repeat(Math.max(0, width - 1))}`
  return `${lineText}\n${marker}`
}

function formatDiagnostics(source: string, diagnostics: Diagnostic[]): string {
  if (!diagnostics.length) return ''
  return diagnostics
    .map((d, i) => {
      let frame = codeFrame(source, d.from.offset, d.to.offset)
      return `#${i + 1}: ${d.message}\n${frame}`
    })
    .join('\n\n')
}

function emptyResult(): AnalysisResult {
  return {files: {}, diagnostics: [], queries: []}
}

function inlinePath(contentType: 'gsql' | 'md') {
  return contentType == 'md' ? 'input.md' : 'input.gsql'
}

function analyzeInline(content: string, contentType: 'gsql' | 'md' = contentIncludesMarkdown(content) ? 'md' : 'gsql', files: AnalysisFileInput[] = matcherWorkspaceFiles) {
  let path = inlinePath(contentType)
  return analyzeProject({
    files: [...files.filter(file => file.path != path), {path, contents: content}],
    targetPath: path,
    options: analysisOptions(),
  })
}

function contentIncludesMarkdown(content: string) {
  return content.includes('```')
}

function upsertFile(files: AnalysisFileInput[], nextFile: AnalysisFileInput) {
  return [...files.filter(file => file.path != nextFile.path), nextFile]
}

export function createAnalysisHarness(initialFiles: AnalysisFileInput[] = []) {
  let files = [...initialFiles]
  let lastResult = emptyResult()
  matcherWorkspaceFiles = [...files]

  return {
    clearWorkspace() {
      files = []
      lastResult = emptyResult()
      matcherWorkspaceFiles = []
    },
    updateFile(contents: string, path: string) {
      files = upsertFile(files, {path, contents})
      matcherWorkspaceFiles = [...files]
    },
    analyze(contents?: string, contentType: 'gsql' | 'md' = 'gsql') {
      lastResult = contents === undefined ? analyzeProject({files, options: analysisOptions()}) : analyzeInline(contents, contentType, files)
      return lastResult.queries
    },
    diagnostics() {
      return lastResult.diagnostics
    },
    result() {
      return lastResult
    },
    getTable(name: string) {
      return getTable(lastResult, name)
    },
    getFile(path: string) {
      return getFile(lastResult, path)
    },
  }
}

let conn: DuckDBConnection
let matcherWorkspaceFiles: AnalysisFileInput[] = []

export async function prepareEcommerceTables() {
  let db = await DuckDBInstance.create(':memory:')
  conn = await db.connect()
  await conn.run(ECOMM_SETUP)
}

// small delay to allow debugger to attach, since vitest doesn't support --inspect-wait
if (process.env.GRAPHENE_DEBUG) {
  beforeAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000))
  })
}

vitestExpect.extend({
  toRenderSql(received: string, expectedSql: string, opts: {preserveCase?: boolean} = {}) {
    let content = trimIndentation(received)
    let result = analyzeInline(content)
    let errors = result.diagnostics.filter(d => d.severity === 'error')

    if (errors.length > 0) {
      return {
        pass: false,
        message: () => `Expected no errors, but found ${errors.length}:\n\n${formatDiagnostics(content, errors)}`,
      }
    }

    function normalizeSql(s: string) {
      if (!opts.preserveCase) s = s.toLowerCase()
      return s.replace(/[\s\n]+/g, ' ').replace(/\s+$/, '')
    }

    let sql = toSql(result.queries[0])
    let pass = normalizeSql(sql) === normalizeSql(expectedSql)
    return {
      pass,
      message: () => (pass ? 'expected SQL not to match (but it did)' : 'Rendered SQL did not match.'),
      actual: normalizeSql(sql),
      expected: normalizeSql(expectedSql),
    }
  },

  async toReturnRows(received: string, ...expectedRows: unknown[][]) {
    let content = trimIndentation(received)
    let result = analyzeInline(content)
    let errors = result.diagnostics.filter(d => d.severity === 'error')

    if (errors.length > 0) {
      return {
        pass: false,
        message: () => `Expected no errors, but found ${errors.length}:\n\n${formatDiagnostics(content, errors)}`,
      }
    }
    let sql = toSql(result.queries[0])

    try {
      let reader = await conn.runAndReadAll(sql)
      let actualRows: any[][] = reader.getRowObjects().map(r => {
        return Object.keys(r).map(k => (typeof r[k] === 'bigint' ? Number(r[k]) : r[k]))
      })

      let pass = JSON.stringify(actualRows) === JSON.stringify(expectedRows)
      return {
        pass,
        message: () => (pass ? 'expected rows not to match (but they did)' : `Rows did not match.\nActual: ${JSON.stringify(actualRows)}\nExpected: ${JSON.stringify(expectedRows)}`),
        actual: actualRows,
        expected: expectedRows,
      }
    } catch (err: any) {
      return {
        pass: false,
        message: () => `Execution failed: ${err?.message || String(err)}\nSQL: ${sql}`,
      }
    }
  },

  toHaveDiagnostic(received: string, pattern: RegExp | string) {
    let content = trimIndentation(received)
    let diagnostics = analyzeInline(content).diagnostics

    let regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern
    let match = diagnostics.find(d => regex.test(d.message))

    let pass = !!match
    return {
      pass,
      message: () =>
        pass
          ? `Expected no diagnostic matching ${regex}, but found one:\n${formatDiagnostics(content, [match!])}`
          : `Expected a diagnostic matching ${regex}, but found ${diagnostics.length}.\n\n${formatDiagnostics(content, diagnostics) || 'No diagnostics.'}`,
    }
  },

  toHaveNoErrors(received: string) {
    let content = trimIndentation(received)
    let errors = analyzeInline(content).diagnostics.filter(d => d.severity === 'error')
    return {
      pass: errors.length === 0,
      message: () => (errors.length === 0 ? 'No errors found.' : `Expected no errors, but found ${errors.length}.\n\n${formatDiagnostics(content, errors)}`),
    }
  },
})

// Vitest type augmentation
declare module 'vitest' {
  interface Assertion {
    toRenderSql(expectedSql: string, opts?: {preserveCase: boolean}): void
    toReturnRows(...rows: unknown[][]): Promise<void>
    toHaveDiagnostic(pattern: RegExp | string): void
    toHaveNoErrors(): void
  }

  interface AsymmetricMatchersContaining {
    toRenderSql(expectedSql: string, opts?: {preserveCase: boolean}): void
    toReturnRows(...rows: unknown[][]): Promise<void>
    toHaveDiagnostic(pattern: RegExp | string): void
    toHaveNoErrors(): void
  }
}
