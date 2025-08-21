import {readFile} from 'node:fs/promises'
import path from 'path'

// alias ta="npm run test --reporter=default --reporter=json --outputFile=/tmp/graphene-test-results.json"
// alias tt="node --experimental-strip-types --inspect ~/co/graphene/scripts/turboTest.js"

const JSON_RESULTS_FILE = '/tmp/graphene-test-results.json'

async function extractFailedTests () {
  let results = JSON.parse(await readFile(JSON_RESULTS_FILE, 'utf8'))
  let failedTests = []

  for (let testSuite of results.testResults) {
    if (testSuite.status === 'failed') {
      for (let test of testSuite.assertionResults) {
        if (test.status === 'failed') {
          failedTests.push({
            file: testSuite.name,
            name: test.title,
            fullName: test.fullName,
            error: test.failureMessages.join('\n'),
          })
        }
      }
    }
  }

  return failedTests
}

// small wait for the debugger to attach
await new Promise((r) => setTimeout(r, 1000))

let failedTests = await extractFailedTests()
if (!failedTests.length) {
  console.log('No failed tests found. Run `ta` first.')
  process.exit(0)
}


let firstTest = failedTests[0]
console.log(`🔍 Running failed test: ${path.basename(firstTest.file)} - ${firstTest.name}`)

global['__vitest_worker__'] = {environment: {name: 'TEST'}}

let beforeAllFns = []
let beforeEachFns = []
let testToRun = null

global.describe = (name, fn) => fn()
global.it = (name, fn) => {
  if (name !== firstTest.name) return
  testToRun = fn
}

global.beforeAll = (fn) => beforeAllFns.push(fn)
global.beforeEach = (fn) => beforeEachFns.push(fn)
global.it.skip = () => {}

await import(firstTest.file)
// https://github.com/nodejs/node/issues/50430#issuecomment-2449419913
process.nextTick(async () => {
  for (let fn of beforeAllFns) await fn()
  for (let fn of beforeEachFns) await fn()
  await testToRun()
})
