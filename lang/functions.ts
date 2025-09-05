import {type DefinitionBlueprintMap} from '@malloydata/malloy'
import {DUCKDB_DIALECT_FUNCTIONS} from './node_modules/@malloydata/malloy/dist/dialect/duckdb/dialect_functions.js'
import {GlobalNameSpace} from './node_modules/@malloydata/malloy/dist/lang/ast/types/global-name-space.js'
import {DialectNameSpace} from './node_modules/@malloydata/malloy/dist/lang/ast/types/dialect-name-space.js'
import type {FunctionOverloadDef} from './node_modules/@malloydata/malloy/dist/model/index.js'
import {getDialect} from './node_modules/@malloydata/malloy/dist/dialect/dialect_map.js'

// This file adds functions to existing Malloy dialects. Look for `dialect_function` files in Malloy to get more examples.

let globalNamespace = new GlobalNameSpace()
let dialectNamespaces = new Map<string, DialectNameSpace>()

export function findOverloads (name: string, dialect: string): FunctionOverloadDef[] {
  if (!dialectNamespaces.has(dialect)) {
    let d = getDialect(dialect)
    dialectNamespaces.set(dialect, new DialectNameSpace(d))
  }

  let res = dialectNamespaces.get(dialect)!.getEntry(name) || globalNamespace.getEntry(name)
  return res?.entry ? (res.entry as any).overloads : []
}

DUCKDB_DIALECT_FUNCTIONS['count_if'] = {
  takes: {'value': 'boolean'},
  returns: {measure: 'number'},
  impl: {function: 'COUNT_IF'},
}

DUCKDB_DIALECT_FUNCTIONS['if'] = {
  takes: {'condition': 'boolean', 'trueValue': {generic: 'T'}, 'falseValue': {generic: 'T'}},
  generic: {'T': ['any']},
  returns: {generic: 'T'},
  impl: {function: 'IF'},
}

export const BIGQUERY_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  'count_if': {...DUCKDB_DIALECT_FUNCTIONS['count_if']},
  'if': {...DUCKDB_DIALECT_FUNCTIONS['if']},
  'safe_divide': {
    takes: {'numerator': 'number', 'denominator': 'number'},
    returns: {measure: 'number'},
    impl: {function: 'SAFE_DIVIDE'},
  },
  'timestamp_diff': {
    takes: {'start': 'timestamp', 'end': 'timestamp', 'unit': 'string'},
    returns: {measure: 'number'},
    impl: {function: 'TIMESTAMP_DIFF'},
  },
}
