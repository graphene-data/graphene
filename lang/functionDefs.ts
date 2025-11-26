import {type DefinitionBlueprintMap, type FunctionOverloadDef, DUCKDB_DIALECT_FUNCTIONS, GlobalNameSpace, DialectNameSpace, getDialect} from '@graphenedata/malloy'

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

Object.assign(DUCKDB_DIALECT_FUNCTIONS, {
  'count_if': {
    takes: {'value': 'boolean'},
    returns: {measure: 'number'},
    impl: {function: 'COUNT_IF'},
  },
  'if': {
    takes: {'condition': 'boolean', 'trueValue': {generic: 'T'}, 'falseValue': {generic: 'T'}},
    generic: {'T': ['any']},
    returns: {generic: 'T'},
    impl: {function: 'IF'},
  },
  'date_trunc': {
    takes: {'unit': 'string', 'date': 'timestamp'},
    returns: 'timestamp',
    impl: {sql: 'DATE_TRUNC(${unit}, ${date})'},
  },
  'current_date': {
    takes: {},
    returns: 'date',
    impl: {function: 'CURRENT_DATE'},
  },
  'current_time': {
    takes: {},
    returns: 'timestamp',
    impl: {function: 'CURRENT_TIME'},
  },
  'current_timestamp': {
    default_precision: {
      takes: {},
      returns: 'timestamp',
      impl: {function: 'CURRENT_TIMESTAMP'},
    },
    precision: {
      takes: {'precision': 'number'},
      returns: 'timestamp',
      impl: {function: 'CURRENT_TIMESTAMP'},
    },
  },
  'local_timestamp': {
    default_precision: {
      takes: {},
      returns: 'timestamp',
      impl: {function: 'LOCALTIMESTAMP'},
    },
    precision: {
      takes: {'precision': 'number'},
      returns: 'timestamp',
      impl: {function: 'LOCALTIMESTAMP'},
    },
  },
})

export const BIGQUERY_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  'count_if': {...DUCKDB_DIALECT_FUNCTIONS['count_if']},
  'if': {...DUCKDB_DIALECT_FUNCTIONS['if']},
  'safe_divide': {
    takes: {'numerator': 'number', 'denominator': 'number'},
    returns: 'number',
    impl: {function: 'SAFE_DIVIDE'},
  },
  'timestamp_diff': {
    takes: {'start': 'timestamp', 'end': 'timestamp', 'unit': {sql_native: 'kw'}},
    returns: 'number',
    impl: {function: 'TIMESTAMP_DIFF'},
  },
  'date_trunc': {
    takes: {'date': 'timestamp', 'unit': {sql_native: 'kw'}},
    returns: 'timestamp',
    impl: {sql: 'DATE_TRUNC(${date}, ${unit})'},
  },
  'current_date': {
    default_timezone: {
      takes: {},
      returns: 'date',
      impl: {function: 'CURRENT_DATE'},
    },
    timezone: {
      takes: {'timezone': 'string'},
      returns: 'date',
      impl: {function: 'CURRENT_DATE'},
    },
  },
  'current_time': {
    default_timezone: {
      takes: {},
      returns: 'timestamp',
      impl: {function: 'CURRENT_TIME'},
    },
    timezone: {
      takes: {'timezone': 'string'},
      returns: 'timestamp',
      impl: {function: 'CURRENT_TIME'},
    },
  },
  'current_timestamp': {
    default_timezone: {
      takes: {},
      returns: 'timestamp',
      impl: {function: 'CURRENT_TIMESTAMP'},
    },
    timezone: {
      takes: {'timezone': 'string'},
      returns: 'timestamp',
      impl: {function: 'CURRENT_TIMESTAMP'},
    },
  },
  'local_timestamp': {
    takes: {},
    returns: 'timestamp',
    impl: {function: 'CURRENT_DATETIME'},
  },
  'current_datetime': {
    default_timezone: {
      takes: {},
      returns: 'timestamp',
      impl: {function: 'CURRENT_DATETIME'},
    },
    timezone: {
      takes: {'timezone': 'string'},
      returns: 'timestamp',
      impl: {function: 'CURRENT_DATETIME'},
    },
  },
}

