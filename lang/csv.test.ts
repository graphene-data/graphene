/// <reference types="vitest/globals" />
import {expect} from 'vitest'

import {rowsToCsv} from './csv.ts'
import {scalarType} from './types.ts'

describe('rowsToCsv', () => {
  it('serializes headers and rows with csv escaping', () => {
    let rows = [
      {name: 'Alice', note: 'hello, "world"', bio: 'line 1\nline 2'},
      {name: 'Bob', note: null, bio: undefined},
    ]

    expect(rowsToCsv(rows)).toBe(['name,note,bio', 'Alice,"hello, ""world""","line 1\nline 2"', 'Bob,,'].join('\n'))
  })

  it('uses field order and resolves row keys case-insensitively', () => {
    let fields = [
      {name: 'carrier', type: scalarType('string')},
      {name: 'total', type: scalarType('number')},
    ]

    expect(rowsToCsv([{CARRIER: 'AA', TOTAL: 12}], fields)).toBe(['carrier,total', 'AA,12'].join('\n'))
  })

  it('serializes arrays, objects, dates, and bigint values', () => {
    let rows = [{id: 1n, tags: ['a', 'b'], payload: {ok: true}, created_at: new Date('2024-01-02T03:04:05.000Z')}]

    expect(rowsToCsv(rows)).toBe(['id,tags,payload,created_at', '1,"[""a"",""b""]","{""ok"":true}",2024-01-02T03:04:05.000Z'].join('\n'))
  })

  it('can emit a header-only csv for empty results with known fields', () => {
    expect(rowsToCsv([], [{name: 'carrier'}, {name: 'total'}])).toBe('carrier,total')
  })
})
