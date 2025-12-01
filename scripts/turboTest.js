import {readFile} from 'node:fs/promises'
import path from 'path'

const JSON_RESULTS_FILE = '/tmp/graphene-test-results.json'

async function findTestToRun () {
  let results = JSON.parse(await readFile(JSON_RESULTS_FILE, 'utf8'))
  let testNameQueryRaw = process.argv[2] || ''
  let testNameQuery = testNameQueryRaw.toLowerCase()

  if (testNameQuery) {
    for (let testSuite of results.testResults) {
      for (let test of testSuite.assertionResults) {
        let name = test.title.toLowerCase()
        let fullName = (test.fullName || '').toLowerCase()
        if (name.includes(testNameQuery) || fullName.includes(testNameQuery)) {
          return {
            file: testSuite.name,
            name: test.title,
            fullName: test.fullName,
          }
        }
      }
    }
    console.log(`⚠️ No test includes "${testNameQueryRaw}". Defaulting to first failed test.`)
  }

  for (let testSuite of results.testResults) {
    if (testSuite.status === 'failed') {
      for (let test of testSuite.assertionResults) {
        if (test.status === 'failed') {
          return {
            file: testSuite.name,
            name: test.title,
            fullName: test.fullName,
            error: test.failureMessages.join('\n'),
          }
        }
      }
    }
  }

  return null
}

// small wait for the debugger to attach
await new Promise((r) => setTimeout(r, 1000))

let selectedTest = await findTestToRun()
if (!selectedTest) {
  console.log('No failed tests found. Run `ta` first.')
  process.exit(0)
}

console.log(`🔍 Running test: ${path.basename(selectedTest.file)} - ${selectedTest.name}`)

global['__vitest_worker__'] = {environment: {name: 'TEST'}}

let beforeAllFns = []
let beforeEachFns = []
let afterEachFns = []
let testToRun = null

process.prependListener('uncaughtExceptionMonitor', (error) => {
  console.error(error.message)
  if (error.expected) console.log('expected', error.expected)
  if (error.actual) console.log('actual  ', error.actual)
})

global.describe = (name, fn) => fn()
global.it = (name, fn) => {
  if (name !== selectedTest.name) return
  testToRun = fn
}
global.it.only = (name, fn) => {
  testToRun = fn
}

global.beforeAll = (fn) => beforeAllFns.push(fn)
global.beforeEach = (fn) => beforeEachFns.push(fn)
global.afterEach = (fn) => afterEachFns.push(fn)
global.it.skip = () => {}

await import(selectedTest.file)
// https://github.com/nodejs/node/issues/50430#issuecomment-2449419913
process.nextTick(async () => {
  for (let fn of beforeAllFns) await fn()
  for (let fn of beforeEachFns) await fn()
  await testToRun()
})
