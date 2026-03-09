import {expect} from 'vitest'

/// <reference types="vitest/globals" />
import {analyze, getHover, clearWorkspace} from './core.ts'

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
