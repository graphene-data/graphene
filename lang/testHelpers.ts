import {analyze, clearWorkspace, toSql} from './analyze.ts'
import {expect as vitestExpect} from 'vitest'

const DEBUG = !!process.env.DEBUG

let TEST_PRELUDE = ''

export function setTestPrelude (sql: string) {
	TEST_PRELUDE = sql || ''
}

function normalizeSql (s: string) {
	return s.toLowerCase().replace(/\s+/g, ' ').replace(/\s+$/, '')
}

function codeFrame (source: string, from: number, to: number): string {
	const lineStart = source.lastIndexOf('\n', Math.max(0, from - 1)) + 1
	const lineEnd = source.indexOf('\n', to)
	const end = lineEnd === -1 ? source.length : lineEnd
	const lineText = source.slice(lineStart, end)
	const col = Math.max(0, from - lineStart)
	const width = Math.max(1, to - from)
	const marker = `${' '.repeat(col)}^${'~'.repeat(Math.max(0, width - 1))}`
	return `${lineText}\n${marker}`
}

function formatDiagnostics (source: string, diagnostics: {from:number; to:number; message:string}[]): string {
	if (!diagnostics.length) return ''
	return diagnostics.map((d, i) => {
		const frame = codeFrame(source, d.from, d.to)
		return `#${i + 1}: ${d.message}\n${frame}`
	}).join('\n\n')
}

vitestExpect.extend({
	toRenderSql (received: string, expectedSql: string) {
		clearWorkspace()
		const sql = `${TEST_PRELUDE}\n\n${received}`
		const {queries, diagnostics} = analyze(sql)

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

		const result = toSql(queries[0])
		if (DEBUG) console.log('Result:', result)

		const pass = normalizeSql(result) === normalizeSql(expectedSql)
		return {
			pass,
			message: () => pass
				? 'expected SQL not to match (but it did)'
				: `Rendered SQL did not match.\n\nExpected:\n${expectedSql}\n\nReceived:\n${result}`,
			actual: result,
			expected: expectedSql,
		}
	},

	toHaveDiagnostic (received: string, pattern: RegExp | string) {
		clearWorkspace()
		const sql = `${TEST_PRELUDE}\n\n${received}`
		const {diagnostics} = analyze(sql)

		const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern
		const match = diagnostics.find(d => regex.test(d.message))

		const pass = !!match
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
	interface Assertion<T = any> {
		toRenderSql (expectedSql: string): void
		toHaveDiagnostic (pattern: RegExp | string): void
	}

	interface AsymmetricMatchersContaining {
		toRenderSql (expectedSql: string): void
		toHaveDiagnostic (pattern: RegExp | string): void
	}
}