/// <reference types="vitest/globals" />
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {loadWASM, OnigScanner, OnigString} from 'vscode-oniguruma'
import {INITIAL, Registry} from 'vscode-textmate'

let grammarPath = path.join(__dirname, '..', 'gsql.tmLanguage.json')
let wasmPath = path.join(__dirname, '..', 'node_modules', 'vscode-oniguruma', 'release', 'onig.wasm')

let onigLib = (async () => {
  await loadWASM(await readFile(wasmPath))
  return {
    createOnigScanner(patterns: string[]) {
      return new OnigScanner(patterns)
    },
    createOnigString(text: string) {
      return new OnigString(text)
    },
  }
})()

let registry = new Registry({
  onigLib,
  loadGrammar: async scopeName => {
    if (scopeName !== 'source.graphene-sql') return null
    return JSON.parse(await readFile(grammarPath, 'utf8'))
  },
})

async function tokenize(text: string) {
  let grammar = await registry.loadGrammar('source.graphene-sql')
  if (!grammar) throw new Error('Failed to load Graphene SQL grammar')

  let ruleStack = INITIAL
  return text.split('\n').map(line => {
    let result = grammar.tokenizeLine(line, ruleStack)
    ruleStack = result.ruleStack
    return result.tokens.map(token => ({
      text: line.slice(token.startIndex, token.endIndex),
      scopes: token.scopes,
    }))
  })
}

function findToken(tokens: {text: string; scopes: string[]}[], text: string) {
  let token = tokens.find(token => token.text.includes(text))
  if (!token) throw new Error(`Could not find token containing ${JSON.stringify(text)}`)
  return token
}

describe('gsql tmLanguage', () => {
  it('keeps table declaration scope after function calls in measures', async () => {
    let lines = await tokenize(
      `
table users (
  amount int
  total: sum(amount)
  active bool
)
`.trim(),
    )

    expect(findToken(lines[2], 'sum').scopes).toContain('meta.declaration.table.graphene.gsql')
    expect(findToken(lines[3], 'active').scopes).toContain('meta.declaration.table.graphene.gsql')
  })

  it('keeps table declaration scope after parameterized column types', async () => {
    let lines = await tokenize(
      `
table users (
  name varchar(100)
  active bool
)
`.trim(),
    )

    expect(findToken(lines[1], 'varchar').scopes).toContain('meta.declaration.table.graphene.gsql')
    expect(findToken(lines[2], 'active').scopes).toContain('meta.declaration.table.graphene.gsql')
  })

  it('handles nested function calls without dropping out of the table scope', async () => {
    let lines = await tokenize(
      `
table users (
  amount int
  total: round(sum(amount))
  active bool
)
`.trim(),
    )

    expect(findToken(lines[2], 'round').scopes).toContain('meta.declaration.table.graphene.gsql')
    expect(findToken(lines[2], 'sum').scopes).toContain('meta.declaration.table.graphene.gsql')
    expect(findToken(lines[3], 'active').scopes).toContain('meta.declaration.table.graphene.gsql')
  })
})
