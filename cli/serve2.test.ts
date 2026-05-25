/// <reference types="vitest/globals" />
import {scalarType, type QueryField} from '../lang/types.ts'
import {computeQueryHash} from './serve2.ts'

function field(metadata?: Record<string, string>): Pick<QueryField, 'name' | 'type' | 'metadata'> {
  return {name: 'amount', type: scalarType('number'), metadata}
}

describe('query cache hash', () => {
  it('changes when field metadata changes', () => {
    let sql = 'select amount from revenue'

    let usdHash = computeQueryHash(sql, [field({currency: 'USD'})])
    let eurHash = computeQueryHash(sql, [field({currency: 'EUR'})])

    expect(eurHash).not.toBe(usdHash)
  })
})
