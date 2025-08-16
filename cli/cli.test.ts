/// <reference types="vitest/globals" />
import {expect} from 'vitest'
import {spawn} from 'node:child_process'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

interface RunResult {
	code: number
	stdout: string
	stderr: string
}

function runCli (args: string[], cwd?: string): Promise<RunResult> {
	return new Promise((resolve) => {
		const cliEntry = '/workspace/cli/cli.ts'
		const child = spawn('node', ['--experimental-strip-types', cliEntry, ...args], {cwd, env: process.env})
		let stdout = ''
		let stderr = ''
		child.stdout.on('data', (d) => (stdout += d.toString()))
		child.stderr.on('data', (d) => (stderr += d.toString()))
		child.on('close', (code) => resolve({code: code ?? 0, stdout, stderr}))
	})
}

async function ensureFlightsDb (): Promise<void> {
	const dbPath = '/workspace/examples/flights/flights.duckdb'
	if (fs.existsSync(dbPath)) return
	const setupScript = '/workspace/examples/flights/setup.sh'
	await fsp.chmod(setupScript, 0o755)
	await new Promise<void>((resolve, reject) => {
		const child = spawn('bash', [setupScript], {cwd: path.dirname(setupScript)})
		child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('setup.sh failed'))))
	})
}

describe('cli compile', () => {
	it('compiles a basic query (happy path)', async () => {
		const res = await runCli(['compile', 'from flights select carrier'], '/workspace/examples/flights')
		expect(res.code).toBe(0)
		expect(res.stdout.toLowerCase()).toContain('from flights')
		expect(res.stdout.toLowerCase()).toContain('select')
	})

	it('errors on invalid function (error path)', async () => {
		const res = await runCli(['compile', 'from flights select not_a_function()'], '/workspace/examples/flights')
		expect(res.code).not.toBe(0)
		expect(res.stderr.toLowerCase()).toContain('unknown function')
	})
})

describe('cli run', () => {
	beforeAll(async () => {
		await ensureFlightsDb()
	})

	it('runs a query against flights.duckdb (happy path)', async () => {
		const res = await runCli(['run', 'from flights select count() as total'], '/workspace/examples/flights')
		expect(res.code).toBe(0)
		expect(res.stdout.toLowerCase()).toContain('total')
	})

	it('shows an error when no .duckdb is present (error path)', async () => {
		const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'graphene-cli-'))
		const input = [
			'table t (a int)',
			'from t select a',
		].join('\n')
		const res = await runCli(['run', input], tmpDir)
		expect(res.code).toBe(0) // command handles the error and exits without throwing
		expect(res.stderr.toLowerCase()).toContain('no .duckdb file found')
	})
})