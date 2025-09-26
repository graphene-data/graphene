import {toSql, analyze, getDiagnostics, type Diagnostic} from './core.ts'
import {expect as vitestExpect} from 'vitest'
import {DuckDBConnection, DuckDBInstance} from '@duckdb/node-api'
import {trimIndentation} from './util.ts'

const DEBUG = !!process.env.DEBUG

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

function formatDiagnostics (source: string, diagnostics: Diagnostic[]): string {
  if (!diagnostics.length) return ''
  return diagnostics.map((d, i) => {
    let frame = codeFrame(source, d.from.offset, d.to.offset)
    return `#${i + 1}: ${d.message}\n${frame}`
  }).join('\n\n')
}

let conn: DuckDBConnection

export async function prepareEcommerceTables () {
  let db = await DuckDBInstance.create(':memory:')
  conn = await db.connect()
  await conn.run(ECOMM_SETUP)
}

vitestExpect.extend({
  toRenderSql (received: string, expectedSql: string) {
    if (DEBUG) console.log('Query:', received)
    let content = trimIndentation(received)
    let queries = analyze(content, content.includes('```') ? 'md' : 'gsql')
    let diagnostics = getDiagnostics()

    if (diagnostics.length > 0) {
      return {
        pass: false,
        message: () => `Expected no diagnostics, but found ${diagnostics.length}:\n\n${formatDiagnostics(content, diagnostics)}`,
      }
    }

    let sql = toSql(queries[0])
    let pass = normalizeSql(sql) === normalizeSql(expectedSql)
    return {
      pass,
      message: () => pass
        ? 'expected SQL not to match (but it did)'
        : 'Rendered SQL did not match.',
      actual: normalizeSql(sql),
      expected: normalizeSql(expectedSql),
    }
  },

  async toReturnRows (received: string, ...expectedRows: unknown[][]) {
    if (DEBUG) console.log('Query:', received)
    let content = trimIndentation(received)
    let queries = analyze(content, content.includes('```') ? 'md' : 'gsql')
    let diagnostics = getDiagnostics()

    if (diagnostics.length > 0) {
      return {
        pass: false,
        message: () => `Expected no diagnostics, but found ${diagnostics.length}:\n\n${formatDiagnostics(content, diagnostics)}`,
      }
    }
    let sql = toSql(queries[0])
    if (DEBUG) console.log('SQL:', sql)

    try {
      let reader = await conn.runAndReadAll(sql)
      let actualRows: any[][] = reader.getRowObjects().map(r => {
        return Object.keys(r).map(k => typeof r[k] === 'bigint' ? Number(r[k]) : r[k])
      })

      let pass = JSON.stringify(actualRows) === JSON.stringify(expectedRows)
      return {
        pass,
        message: () => pass
          ? 'expected rows not to match (but they did)'
          : `Rows did not match.\nActual: ${JSON.stringify(actualRows)}\nExpected: ${JSON.stringify(expectedRows)}`,
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

  toHaveDiagnostic (received: string, pattern: RegExp | string) {
    if (DEBUG) console.log('Query:', received)
    let content = trimIndentation(received)
    analyze(content, content.includes('```') ? 'md' : 'gsql')

    let diagnostics = getDiagnostics()

    let regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern
    let match = diagnostics.find(d => regex.test(d.message))

    let pass = !!match
    return {
      pass,
      message: () => pass
        ? `Expected no diagnostic matching ${regex}, but found one:\n${formatDiagnostics(content, [match!])}`
        : `Expected a diagnostic matching ${regex}, but found ${diagnostics.length}.\n\n${formatDiagnostics(content, diagnostics) || 'No diagnostics.'}`,
    }
  },

  toHaveNoErrors (received: string) {
    if (DEBUG) console.log('Query:', received)
    let content = trimIndentation(received)
    analyze(content, content.includes('```') ? 'md' : 'gsql')

    let errors = getDiagnostics()
    return {
      pass: errors.length === 0,
      message: () => errors.length === 0
        ? 'No errors found.'
        : `Expected no errors, but found ${errors.length}.\n\n${formatDiagnostics(content, errors)}`,
    }
  },
})

// Vitest type augmentation
declare module 'vitest' {
  interface Assertion {
    toRenderSql (expectedSql: string): void
    toReturnRows (...rows: unknown[][]): Promise<void>
    toHaveDiagnostic (pattern: RegExp | string): void
    toHaveNoErrors (): void
  }

  interface AsymmetricMatchersContaining {
    toRenderSql (expectedSql: string): void
    toReturnRows (...rows: unknown[][]): Promise<void>
    toHaveDiagnostic (pattern: RegExp | string): void
    toHaveNoErrors (): void
  }
}
