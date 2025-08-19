/// <reference types="vitest/globals" />
import {clearWorkspace} from './analyze.ts'
import {getCompletions} from './autocomplete.ts'
import {expect} from 'vitest'

const tables = `
table users (
  id int,
  name text,
  email text,
  created_at timestamp,
  join_one orders on orders.user_id = id
)

table orders (
  id int,
  user_id int,
  amount int,
  join_one users on users.id = user_id
)
`

function pos (text: string, marker = '▌'): {text: string; line: number; ch: number} {
  let idx = text.indexOf(marker)
  if (idx === -1) throw new Error('Missing cursor marker')
  let pre = text.slice(0, idx)
  let line = pre.split('\n').length - 1
  let ch = pre.length - pre.lastIndexOf('\n') - 1
  let cleaned = text.slice(0, idx) + text.slice(idx + marker.length)
  return {text: cleaned, line, ch}
}

describe('autocomplete', () => {
  beforeEach(() => clearWorkspace())

  it('suggests tables after FROM', () => {
    let src = tables + `\nselect * from ▌`
    let {text, line, ch} = pos(src)
    let items = getCompletions(text, line, ch)
    let labels = items.map(i => i.label)
    expect(labels).toContain('users')
    expect(labels).toContain('orders')
  })

  it('filters table suggestions by prefix', () => {
    let src = tables + `\nselect * from us▌`
    let {text, line, ch} = pos(src)
    let items = getCompletions(text, line, ch)
    expect(items.some(i => i.label === 'users')).toBe(true)
    expect(items.some(i => i.label === 'orders')).toBe(false)
  })

  it('suggests columns after SELECT', () => {
    let src = tables + `\nfrom users select ▌`
    let {text, line, ch} = pos(src)
    let items = getCompletions(text, line, ch)
    let labels = items.map(i => i.label)
    expect(labels).toContain('id')
    expect(labels).toContain('name')
    expect(labels).toContain('email')
  })

  it('suggests join members after dot traversal', () => {
    let src = tables + `\nfrom orders select users.▌`
    let {text, line, ch} = pos(src)
    let items = getCompletions(text, line, ch)
    let labels = items.map(i => i.label)
    // From users table
    expect(labels).toContain('id')
    expect(labels).toContain('name')
    expect(labels).toContain('email')
  })

  it('supports GROUP BY context', () => {
    let src = tables + `\nfrom users select id group by ▌`
    let {text, line, ch} = pos(src)
    let items = getCompletions(text, line, ch)
    let labels = items.map(i => i.label)
    expect(labels).toContain('id')
    expect(labels).toContain('name')
  })

  it('supports ORDER BY context', () => {
    let src = tables + `\nfrom users select id order by ▌`
    let {text, line, ch} = pos(src)
    let items = getCompletions(text, line, ch)
    let labels = items.map(i => i.label)
    expect(labels).toContain('id')
    expect(labels).toContain('created_at')
  })
})

