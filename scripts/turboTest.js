import {execSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {startVitest} from 'vitest/node'

process.env.GRAPHENE_DEBUG = '1'
process.env.PWDEBUG = '1'

const ROOT_DIR = execSync('git rev-parse --show-toplevel', {encoding: 'utf8'}).trim()
const searchString = process.argv[2]

async function loadResults () {
  try {
    let raw = await readFile(path.join(ROOT_DIR, 'node_modules/.testResults.json'), 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

function selectFailedTest (results) {
  for (let suite of results?.testResults || []) {
    if (suite.status !== 'failed') continue
    for (let test of suite.assertionResults || []) {
      if (test.status !== 'failed') continue
      return {file: suite.name, name: test.title}
    }
  }
}

function searchForTests (search) {
  try {
    let output = execSync(
      `grep -rn --include="*.test.ts" -E "(it|test)\\(.*${search}" .`,
      {encoding: 'utf8', cwd: ROOT_DIR},
    )
    let matches = []
    for (let line of output.trim().split('\n')) {
      let match = line.match(/^(.+?):(\d+):.*(it|test)\(['"`](.+?)['"`]/)
      if (match) {
        matches.push({file: path.join(ROOT_DIR, match[1]), name: match[4], lineNum: match[2]})
      }
    }
    return matches
  } catch (error) {
    if (error.status === 1) return [] // grep found nothing
    throw error
  }
}

let selectedTest

if (searchString) {
  let matches = searchForTests(searchString)
  if (matches.length === 0) {
    console.log(`No tests found matching "${searchString}".`)
    process.exit(1)
  } else if (matches.length > 1) {
    console.log(`Multiple tests match "${searchString}". Please be more specific:\n`)
    for (let match of matches) {
      console.log(`  - ${match.name}`)
      console.log(`    ${path.relative(ROOT_DIR, match.file)}:${match.lineNum}\n`)
    }
    process.exit(1)
  } else {
    selectedTest = matches[0]
  }
} else {
  let results = await loadResults()
  selectedTest = selectFailedTest(results)
  if (!selectedTest) {
    console.log('No failed tests found. Run `pnpm test` first, or specify a test filter.')
    process.exit(0)
  }
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
