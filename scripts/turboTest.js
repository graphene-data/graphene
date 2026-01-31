import {execSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {startVitest} from 'vitest/node'

process.env.GRAPHENE_DEBUG = '1'
process.env.PWDEBUG = '1'

// Get the workspace root (core directory) based on where this script is located
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = path.resolve(__dirname, '..')
const searchString = process.argv[2]

async function loadResults () {
  // Check both cwd and core workspace for test results
  let locations = [
    {resultsPath: path.join(process.cwd(), 'node_modules/.testResults.json'), root: process.cwd()},
    {resultsPath: path.join(WORKSPACE_ROOT, 'node_modules/.testResults.json'), root: WORKSPACE_ROOT},
  ]
  for (let {resultsPath, root} of locations) {
    try {
      let raw = await readFile(resultsPath, 'utf8')
      return {results: JSON.parse(raw), root}
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      throw error
    }
  }
  return {results: null, root: WORKSPACE_ROOT}
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
      {encoding: 'utf8', cwd: WORKSPACE_ROOT},
    )
    let matches = []
    for (let line of output.trim().split('\n')) {
      let match = line.match(/^(.+?):(\d+):.*(it|test)\(['"`](.+?)['"`]/)
      if (match) {
        matches.push({file: path.join(WORKSPACE_ROOT, match[1]), name: match[4], lineNum: match[2]})
      }
    }
    return matches
  } catch (error) {
    if (error.status === 1) return [] // grep found nothing
    throw error
  }
}

let selectedTest
let testRoot = WORKSPACE_ROOT

if (searchString) {
  let matches = searchForTests(searchString)
  if (matches.length === 0) {
    console.log(`No tests found matching "${searchString}".`)
    process.exit(1)
  } else if (matches.length > 1) {
    console.log(`Multiple tests match "${searchString}". Please be more specific:\n`)
    for (let match of matches) {
      console.log(`  - ${match.name}`)
      console.log(`    ${path.relative(WORKSPACE_ROOT, match.file)}:${match.lineNum}\n`)
    }
    process.exit(1)
  } else {
    selectedTest = matches[0]
  }
} else {
  let {results, root} = await loadResults()
  testRoot = root
  selectedTest = selectFailedTest(results)
  if (!selectedTest) {
    console.log('No failed tests found. Run `pnpm test` first, or specify a test filter.')
    process.exit(0)
  }
}

await startVitest('test', [path.relative(testRoot, selectedTest.file)], {
  testNamePattern: selectedTest.name,
  root: testRoot,
  config: path.join(testRoot, 'vitest.config.ts'),
  run: true,
  watch: false,
  inspect: true,
  fileParallelism: false,
  reporters: ['dot'],
})
