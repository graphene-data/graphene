import {type DuckDBConnection, DuckDBInstance} from '@duckdb/node-api'
import {expect as vitestExpect} from 'vitest'

import {config} from './config.ts'
import {
  analyzeWorkspace,
  getDefinition as getDefinitionFromResult,
  getDiagnostics as getDiagnosticsFromResult,
  getFile as getFileFromResult,
  getHover as getHoverFromResult,
  getReferences as getReferencesFromResult,
  getTable as getTableFromResult,
  loadWorkspace as loadWorkspaceFiles,
  toSql,
} from './core.ts'
import {type AnalysisResult, type GrapheneError, type WorkspaceFileInput} from './types.ts'
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

  create table events (
    id integer primary key,
    tags varchar[]
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

  insert into events values
    (1, ['vip', 'beta']),
    (2, []),
    (3, null);
`

function formatDiagnostics(_source: string, diagnostics: GrapheneError[]): string {
  if (!diagnostics.length) return ''
  return diagnostics.map((d, i) => `#${i + 1}: ${d.message}${d.frame ? `\n${d.frame}` : ''}`).join('\n\n')
}

let conn: DuckDBConnection
let files: WorkspaceFileInput[] = []
let lastResult: AnalysisResult = {files: [], diagnostics: []}

export async function prepareEcommerceTables() {
  let db = await DuckDBInstance.create(':memory:')
  conn = await db.connect()
  await conn.run(ECOMM_SETUP)
}

export function clearWorkspace() {
  files = []
  lastResult = {files: [], diagnostics: []}
}

export function updateFile(contents: string, path: string, kind?: 'gsql' | 'md') {
  let next = {path, contents, kind}
  let idx = files.findIndex(file => file.path == path)
  if (idx >= 0) files[idx] = next
  else files.push(next)
}

export async function loadWorkspace(dir: string, includeMd: boolean) {
  files = await loadWorkspaceFiles(dir, includeMd, config.ignoredFiles)
  lastResult = {files: [], diagnostics: []}
}

export function analyze(contents?: string, contentType?: 'gsql' | 'md') {
  if (contents) {
    lastResult = analyzeWorkspace({config, files: files.filter(file => file.path != 'input').concat({path: 'input', contents, kind: contentType})}, 'input')
  } else {
    lastResult = analyzeWorkspace({config, files})
  }
  files = files.map(file => {
    let analyzed = getFileFromResult(lastResult, file.path)
    if (!analyzed) return file
    return {
      ...file,
      parsed: {
        tree: analyzed.tree!,
        virtualContents: analyzed.virtualContents,
        virtualToMarkdownOffset: analyzed.virtualToMarkdownOffset,
      },
    }
  })
  return getFileFromResult(lastResult, 'input')?.queries || []
}

export function getDiagnostics() {
  return getDiagnosticsFromResult(lastResult)
}

export function getTable(name: string) {
  return getTableFromResult(lastResult, name)
}

export function getFile(name: string) {
  return getFileFromResult(lastResult, name) || files.find(file => file.path == name)
}

export function getHover(path: string, line: number, col: number) {
  return getHoverFromResult(lastResult, path, line, col)
}

export function getDefinition(path: string, line: number, col: number) {
  return getDefinitionFromResult(lastResult, path, line, col)
}

export function getReferences(path: string, line: number, col: number, includeDeclaration = false) {
  return getReferencesFromResult(lastResult, path, line, col, includeDeclaration)
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
    let queries = analyze(content, content.includes('```') ? 'md' : 'gsql')
    let errors = getDiagnostics().filter(d => d.severity === 'error')

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

    let sql = toSql(queries[0])
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
    let queries = analyze(content, content.includes('```') ? 'md' : 'gsql')
    let errors = getDiagnostics().filter(d => d.severity === 'error')

    if (errors.length > 0) {
      return {
        pass: false,
        message: () => `Expected no errors, but found ${errors.length}:\n\n${formatDiagnostics(content, errors)}`,
      }
    }
    let sql = toSql(queries[0])

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
    analyze(content, content.includes('```') ? 'md' : 'gsql')

    let diagnostics = getDiagnostics()

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
    analyze(content, content.includes('```') ? 'md' : 'gsql')

    let errors = getDiagnostics().filter(d => d.severity === 'error')
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
