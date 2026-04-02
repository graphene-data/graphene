import {expect} from 'vitest'

/// <reference types="vitest/globals" />
import {analyze, getDefinition, getHover, getReferences, clearWorkspace, updateFile} from './testHelpers.ts'

function simple(location: ReturnType<typeof getDefinition>) {
  if (!location) return null
  return {
    file: location.file,
    from: [location.from.line, location.from.col],
    to: [location.to.line, location.to.col],
  }
}

function simpleList(locations: ReturnType<typeof getReferences>) {
  return locations.map(location => ({
    file: location.file,
    from: [location.from.line, location.from.col],
    to: [location.to.line, location.to.col],
  }))
}

describe('hover', () => {
  beforeEach(() => {
    clearWorkspace()
  })

  it('returns column info when hovering a selected column', () => {
    analyze(`table users (
      id int,
      -- first and last
      name text
    )
    from users select id, name`)

    let hover = getHover('input', 4, 33)
    expect(hover).toBe('#### users.name\n\nfirst and last')
  })

  it('returns table info when hovering a table', () => {
    analyze(`
      -- all the users in our system
      table users (id int, name text)
    from users select id, name`)

    // Hover over 'f' in 'from' (line 4, col 0)
    let hover = getHover('input', 3, 12)
    expect(hover).toBe('#### users\n\nall the users in our system')
  })
})

describe('definition navigation', () => {
  beforeEach(() => {
    clearWorkspace()
  })

  it('returns the table definition for a FROM reference', () => {
    analyze(`table users (id int, name text)
from users select name`)

    expect(simple(getDefinition('input', 1, 6))).toEqual({
      file: 'input',
      from: [0, 6],
      to: [0, 11],
    })
  })

  it('returns the column definition for a column reference', () => {
    analyze(`table users (id int, name text)
from users select name`)

    expect(simple(getDefinition('input', 1, 18))).toEqual({
      file: 'input',
      from: [0, 21],
      to: [0, 25],
    })
  })

  it('returns the view output definition for a referenced view column', () => {
    analyze(`table users (id int, name text)
table active_users as (
  from users select name as display_name
)
from active_users select display_name`)

    expect(simple(getDefinition('input', 4, 25))).toEqual({
      file: 'input',
      from: [2, 28],
      to: [2, 40],
    })
  })

  it('returns definitions for join condition references', () => {
    analyze(`table users (id int, name text)
table orders (
  id int,
  user_id int,
  join one users on users.id = user_id
)`)

    expect(simple(getDefinition('input', 4, 11))).toEqual({
      file: 'input',
      from: [0, 6],
      to: [0, 11],
    })
    expect(simple(getDefinition('input', 4, 26))).toEqual({
      file: 'input',
      from: [0, 13],
      to: [0, 15],
    })
    expect(simple(getDefinition('input', 4, 31))).toEqual({
      file: 'input',
      from: [3, 2],
      to: [3, 9],
    })
  })

  it('maps markdown table definitions back to the fence header', () => {
    analyze(
      `\`\`\`gsql users
select 1 as id
\`\`\`

<Value data="users" value="id" />`,
      'md',
    )

    expect(simple(getDefinition('input', 4, 13))).toEqual({
      file: 'input',
      from: [0, 8],
      to: [0, 13],
    })
  })
})

describe('reference navigation', () => {
  beforeEach(() => {
    clearWorkspace()
  })

  it('finds references across files for a table definition', () => {
    updateFile('table users (id int, name text)', 'schema.gsql')
    updateFile('from users select name', 'page1.gsql')
    updateFile('from users select users.name', 'page2.gsql')
    analyze()

    expect(simpleList(getReferences('schema.gsql', 0, 7))).toEqual([
      {file: 'page1.gsql', from: [0, 5], to: [0, 10]},
      {file: 'page2.gsql', from: [0, 5], to: [0, 10]},
      {file: 'page2.gsql', from: [0, 18], to: [0, 23]},
    ])
  })

  it('finds references across files for a column definition', () => {
    updateFile('table users (id int, name text)', 'schema.gsql')
    updateFile('from users select name', 'page1.gsql')
    updateFile('from users select users.name', 'page2.gsql')
    analyze()

    expect(simpleList(getReferences('schema.gsql', 0, 22, true))).toEqual([
      {file: 'schema.gsql', from: [0, 21], to: [0, 25]},
      {file: 'page1.gsql', from: [0, 18], to: [0, 22]},
      {file: 'page2.gsql', from: [0, 24], to: [0, 28]},
    ])
  })

  it('does not navigate query-local aliases', () => {
    analyze(`table users (id int, name text)
from users as u select u.name as display_name`)

    expect(getDefinition('input', 1, 33)).toBeNull()
  })
})
