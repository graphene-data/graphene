/// <reference types="vitest/globals" />
import {scalarType, type QueryField} from '../lang/types.ts'
import {formatError} from './printer.ts'
import {computeQueryHash} from './serve2.ts'

function field(metadata?: Record<string, string>): Pick<QueryField, 'name' | 'type' | 'metadata'> {
  return {name: 'amount', type: scalarType('number'), metadata}
}

test('formats a nested error code without exposing its cause', () => {
  let socketError = Object.assign(new Error('other side closed'), {code: 'UND_ERR_SOCKET'})
  let error = new TypeError('fetch failed', {cause: socketError})

  expect(formatError(error)).toBe('fetch failed (UND_ERR_SOCKET)')
})

describe('query cache hash', () => {
  it('changes when field metadata changes', () => {
    let sql = 'select amount from revenue'

    let usdHash = computeQueryHash(sql, [field({currency: 'USD'})])
    let eurHash = computeQueryHash(sql, [field({currency: 'EUR'})])

    expect(eurHash).not.toBe(usdHash)
  })
})
