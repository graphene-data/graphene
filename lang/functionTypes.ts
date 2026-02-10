// Type definitions for SQL function references
// These are used to define functions in a human-readable format that gets converted to overloads for type checking

export type SQLType = 'string' | 'number' | 'boolean' | 'date' | 'timestamp' | 'json' | 'any' | 'bytes'

// Arg definition - can be a simple tuple or an object with description
// Type patterns:
//   'number'     - required number
//   'number?'    - optional number
//   'string...'  - variadic strings
//   'T'          - generic type (inferred from usage)
//   'T?'         - optional generic
//   'T...'       - variadic generic
//   'kw'         - SQL keyword (not a string value, passed through as-is)
export type ArgDef =
  | [name: string, type: string]
  | {name: string; type: string; description?: string}

// A single function signature (for functions with multiple overloads)
export interface FunctionOverload {
  args: ArgDef[]
  returns: string
}

export interface FunctionDef {
  name: string
  description: string  // Full description from docs (include Definitions, Description, Details sections)
  url: string
  args: ArgDef[]
  returns: string  // Can be SQLType, 'T' for generic, etc.
  aggregate?: boolean
  // For functions where the SQL name differs from the gsql name (e.g., local_timestamp -> LOCALTIMESTAMP)
  sqlName?: string
  // For functions that need a custom SQL template (e.g., 'DATE_TRUNC(${date}, ${unit})')
  sqlTemplate?: string
  // Alternative names that should also resolve to this function (e.g., ['count_if'] for 'countif')
  aliases?: string[]
  // For functions with multiple overloads (e.g., string_agg with/without separator)
  // When present, `args` and `returns` are ignored in favor of overloads
  overloads?: FunctionOverload[]
}
