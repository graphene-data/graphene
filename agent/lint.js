#!/usr/bin/env zx

let json = await JSON.parse(await stdin())
console.log('HOOK INPUT', JSON.stringify(json))
let file = json.tool_response?.filePath
let res = await $({nothrow: true})`./node_modules/.bin/eslint --fix ${file}`
// console.log(res)
