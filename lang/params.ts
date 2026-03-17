import type {Query} from './types.ts'

import {parseTemporalLiteral} from './temporal.ts'

// Fill in parameter values in a query's SQL strings
// Params look like $paramName in the SQL
export function fillInParams(query: Query, params: Record<string, any>) {
  query.sql = replaceParams(query.sql, params)
}

function replaceParams(sql: string, params: Record<string, any>): string {
  // Alternation: match single-quoted strings (including escaped '') first, then $params.
  // When we match a quoted string the capture group is undefined, so we return it unchanged.
  return sql.replace(/'(?:[^']|'')*'|\$(\w+)/g, (match, name) => {
    if (!name) return match
    let value = params[name]
    if (value === undefined) throw new Error(`Missing param $${name}`)
    if (value === null) return 'NULL'
    if (typeof value === 'string') {
      // Check if it looks like a date/timestamp
      let asDate = parseTemporalLiteral(value, 'date')
      if (asDate) return `DATE '${asDate.literal}'`
      let asTimestamp = parseTemporalLiteral(value, 'timestamp')
      if (asTimestamp) return `TIMESTAMP '${asTimestamp.literal}'`
      // Regular string
      return `'${value.replace(/'/g, "''")}'`
    }
    if (typeof value === 'number') return value.toString()
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (Array.isArray(value)) {
      // For IN clauses with array params
      return value
        .map(v => {
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`
          return String(v)
        })
        .join(',')
    }
    throw new Error(`Unsupported param type for $${name}: ${typeof value}`)
  })
}
