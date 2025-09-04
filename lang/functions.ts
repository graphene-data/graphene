import {type DefinitionBlueprintMap} from '@malloydata/malloy'
import {DUCKDB_DIALECT_FUNCTIONS} from './node_modules/@malloydata/malloy/dist/dialect/duckdb/dialect_functions.js'

// This file adds functions to existing Malloy dialects. Look for `dialect_function` files in Malloy to get more examples.

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
}
