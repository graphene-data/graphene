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

  it('highlights array type declarations and casts', async () => {
    let lines = await tokenize(
      `
table events (
  tags array<string>
  ids: cast(tags as array<string>)
)
`.trim(),
    )

    expect(findToken(lines[1], 'array').scopes).toContain('storage.type.gsql')
    expect(findToken(lines[2], 'array').scopes).toContain('storage.type.gsql')
    expect(findToken(lines[2], 'ids').scopes).toContain('meta.declaration.table.graphene.gsql')
  })

  it('highlights join declarations with the same control-keyword scope as on', async () => {
    let lines = await tokenize(
      `
table users (
  id int
  join one orders on orders.user_id = id
  join many payments on payments.user_id = id
)
`.trim(),
    )

    expect(findToken(lines[2], 'join').scopes).toContain('keyword.control.gsql')
    expect(findToken(lines[2], 'one').scopes).toContain('keyword.control.gsql')
    expect(findToken(lines[2], 'on').scopes).toContain('keyword.control.gsql')
    expect(findToken(lines[3], 'join').scopes).toContain('keyword.control.gsql')
    expect(findToken(lines[3], 'many').scopes).toContain('keyword.control.gsql')
    expect(findToken(lines[3], 'on').scopes).toContain('keyword.control.gsql')
  })

  it('highlights unnest with the same control-keyword scope as cross join', async () => {
    let lines = await tokenize(
      `
from events
cross join unnest(tags) as tag
select tag
`.trim(),
    )

    expect(findToken(lines[1], 'cross').scopes).toContain('keyword.control.gsql')
    expect(findToken(lines[1], 'join').scopes).toContain('keyword.control.gsql')
    expect(findToken(lines[1], 'unnest').scopes).toContain('keyword.control.gsql')
    expect(findToken(lines[1], 'as').scopes).toContain('keyword.control.gsql')
  })

  it('highlights metadata pairs inside hash comments', async () => {
    let lines = await tokenize(
      `
table revenue (
  #color=green #hide #format="US Dollar"
  amount int
)
`.trim(),
    )

    expect(findToken(lines[1], 'color').scopes).toContain('entity.other.attribute-name.metadata.gsql')
    expect(findToken(lines[1], 'green').scopes).toContain('string.other.metadata.gsql')
    expect(findToken(lines[1], 'hide').scopes).toContain('entity.other.attribute-name.metadata.gsql')
    expect(findToken(lines[1], 'format').scopes).toContain('entity.other.attribute-name.metadata.gsql')
    expect(findToken(lines[1], 'US Dollar').scopes).toContain('string.other.metadata.gsql')
  })

  it('highlights metadata pairs embedded in dash comments', async () => {
    let lines = await tokenize(
      `
table revenue (
  amount int -- gross revenue #hide #format="US Dollar"
)
`.trim(),
    )

    expect(findToken(lines[1], 'gross').scopes).toContain('comment.line.double-dash.gsql')
    expect(findToken(lines[1], 'hide').scopes).toContain('entity.other.attribute-name.metadata.gsql')
    expect(findToken(lines[1], 'format').scopes).toContain('entity.other.attribute-name.metadata.gsql')
  })
})
