import {execSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {startVitest} from 'vitest/node'

process.env.GRAPHENE_DEBUG = '1'
process.env.PWDEBUG = '1'

const ROOT_DIR = execSync('git rev-parse --show-toplevel', {encoding: 'utf8'}).trim()

async function loadResults () {
  try {
    let raw = await readFile(path.join(ROOT_DIR, 'node_modules/.testResults.json'), 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error?.code === 'ENOENT') console.log('No test results found. Run `pnpm test` first.')
    else throw error
  }
}

function selectTest (results) {
  for (let suite of results?.testResults || []) {
    if (suite.status !== 'failed') continue
    for (let test of suite.assertionResults || []) {
      if (test.status !== 'failed') continue
      return {file: suite.name, name: test.title}
    }
  }
}

let results = await loadResults()
let selectedTest = selectTest(results)

if (!selectedTest) {
  console.log('No failed tests found. Run `pnpm test` first.')
  process.exit(0)
}

await startVitest('test', [path.relative(ROOT_DIR, selectedTest.file)], {
  testNamePattern: selectedTest.name,
  root: ROOT_DIR,
  config: path.join(ROOT_DIR, 'vitest.config.ts'),
  run: true,
  watch: false,
  inspect: true,
  fileParallelism: false,
  reporters: ['dot'],
})
