import { $, cd, chalk } from 'zx'

let raw = await $`opencode run --command review-fresh-context --format=json`
let lines = raw.stdout.trim().split('\n')

let last = JSON.parse(lines.pop() || '{}')

// opencode usually prints out a tokens part last. Skip that
if (!last.part?.text) last = JSON.parse(lines.pop() || '{}')

console.log(last.part.text)
