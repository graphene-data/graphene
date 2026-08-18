import type {FunctionDef} from './functionTypes.ts'
import type {Overload} from './functions.ts'

import {inferTimeOrdinal, inferGrain} from './temporalMetadata.ts'
import {scalarType, type TypeKind} from './types.ts'
import {trimIndentation} from './util.ts'

const trim = trimIndentation
const click = 'https://clickhouse.com/docs/en/sql-reference'
const jsonDocs = `${click}/functions/json-functions`

// Defines a ClickHouse JSON function while preserving its native mixed-case SQL spelling.
function jsonFunction(sqlName: string, signature: string, args: FunctionDef['args'], returns: string, summary: string, opts: Partial<FunctionDef> = {}): FunctionDef {
  return {
    name: sqlName.toLowerCase(),
    description: trim(`
      ${signature}

      ${summary}
    `),
    url: `${jsonDocs}#${sqlName}`,
    args,
    returns,
    sqlName,
    ...opts,
  }
}

const jsonString: FunctionDef['args'][number] = {name: 'json', type: ['json', 'string']}
const jsonPathOverloads: NonNullable<FunctionDef['overloads']> = [
  {args: [jsonString], returns: 'json'},
  {args: [jsonString, {name: 'indices_or_keys', type: 'any...'}], returns: 'json'},
]

// ClickHouse's path extractors all accept a JSON value followed by zero or more string keys or integer indexes.
function jsonPathFunction(sqlName: string, returns: string, summary: string): FunctionDef {
  return jsonFunction(sqlName, `${sqlName}(json[, indices_or_keys, ...])`, [jsonString], returns, summary, {
    overloads: jsonPathOverloads.map(overload => ({...overload, returns})),
  })
}

const clickHouseJsonFunctions: FunctionDef[] = [
  jsonFunction('JSONAllPaths', 'JSONAllPaths(json)', [{name: 'json', type: 'json'}], 'array<string>', 'Returns every path stored in a row of a JSON column.'),
  jsonFunction('JSONAllPathsWithTypes', 'JSONAllPathsWithTypes(json)', [{name: 'json', type: 'json'}], 'map', 'Returns every stored JSON path and its ClickHouse data type.'),
  jsonFunction('JSONAllValues', 'JSONAllValues(json)', [{name: 'json', type: 'json'}], 'array<string>', 'Returns all values in a JSON row as strings, ordered by path.'),
  jsonFunction('JSONArrayLength', 'JSONArrayLength(json)', [jsonString], 'number', 'Returns the number of elements in the outermost JSON array.', {aliases: ['json_array_length']}),
  jsonFunction('JSONDynamicPaths', 'JSONDynamicPaths(json)', [{name: 'json', type: 'json'}], 'array<string>', 'Returns JSON paths stored as dynamic subcolumns.'),
  jsonFunction('JSONDynamicPathsWithTypes', 'JSONDynamicPathsWithTypes(json)', [{name: 'json', type: 'json'}], 'map', 'Returns dynamic JSON paths and their ClickHouse data types.'),
  jsonFunction('JSONExtract', 'JSONExtract(json[, indices_or_keys, ...], return_type)', [jsonString, {name: 'argument', type: 'any'}, {name: 'arguments', type: 'any...'}], 'json', 'Extracts a JSON value using the requested ClickHouse return type.'),
  jsonPathFunction('JSONExtractArrayRaw', 'array<string>', 'Returns JSON array elements as unparsed strings.'),
  jsonPathFunction('JSONExtractArrayRawCaseInsensitive', 'array<string>', 'Returns JSON array elements as unparsed strings using case-insensitive key matching.'),
  jsonPathFunction('JSONExtractBool', 'boolean', 'Extracts a boolean value from JSON.'),
  jsonPathFunction('JSONExtractBoolCaseInsensitive', 'boolean', 'Extracts a boolean value using case-insensitive key matching.'),
  jsonFunction('JSONExtractCaseInsensitive', 'JSONExtractCaseInsensitive(json[, indices_or_keys, ...], return_type)', [jsonString, {name: 'argument', type: 'any'}, {name: 'arguments', type: 'any...'}], 'json', 'Extracts a value of the requested ClickHouse type using case-insensitive key matching.'),
  jsonPathFunction('JSONExtractFloat', 'number', 'Extracts a floating-point value from JSON.'),
  jsonPathFunction('JSONExtractFloatCaseInsensitive', 'number', 'Extracts a floating-point value using case-insensitive key matching.'),
  jsonPathFunction('JSONExtractInt', 'number', 'Extracts a signed integer value from JSON.'),
  jsonPathFunction('JSONExtractIntCaseInsensitive', 'number', 'Extracts a signed integer value using case-insensitive key matching.'),
  jsonPathFunction('JSONExtractKeys', 'array<string>', 'Returns the keys of a JSON object.'),
  jsonFunction('JSONExtractKeysAndValues', 'JSONExtractKeysAndValues(json[, indices_or_keys, ...], value_type)', [jsonString, {name: 'argument', type: 'any'}, {name: 'arguments', type: 'any...'}], 'array', 'Extracts JSON object keys and values using the requested ClickHouse value type.'),
  jsonFunction('JSONExtractKeysAndValuesCaseInsensitive', 'JSONExtractKeysAndValuesCaseInsensitive(json[, indices_or_keys, ...], value_type)', [jsonString, {name: 'argument', type: 'any'}, {name: 'arguments', type: 'any...'}], 'array', 'Extracts object keys and typed values using case-insensitive key matching.'),
  jsonPathFunction('JSONExtractKeysAndValuesRaw', 'array', 'Returns JSON object keys and unparsed values.'),
  jsonPathFunction('JSONExtractKeysAndValuesRawCaseInsensitive', 'array', 'Returns object keys and unparsed values using case-insensitive key matching.'),
  jsonPathFunction('JSONExtractKeysCaseInsensitive', 'array<string>', 'Returns JSON object keys after navigating with case-insensitive key matching.'),
  jsonPathFunction('JSONExtractRaw', 'string', 'Returns part of a JSON document as an unparsed string.'),
  jsonPathFunction('JSONExtractRawCaseInsensitive', 'string', 'Returns part of a JSON document as an unparsed string using case-insensitive key matching.'),
  jsonPathFunction('JSONExtractString', 'string', 'Extracts a string value from JSON.'),
  jsonPathFunction('JSONExtractStringCaseInsensitive', 'string', 'Extracts a string value using case-insensitive key matching.'),
  jsonPathFunction('JSONExtractUInt', 'number', 'Extracts an unsigned integer value from JSON.'),
  jsonPathFunction('JSONExtractUIntCaseInsensitive', 'number', 'Extracts an unsigned integer value using case-insensitive key matching.'),
  jsonPathFunction('JSONHas', 'boolean', 'Returns whether a value exists at the requested JSON path.'),
  jsonPathFunction('JSONKey', 'string', 'Returns a JSON object field key by its one-based index.'),
  jsonPathFunction('JSONLength', 'number', 'Returns the length of a JSON array or object.'),
  jsonFunction('JSONMergePatch', 'JSONMergePatch(json1[, json2, ...])', [{name: 'json', type: 'string...'}], 'string', 'Merges JSON object strings using JSON Merge Patch semantics.', {aliases: ['jsonmergepatch']}),
  jsonFunction('JSONSharedDataPaths', 'JSONSharedDataPaths(json)', [{name: 'json', type: 'json'}], 'array<string>', 'Returns paths stored in the shared data structure of a JSON column.'),
  jsonFunction('JSONSharedDataPathsWithTypes', 'JSONSharedDataPathsWithTypes(json)', [{name: 'json', type: 'json'}], 'map', 'Returns shared-data JSON paths and their ClickHouse data types.'),
  jsonPathFunction('JSONType', 'string', 'Returns the ClickHouse type name of a JSON value.'),
  jsonFunction('JSON_EXISTS', 'JSON_EXISTS(json, path)', [jsonString, {name: 'path', type: 'string'}], 'boolean', 'Returns whether a SQL/JSON path exists in a JSON document.'),
  jsonFunction('JSON_QUERY', 'JSON_QUERY(json, path)', [jsonString, {name: 'path', type: 'string'}], 'string', 'Extracts a JSON array or object using a SQL/JSON path.'),
  jsonFunction('JSON_VALUE', 'JSON_VALUE(json, path)', [jsonString, {name: 'path', type: 'string'}], 'string', 'Extracts a scalar value using a SQL/JSON path.'),
  jsonFunction('dynamicElement', 'dynamicElement(dynamic, type_name)', [{name: 'dynamic', type: 'any'}, {name: 'type_name', type: 'string'}], 'json', 'Extracts values of the requested type from a Dynamic column.'),
  jsonFunction('dynamicType', 'dynamicType(dynamic)', [{name: 'dynamic', type: 'any'}], 'string', 'Returns the variant type name for values in a Dynamic column.'),
  jsonFunction('isDynamicElementInSharedData', 'isDynamicElementInSharedData(dynamic)', [{name: 'dynamic', type: 'any'}], 'boolean', 'Returns whether a Dynamic value uses shared variant storage.'),
  jsonFunction('isValidJSON', 'isValidJSON(json)', [jsonString], 'boolean', 'Returns whether a string contains valid JSON.'),
  jsonFunction('prettyPrintJSON', 'prettyPrintJSON(json[, indent])', [jsonString, {name: 'indent', type: 'number?'}], 'string', 'Formats JSON with newlines and indentation.'),
  jsonFunction('simpleJSONExtractBool', 'simpleJSONExtractBool(json, field_name)', [jsonString, {name: 'field_name', type: 'string'}], 'boolean', 'Extracts a top-level boolean field with ClickHouse\'s fast simple JSON parser.', {aliases: ['visitparamextractbool']}),
  jsonFunction('simpleJSONExtractFloat', 'simpleJSONExtractFloat(json, field_name)', [jsonString, {name: 'field_name', type: 'string'}], 'number', 'Extracts a top-level floating-point field with the simple JSON parser.', {aliases: ['visitparamextractfloat']}),
  jsonFunction('simpleJSONExtractInt', 'simpleJSONExtractInt(json, field_name)', [jsonString, {name: 'field_name', type: 'string'}], 'number', 'Extracts a top-level signed integer field with the simple JSON parser.', {aliases: ['visitparamextractint']}),
  jsonFunction('simpleJSONExtractRaw', 'simpleJSONExtractRaw(json, field_name)', [jsonString, {name: 'field_name', type: 'string'}], 'string', 'Returns a top-level field as an unparsed string using the simple JSON parser.', {aliases: ['visitparamextractraw']}),
  jsonFunction('simpleJSONExtractString', 'simpleJSONExtractString(json, field_name)', [jsonString, {name: 'field_name', type: 'string'}], 'string', 'Extracts a top-level string field with the simple JSON parser.', {aliases: ['visitparamextractstring']}),
  jsonFunction('simpleJSONExtractUInt', 'simpleJSONExtractUInt(json, field_name)', [jsonString, {name: 'field_name', type: 'string'}], 'number', 'Extracts a top-level unsigned integer field with the simple JSON parser.', {aliases: ['visitparamextractuint']}),
  jsonFunction('simpleJSONHas', 'simpleJSONHas(json, field_name)', [jsonString, {name: 'field_name', type: 'string'}], 'boolean', 'Returns whether a top-level field exists using the simple JSON parser.', {aliases: ['visitparamhas']}),
  jsonFunction('toJSONString', 'toJSONString(value)', [{name: 'value', type: 'any'}], 'string', 'Serializes a value to its JSON representation.'),
]

const dateArithmeticUnits = [
  {name: 'Days', returns: 'T'},
  {name: 'Hours', returns: 'timestamp'},
  {name: 'Microseconds', returns: 'timestamp'},
  {name: 'Milliseconds', returns: 'timestamp'},
  {name: 'Minutes', returns: 'timestamp'},
  {name: 'Months', returns: 'T'},
  {name: 'Nanoseconds', returns: 'timestamp'},
  {name: 'Quarters', returns: 'T'},
  {name: 'Seconds', returns: 'timestamp'},
  {name: 'Weeks', returns: 'T'},
  {name: 'Years', returns: 'T'},
] satisfies {name: string; returns: string}[]

// Builds ClickHouse's addDays/subtractDays family of fixed-unit date arithmetic functions.
function dateArithmeticFunctions(prefix: 'add' | 'subtract'): FunctionDef[] {
  return dateArithmeticUnits.map(unit => {
    let sqlName = `${prefix}${unit.name}`
    let lowerUnit = unit.name.toLowerCase()
    return {
      name: sqlName.toLowerCase(),
      description: trim(`
        ${sqlName}(datetime, num)

        ${prefix == 'add' ? 'Adds' : 'Subtracts'} the specified number of ${lowerUnit} ${prefix == 'add' ? 'to' : 'from'} a date or timestamp.
      `),
      url: `${click}/functions/date-time-functions#${sqlName.toLowerCase()}`,
      args: [
        {name: 'datetime', type: ['date', 'timestamp']},
        {name: 'num', type: 'number'},
      ],
      returns: unit.returns,
      sqlName,
      aliases: [`${prefix}_${lowerUnit}`],
    }
  })
}

// Defines compact entries for native functions whose SQL is a direct function call.
function nativeFunction(sqlName: string, docs: string, args: FunctionDef['args'], returns: string, summary: string, opts: Partial<FunctionDef> = {}): FunctionDef {
  return {
    name: sqlName.toLowerCase(),
    description: `${sqlName}()\n\n${summary}`,
    url: `${click}/functions/${docs}#${sqlName.toLowerCase()}`,
    args,
    returns,
    sqlName,
    ...opts,
  }
}

function snakeCaseFunctionName(name: string) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

// Defines ClickHouse's numeric conversion family, whose failure variants have distinct argument contracts but share a numeric result.
function numericConversionFamily(target: string): FunctionDef[] {
  let conversion = (suffix: string, args: FunctionDef['args'], summary: string) => {
    let sqlName = `to${target}${suffix}`
    return nativeFunction(sqlName, 'type-conversion-functions', args, 'number', summary, {aliases: [snakeCaseFunctionName(sqlName)]})
  }
  return [
    conversion('', [{name: 'value', type: 'any'}], `Converts a numeric value or numeric string to ${target}.`),
    conversion('OrZero', [{name: 'value', type: 'string'}], `Converts a string to ${target}, returning zero when parsing fails.`),
    conversion('OrNull', [{name: 'value', type: 'string'}], `Converts a string to ${target}, returning null when parsing fails.`),
    conversion('OrDefault', [{name: 'value', type: 'any'}, {name: 'default', type: 'number?'}], `Converts a value to ${target}, returning an optional default when parsing fails.`),
  ]
}

// Decimal conversions additionally require a scale before the optional failure default.
function decimalConversionFamily(bits: number): FunctionDef[] {
  let target = `Decimal${bits}`
  let conversion = (suffix: string, args: FunctionDef['args'], summary: string) => {
    let sqlName = `to${target}${suffix}`
    return nativeFunction(sqlName, 'type-conversion-functions', args, 'number', summary, {aliases: [snakeCaseFunctionName(sqlName)]})
  }
  return [
    conversion('', [{name: 'value', type: 'any'}, {name: 'scale', type: 'number'}], `Converts a value to ${target} with the requested scale.`),
    conversion('OrZero', [{name: 'value', type: 'string'}, {name: 'scale', type: 'number'}], `Converts a string to ${target}, returning zero when parsing fails.`),
    conversion('OrNull', [{name: 'value', type: 'string'}, {name: 'scale', type: 'number'}], `Converts a string to ${target}, returning null when parsing fails.`),
    conversion('OrDefault', [{name: 'value', type: 'string'}, {name: 'scale', type: 'number'}, {name: 'default', type: 'number?'}], `Converts a string to ${target}, returning an optional default when parsing fails.`),
  ]
}

const clickHouseCombinators = ['SimpleState', 'OrDefault', 'Distinct', 'ForEach', 'ArgMax', 'ArgMin', 'OrNull', 'Array', 'Tuple', 'State', 'Merge', 'Map', 'If'] as const
const clickHouseAnyTypes: TypeKind[] = ['string', 'number', 'boolean', 'date', 'time', 'timestamp', 'json', 'interval', 'record', 'map', 'array', 'sql native']

// ClickHouse builds aggregate variants by recursively appending combinator suffixes instead of registering every resulting function name.
export function findClickHouseCombinatorOverloads(name: string, map: Record<string, Overload[]>): Overload[] {
  let direct = map[name]
  if (direct) return direct

  for (let suffix of clickHouseCombinators) {
    if (!name.endsWith(suffix.toLowerCase())) continue
    let nestedName = name.slice(0, -suffix.length)
    let nested = findClickHouseCombinatorOverloads(nestedName, map).filter(overload => overload.returnType.expressionType == 'aggregate')
    if (nested.length) return nested.map(overload => applyClickHouseCombinator(overload, suffix, overload.sqlName || nestedName))
  }
  return []
}

// Transforms the nested aggregate's signature while retaining the composed native SQL name.
function applyClickHouseCombinator(overload: Overload, suffix: typeof clickHouseCombinators[number], nestedSqlName: string): Overload {
  let transformed: Overload = {
    ...overload,
    params: overload.params.map(param => ({...param, allowedTypes: [...param.allowedTypes]})),
    returnType: {...overload.returnType},
    sqlName: `${nestedSqlName}${suffix}`,
  }
  let anyParam = (name: string) => ({name, allowedTypes: clickHouseAnyTypes.map(type => ({type}))})

  if (suffix == 'If') transformed.params.push({name: 'condition', allowedTypes: [{type: 'boolean'}]})
  if (suffix == 'ArgMax' || suffix == 'ArgMin') transformed.params.push(anyParam('key'))
  if (suffix == 'Array' || suffix == 'ForEach') transformed.params = transformed.params.map(param => ({...param, allowedTypes: [{type: 'array'}, {type: 'sql native'}]}))
  if (suffix == 'Map') transformed.params = transformed.params.map(param => ({...param, allowedTypes: [{type: 'map'}, {type: 'sql native'}]}))
  if (suffix == 'Tuple') transformed.params = transformed.params.map(param => ({...param, allowedTypes: [{type: 'record'}, {type: 'sql native'}]}))

  if (suffix == 'Array' && transformed.returnType.type == 'generic') transformed.returnType.type = 'array_element'
  if (suffix == 'ForEach') transformed.returnType.type = 'array'
  if (suffix == 'Map') transformed.returnType.type = scalarType('map')
  if (suffix == 'Tuple') transformed.returnType.type = scalarType('record')
  if (suffix == 'State' || suffix == 'SimpleState') transformed.returnType.type = scalarType('sql native')
  if (suffix == 'Merge') transformed.params = [anyParam('state')]
  if (suffix == 'Distinct') transformed.fanoutSafe = true
  return transformed
}

// ClickHouse functions with ordinary call syntax. Parameterized double calls, lambda calls, internals, and native median remain unsupported.
export const clickHouseFunctions: FunctionDef[] = [
  // ============================================================================
  // JSON and Dynamic Functions
  // https://clickhouse.com/docs/en/sql-reference/functions/json-functions
  // ============================================================================
  ...clickHouseJsonFunctions,

  // ============================================================================
  // Window Functions
  // ============================================================================
  {
    name: 'row_number',
    description: trim(`
      row_number()

      Numbers the current row within its window partition.
    `),
    url: `${click}/window-functions/row_number`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'rank',
    description: trim(`
      rank()

      Returns the rank of the current row with gaps for ties.
    `),
    url: `${click}/window-functions/rank`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'dense_rank',
    description: trim(`
      dense_rank()

      Returns the rank of the current row without gaps for ties.
    `),
    url: `${click}/window-functions/dense_rank`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'percent_rank',
    description: trim(`
      percent_rank()

      Returns the relative rank of the current row in the partition.
    `),
    url: `${click}/window-functions`,
    args: [],
    returns: 'number',
    window: true,
  },
  {
    name: 'lag',
    description: trim(`
      lag(expr, offset, default)

      Returns a previous value from the window partition.
    `),
    url: `${click}/window-functions/lag`,
    args: [
      {name: 'expr', type: 'T'},
      {name: 'offset', type: 'number?'},
      {name: 'default', type: 'T?'},
    ],
    returns: 'T',
    window: true,
  },
  {
    name: 'lead',
    description: trim(`
      lead(expr, offset, default)

      Returns a following value from the window partition.
    `),
    url: `${click}/window-functions/lead`,
    args: [
      {name: 'expr', type: 'T'},
      {name: 'offset', type: 'number?'},
      {name: 'default', type: 'T?'},
    ],
    returns: 'T',
    window: true,
  },
  {
    name: 'first_value',
    description: trim(`
      first_value(expr)

      Returns the first value in the window frame.
    `),
    url: `${click}/window-functions/first_value`,
    args: [{name: 'expr', type: 'T'}],
    returns: 'T',
    window: true,
  },
  {
    name: 'last_value',
    description: trim(`
      last_value(expr)

      Returns the last value in the window frame.
    `),
    url: `${click}/window-functions/last_value`,
    args: [{name: 'expr', type: 'T'}],
    returns: 'T',
    window: true,
  },
  {
    name: 'nth_value',
    description: trim(`
      nth_value(expr, nth)

      Returns the nth value in the window frame.
    `),
    url: `${click}/window-functions/nth_value`,
    args: [
      {name: 'expr', type: 'T'},
      {name: 'nth', type: 'number'},
    ],
    returns: 'T',
    window: true,
  },

  // ============================================================================
  // Aggregate Functions
  // ============================================================================
  nativeFunction('argMax', '../aggregate-functions/reference/argmax', [{name: 'arg', type: 'T'}, {name: 'value', type: 'any'}], 'T', 'Returns the arg value associated with the maximum value.', {aggregate: true}),
  nativeFunction('argMin', '../aggregate-functions/reference/argmin', [{name: 'arg', type: 'T'}, {name: 'value', type: 'any'}], 'T', 'Returns the arg value associated with the minimum value.', {aggregate: true}),
  nativeFunction('corr', '../aggregate-functions/reference/corr', [{name: 'x', type: 'number'}, {name: 'y', type: 'number'}], 'number', 'Computes the Pearson correlation coefficient.', {aggregate: true}),
  nativeFunction('covarPop', '../aggregate-functions/reference/covarpop', [{name: 'x', type: 'number'}, {name: 'y', type: 'number'}], 'number', 'Computes population covariance.', {aggregate: true, aliases: ['covar_pop']}),
  nativeFunction('covarSamp', '../aggregate-functions/reference/covarsamp', [{name: 'x', type: 'number'}, {name: 'y', type: 'number'}], 'number', 'Computes sample covariance.', {aggregate: true, aliases: ['covar_samp']}),
  nativeFunction('countDistinct', '../aggregate-functions/reference/count', [{name: 'values', type: 'any...'}], 'number', 'Counts distinct values using ClickHouse\'s configured implementation.', {aggregate: true, fanoutSafe: true}),
  nativeFunction('groupUniqArray', '../aggregate-functions/reference/groupuniqarray', [{name: 'arg', type: 'T'}], 'array', 'Collects distinct input values into an array.', {aggregate: true, aliases: ['group_uniq_array']}),
  nativeFunction('retention', '../aggregate-functions/parametric-functions', [{name: 'conditions', type: 'boolean...'}], 'array<number>', 'Computes retention flags for a sequence of conditions.', {aggregate: true}),
  nativeFunction('stddevPop', '../aggregate-functions/reference/stddevpop', [{name: 'arg', type: 'number'}], 'number', 'Computes population standard deviation.', {aggregate: true, aliases: ['stddev_pop']}),
  nativeFunction('stddevSamp', '../aggregate-functions/reference/stddevsamp', [{name: 'arg', type: 'number'}], 'number', 'Computes sample standard deviation.', {aggregate: true, aliases: ['stddev_samp']}),
  nativeFunction('uniqCombined', '../aggregate-functions/reference/uniqcombined', [{name: 'arg', type: 'any'}], 'number', 'Counts distinct values with the combined approximation algorithm.', {aggregate: true, fanoutSafe: true, aliases: ['uniq_combined']}),
  nativeFunction('uniqCombined64', '../aggregate-functions/reference/uniqcombined64', [{name: 'arg', type: 'any'}], 'number', 'Counts distinct values using 64-bit hashes and the combined approximation algorithm.', {aggregate: true, fanoutSafe: true, aliases: ['uniq_combined64']}),
  nativeFunction('varPop', '../aggregate-functions/reference/varpop', [{name: 'arg', type: 'number'}], 'number', 'Computes population variance.', {aggregate: true, aliases: ['var_pop']}),
  nativeFunction('varSamp', '../aggregate-functions/reference/varsamp', [{name: 'arg', type: 'number'}], 'number', 'Computes sample variance.', {aggregate: true, aliases: ['var_samp']}),
  {
    name: 'any',
    description: trim(`
      any(arg)

      Returns the first encountered value.
    `),
    url: `${click}/aggregate-functions/reference/any`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'T',
    aggregate: true,
  },
  {
    name: 'anylast',
    description: trim(`
      anyLast(arg)

      Returns the last encountered value.
    `),
    url: `${click}/aggregate-functions/reference/anylast`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'T',
    aggregate: true,
    sqlName: 'anyLast',
    aliases: ['any_last'],
  },
  {
    name: 'avg',
    description: trim(`
      avg(arg)

      Computes the arithmetic mean of the input values.
    `),
    url: `${click}/aggregate-functions/reference/avg`,
    args: [{name: 'arg', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'avgif',
    description: trim(`
      avgIf(arg, condition)

      Computes the average of values where the condition is true.
    `),
    url: `${click}/aggregate-functions/combinators`,
    args: [
      {name: 'arg', type: 'number'},
      {name: 'condition', type: 'boolean'},
    ],
    returns: 'number',
    aggregate: true,
    sqlName: 'avgIf',
    aliases: ['avg_if'],
  },
  {
    name: 'count',
    description: trim(`
      count(arg)

      Counts rows, or the non-null values of arg when an argument is provided.
    `),
    url: `${click}/aggregate-functions/reference/count`,
    args: [{name: 'arg', type: 'any?'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'countif',
    description: trim(`
      countIf(condition)

      Counts rows where the condition is true.
    `),
    url: `${click}/aggregate-functions/combinators`,
    args: [{name: 'condition', type: 'boolean'}],
    returns: 'number',
    aggregate: true,
    sqlName: 'countIf',
    aliases: ['count_if'],
  },
  {
    name: 'grouparray',
    description: trim(`
      groupArray(arg)

      Collects the input values into an array.
    `),
    url: `${click}/aggregate-functions/reference/grouparray`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'array',
    aggregate: true,
    sqlName: 'groupArray',
    aliases: ['group_array'],
  },
  {
    name: 'max',
    description: trim(`
      max(arg)

      Returns the maximum value of arg.
    `),
    url: `${click}/aggregate-functions/reference/max`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'maxif',
    description: trim(`
      maxIf(arg, condition)

      Returns the maximum value where the condition is true.
    `),
    url: `${click}/aggregate-functions/combinators`,
    args: [
      {name: 'arg', type: 'T'},
      {name: 'condition', type: 'boolean'},
    ],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
    sqlName: 'maxIf',
    aliases: ['max_if'],
  },
  {
    name: 'min',
    description: trim(`
      min(arg)

      Returns the minimum value of arg.
    `),
    url: `${click}/aggregate-functions/reference/min`,
    args: [{name: 'arg', type: 'T'}],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'minif',
    description: trim(`
      minIf(arg, condition)

      Returns the minimum value where the condition is true.
    `),
    url: `${click}/aggregate-functions/combinators`,
    args: [
      {name: 'arg', type: 'T'},
      {name: 'condition', type: 'boolean'},
    ],
    returns: 'T',
    aggregate: true,
    fanoutSafe: true,
    sqlName: 'minIf',
    aliases: ['min_if'],
  },
  {
    name: 'sum',
    description: trim(`
      sum(arg)

      Sums the numeric input values.
    `),
    url: `${click}/aggregate-functions/reference/sum`,
    args: [{name: 'arg', type: 'number'}],
    returns: 'number',
    aggregate: true,
  },
  {
    name: 'sumif',
    description: trim(`
      sumIf(arg, condition)

      Sums the values where the condition is true.
    `),
    url: `${click}/aggregate-functions/combinators`,
    args: [
      {name: 'arg', type: 'number'},
      {name: 'condition', type: 'boolean'},
    ],
    returns: 'number',
    aggregate: true,
    sqlName: 'sumIf',
    aliases: ['sum_if'],
  },
  {
    name: 'uniq',
    description: trim(`
      uniq(arg)

      Returns an approximate number of distinct values.
    `),
    url: `${click}/aggregate-functions/reference/uniq`,
    args: [{name: 'arg', type: 'any'}],
    returns: 'number',
    aggregate: true,
    fanoutSafe: true,
  },
  {
    name: 'uniqexact',
    description: trim(`
      uniqExact(arg)

      Returns the exact number of distinct values.
    `),
    url: `${click}/aggregate-functions/reference/uniqexact`,
    args: [{name: 'arg', type: 'any'}],
    returns: 'number',
    aggregate: true,
    fanoutSafe: true,
    sqlName: 'uniqExact',
    aliases: ['uniq_exact'],
  },

  // ============================================================================
  // Type Conversion Functions
  // ============================================================================
  ...['Int8', 'Int16', 'Int32', 'Int64', 'Int128', 'Int256', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'UInt128', 'UInt256', 'Float32', 'Float64'].flatMap(numericConversionFamily),
  ...[32, 64, 128, 256].flatMap(decimalConversionFamily),
  nativeFunction('toBFloat16', 'type-conversion-functions', [{name: 'value', type: 'any'}], 'number', 'Converts a numeric value or numeric string to BFloat16.', {aliases: ['to_bfloat16']}),
  nativeFunction('toBFloat16OrZero', 'type-conversion-functions', [{name: 'value', type: 'string'}], 'number', 'Converts a string to BFloat16, returning zero when parsing fails.', {aliases: ['to_bfloat16_or_zero']}),
  nativeFunction('toBFloat16OrNull', 'type-conversion-functions', [{name: 'value', type: 'string'}], 'number', 'Converts a string to BFloat16, returning null when parsing fails.', {aliases: ['to_bfloat16_or_null']}),

  // ============================================================================
  // Numeric Functions
  // ============================================================================
  nativeFunction('exp', 'math-functions', [{name: 'x', type: 'number'}], 'number', 'Returns e raised to x.'),
  nativeFunction('intDiv', 'arithmetic-functions', [{name: 'x', type: 'number'}, {name: 'y', type: 'number'}], 'number', 'Divides x by y and rounds down to an integer.', {aliases: ['int_div']}),
  nativeFunction('log', 'math-functions', [{name: 'x', type: 'number'}], 'number', 'Returns the natural logarithm of x.'),
  nativeFunction('log10', 'math-functions', [{name: 'x', type: 'number'}], 'number', 'Returns the base-10 logarithm of x.'),
  nativeFunction('log2', 'math-functions', [{name: 'x', type: 'number'}], 'number', 'Returns the base-2 logarithm of x.'),
  nativeFunction('sign', 'math-functions', [{name: 'x', type: 'number'}], 'number', 'Returns -1, 0, or 1 for the sign of x.'),
  {
    name: 'abs',
    description: trim(`
      abs(x)

      Returns the absolute value of x.
    `),
    url: `${click}/functions/arithmetic-functions#abs`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
  },
  {
    name: 'ceil',
    description: trim(`
      ceil(x)

      Rounds x up to the nearest integer.
    `),
    url: `${click}/functions/rounding-functions#ceil`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
  },
  {
    name: 'ceiling',
    description: trim(`
      ceiling(x)

      Alias for ceil(x).
    `),
    url: `${click}/functions/rounding-functions#ceil`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
    sqlName: 'ceiling',
  },
  {
    name: 'floor',
    description: trim(`
      floor(x)

      Rounds x down to the nearest integer.
    `),
    url: `${click}/functions/rounding-functions#floor`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
  },
  {
    name: 'greatest',
    description: trim(`
      greatest(x, ...)

      Returns the largest value from the argument list.
    `),
    url: `${click}/functions/conditional-functions#greatest`,
    args: [{name: 'values', type: 'T...'}],
    returns: 'T',
  },
  {
    name: 'least',
    description: trim(`
      least(x, ...)

      Returns the smallest value from the argument list.
    `),
    url: `${click}/functions/conditional-functions#least`,
    args: [{name: 'values', type: 'T...'}],
    returns: 'T',
  },
  {
    name: 'pow',
    description: trim(`
      pow(x, y)

      Raises x to the power y.
    `),
    url: `${click}/functions/math-functions#pow`,
    args: [
      {name: 'x', type: 'number'},
      {name: 'y', type: 'number'},
    ],
    returns: 'number',
  },
  {
    name: 'power',
    description: trim(`
      power(x, y)

      Raises x to the power y.
    `),
    url: `${click}/functions/math-functions#pow`,
    args: [
      {name: 'x', type: 'number'},
      {name: 'y', type: 'number'},
    ],
    returns: 'number',
  },
  {
    name: 'round',
    description: trim(`
      round(x, precision)

      Rounds x to the requested number of decimal places.
    `),
    url: `${click}/functions/rounding-functions#round`,
    args: [
      {name: 'x', type: 'number'},
      {name: 'precision', type: 'number?'},
    ],
    returns: 'number',
  },
  {
    name: 'sqrt',
    description: trim(`
      sqrt(x)

      Returns the square root of x.
    `),
    url: `${click}/functions/math-functions#sqrt`,
    args: [{name: 'x', type: 'number'}],
    returns: 'number',
  },

  // ============================================================================
  // Array, Map, and Tuple Functions
  // ============================================================================
  nativeFunction('arrayConcat', 'array-functions', [{name: 'arrays', type: 'array...'}], 'array', 'Concatenates arrays.', {aliases: ['array_concat']}),
  nativeFunction('arrayDistinct', 'array-functions', [{name: 'array', type: 'array'}], 'array', 'Returns the distinct values in an array.', {aliases: ['array_distinct']}),
  nativeFunction('arrayElement', 'array-functions', [{name: 'collection', type: ['array', 'map']}, {name: 'index_or_key', type: 'any'}], 'array_element', 'Returns an array element by index or a map value by key.', {aliases: ['array_element']}),
  nativeFunction('arrayElementOrNull', 'array-functions', [{name: 'array', type: 'array'}, {name: 'index', type: 'number'}], 'array_element', 'Returns an array element by index, or null when out of bounds.', {aliases: ['array_element_or_null']}),
  nativeFunction('arrayIntersect', 'array-functions', [{name: 'arrays', type: 'array...'}], 'array', 'Returns values shared by all input arrays.', {aliases: ['array_intersect']}),
  nativeFunction('arrayPopBack', 'array-functions', [{name: 'array', type: 'array'}], 'array', 'Removes the last array element.', {aliases: ['array_pop_back']}),
  nativeFunction('arrayPopFront', 'array-functions', [{name: 'array', type: 'array'}], 'array', 'Removes the first array element.', {aliases: ['array_pop_front']}),
  nativeFunction('arrayPushBack', 'array-functions', [{name: 'array', type: 'array'}, {name: 'value', type: 'any'}], 'array', 'Appends a value to an array.', {aliases: ['array_push_back']}),
  nativeFunction('arrayPushFront', 'array-functions', [{name: 'array', type: 'array'}, {name: 'value', type: 'any'}], 'array', 'Prepends a value to an array.', {aliases: ['array_push_front']}),
  nativeFunction('arrayResize', 'array-functions', [{name: 'array', type: 'array'}, {name: 'size', type: 'number'}, {name: 'extender', type: 'any?'}], 'array', 'Changes an array to the requested length.', {aliases: ['array_resize']}),
  nativeFunction('arrayReverse', 'array-functions', [{name: 'array', type: 'array'}], 'array', 'Reverses an array.', {aliases: ['array_reverse']}),
  nativeFunction('arrayShiftLeft', 'array-functions', [{name: 'array', type: 'array'}, {name: 'count', type: 'number'}, {name: 'default', type: 'any?'}], 'array', 'Shifts an array left by a number of positions.', {aliases: ['array_shift_left']}),
  nativeFunction('arrayShiftRight', 'array-functions', [{name: 'array', type: 'array'}, {name: 'count', type: 'number'}, {name: 'default', type: 'any?'}], 'array', 'Shifts an array right by a number of positions.', {aliases: ['array_shift_right']}),
  nativeFunction('arraySlice', 'array-functions', [{name: 'array', type: 'array'}, {name: 'offset', type: 'number'}, {name: 'length', type: 'number?'}], 'array', 'Returns a slice of an array.', {aliases: ['array_slice']}),
  nativeFunction('arraySort', 'array-functions', [{name: 'array', type: 'array'}], 'array', 'Sorts an array in ascending order.', {aliases: ['array_sort']}),
  nativeFunction('arrayUniq', 'array-functions', [{name: 'arrays', type: 'array...'}], 'number', 'Counts distinct array elements.', {aliases: ['array_uniq']}),
  nativeFunction('arrayZip', 'array-functions', [{name: 'arrays', type: 'array...'}], 'array<record>', 'Combines corresponding array elements into tuples.', {aliases: ['array_zip']}),
  nativeFunction('getSubcolumn', 'other-functions', [{name: 'value', type: 'any'}, {name: 'subcolumn', type: 'string'}], 'sql native', 'Extracts a named subcolumn from a nested value.', {aliases: ['get_subcolumn']}),
  nativeFunction('empty', 'array-functions', [{name: 'collection', type: ['array', 'map', 'string']}], 'boolean', 'Returns whether a collection or string is empty.'),
  nativeFunction('has', 'array-functions', [{name: 'array', type: 'array'}, {name: 'value', type: 'any'}], 'boolean', 'Returns whether an array contains a value.'),
  nativeFunction('indexOf', 'array-functions', [{name: 'array', type: 'array'}, {name: 'value', type: 'any'}], 'number', 'Returns the one-based position of a value in an array, or zero.', {aliases: ['index_of']}),
  nativeFunction('mapConcat', 'tuple-map-functions', [{name: 'maps', type: 'map...'}], 'map', 'Combines maps, keeping the first value for duplicate keys.', {aliases: ['map_concat']}),
  nativeFunction('mapContainsKey', 'tuple-map-functions', [{name: 'map', type: 'map'}, {name: 'key', type: 'any'}], 'boolean', 'Returns whether a map contains a key.', {aliases: ['mapcontains', 'map_contains', 'map_contains_key']}),
  nativeFunction('mapContainsKeyLike', 'tuple-map-functions', [{name: 'map', type: 'map'}, {name: 'pattern', type: 'string'}], 'boolean', 'Returns whether any string key matches a LIKE pattern.', {aliases: ['map_contains_key_like']}),
  nativeFunction('mapContainsValue', 'tuple-map-functions', [{name: 'map', type: 'map'}, {name: 'value', type: 'any'}], 'boolean', 'Returns whether a map contains a value.', {aliases: ['map_contains_value']}),
  nativeFunction('mapExtractKeyLike', 'tuple-map-functions', [{name: 'map', type: 'map'}, {name: 'pattern', type: 'string'}], 'map', 'Returns map entries whose string keys match a LIKE pattern.', {aliases: ['map_extract_key_like']}),
  nativeFunction('mapKeys', 'tuple-map-functions', [{name: 'map', type: 'map'}], 'array<sql native>', 'Returns the keys of a map.', {aliases: ['map_keys']}),
  nativeFunction('mapValues', 'tuple-map-functions', [{name: 'map', type: 'map'}], 'array<sql native>', 'Returns the values of a map.', {aliases: ['map_values']}),
  nativeFunction('notEmpty', 'array-functions', [{name: 'collection', type: ['array', 'map', 'string']}], 'boolean', 'Returns whether a collection or string is non-empty.', {aliases: ['not_empty']}),
  nativeFunction('tupleElement', 'tuple-functions', [{name: 'tuple', type: 'any'}, {name: 'index_or_name', type: ['number', 'string']}], 'T', 'Returns a tuple element by one-based index or name.', {aliases: ['tuple_element']}),

  // ============================================================================
  // String, URL, Hash, and Random Functions
  // ============================================================================
  nativeFunction('splitByString', 'splitting-merging-functions', [{name: 'separator', type: 'string'}, {name: 'string', type: 'string'}], 'array<string>', 'Splits a string using a multi-character separator.', {aliases: ['split_by_string']}),
  nativeFunction('replaceRegexpAll', 'string-replace-functions', [{name: 'string', type: 'string'}, {name: 'pattern', type: 'string'}, {name: 'replacement', type: 'string'}], 'string', 'Replaces every regular-expression match.', {aliases: ['replace_regexp_all']}),
  nativeFunction('reverse', 'string-functions', [{name: 'value', type: ['string', 'array']}], 'T', 'Reverses a string by bytes or reverses an array.'),
  nativeFunction('domain', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts the hostname from a URL.'),
  nativeFunction('domainWithoutWWW', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts the hostname and removes a leading www.', {aliases: ['domain_without_www']}),
  nativeFunction('extractURLParameter', 'url-functions', [{name: 'url', type: 'string'}, {name: 'name', type: 'string'}], 'string', 'Extracts a named URL query parameter.', {aliases: ['extract_url_parameter']}),
  nativeFunction('extractURLParameterNames', 'url-functions', [{name: 'url', type: 'string'}], 'array<string>', 'Returns URL query parameter names.', {aliases: ['extract_url_parameter_names']}),
  nativeFunction('fragment', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts a URL fragment.'),
  nativeFunction('path', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts a URL path without its query string.'),
  nativeFunction('protocol', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts a URL protocol.'),
  nativeFunction('queryString', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts a URL query string.', {aliases: ['query_string']}),
  nativeFunction('topLevelDomain', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts a URL top-level domain.', {aliases: ['top_level_domain']}),
  nativeFunction('cityHash64', 'hash-functions', [{name: 'values', type: 'any...'}], 'number', 'Computes a 64-bit CityHash.', {aliases: ['city_hash64']}),
  nativeFunction('farmFingerprint64', 'hash-functions', [{name: 'values', type: 'any...'}], 'number', 'Computes a stable 64-bit FarmHash fingerprint.', {aliases: ['farm_fingerprint64']}),
  nativeFunction('halfMD5', 'hash-functions', [{name: 'values', type: 'any...'}], 'number', 'Computes the first 8 bytes of an MD5 digest as an integer.', {aliases: ['half_md5']}),
  nativeFunction('BLAKE3', 'hash-functions', [{name: 'string', type: 'string'}], 'string', 'Computes a BLAKE3 digest.'),
  nativeFunction('MD4', 'hash-functions', [{name: 'string', type: 'string'}], 'string', 'Computes an MD4 digest.'),
  nativeFunction('MD5', 'hash-functions', [{name: 'string', type: 'string'}], 'string', 'Computes an MD5 digest.'),
  nativeFunction('RIPEMD160', 'hash-functions', [{name: 'string', type: 'string'}], 'string', 'Computes a RIPEMD-160 digest.'),
  nativeFunction('SHA1', 'hash-functions', [{name: 'string', type: 'string'}], 'string', 'Computes a SHA-1 digest.'),
  nativeFunction('SHA224', 'hash-functions', [{name: 'string', type: 'string'}], 'string', 'Computes a SHA-224 digest.'),
  nativeFunction('SHA256', 'hash-functions', [{name: 'string', type: 'string'}], 'string', 'Computes a SHA-256 digest.'),
  nativeFunction('SHA384', 'hash-functions', [{name: 'string', type: 'string'}], 'string', 'Computes a SHA-384 digest.'),
  nativeFunction('SHA512', 'hash-functions', [{name: 'string', type: 'string'}], 'string', 'Computes a SHA-512 digest.'),
  nativeFunction('sipHash64', 'hash-functions', [{name: 'values', type: 'any...'}], 'number', 'Computes a 64-bit SipHash.', {aliases: ['sip_hash64']}),
  nativeFunction('xxHash64', 'hash-functions', [{name: 'values', type: 'any...'}], 'number', 'Computes a 64-bit xxHash.', {aliases: ['xx_hash64']}),
  nativeFunction('rand', 'random-functions', [{name: 'ignored', type: 'any?'}], 'number', 'Returns a random 32-bit integer.'),
  nativeFunction('rand64', 'random-functions', [{name: 'ignored', type: 'any?'}], 'number', 'Returns a random 64-bit integer.'),
  nativeFunction('randCanonical', 'random-functions', [{name: 'ignored', type: 'any?'}], 'number', 'Returns a random floating-point value from zero through one.', {aliases: ['rand_canonical']}),

  {
    name: 'concat',
    description: trim(`
      concat(arg, ...)

      Concatenates the input strings.
    `),
    url: `${click}/functions/string-functions#concat`,
    args: [{name: 'values', type: 'string...'}],
    returns: 'string',
  },
  {
    name: 'endswith',
    description: trim(`
      endsWith(string, suffix)

      Returns true when string ends with suffix.
    `),
    url: `${click}/functions/string-functions#endswith`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'suffix', type: 'string'},
    ],
    returns: 'boolean',
    sqlName: 'endsWith',
    aliases: ['ends_with'],
  },
  {
    name: 'length',
    description: trim(`
      length(s)

      Returns the length of the string.
    `),
    url: `${click}/functions/string-functions#length`,
    args: [{name: 's', type: 'string'}],
    returns: 'number',
  },
  {
    name: 'lower',
    description: trim(`
      lower(s)

      Converts the string to lowercase.
    `),
    url: `${click}/functions/string-functions#lower`,
    args: [{name: 's', type: 'string'}],
    returns: 'string',
  },
  {
    name: 'match',
    description: trim(`
      match(string, pattern)

      Returns true when the string matches the regular expression.
    `),
    url: `${click}/functions/string-search-functions#match`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'pattern', type: 'string'},
    ],
    returns: 'boolean',
  },
  {
    name: 'position',
    description: trim(`
      position(string, substring)

      Returns the 1-based position of the substring.
    `),
    url: `${click}/functions/string-search-functions#position`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'substring', type: 'string'},
    ],
    returns: 'number',
  },
  {
    name: 'replace',
    description: trim(`
      replaceAll(string, pattern, replacement)

      Replaces every occurrence of pattern in string.
    `),
    url: `${click}/functions/string-replace-functions#replaceall`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'pattern', type: 'string'},
      {name: 'replacement', type: 'string'},
    ],
    returns: 'string',
    sqlName: 'replaceAll',
  },
  {
    name: 'splitbychar',
    description: trim(`
      splitByChar(sep, string)

      Splits the string by a single-character separator.
    `),
    url: `${click}/functions/splitting-merging-functions#splitbychar`,
    args: [
      {name: 'separator', type: 'string'},
      {name: 'string', type: 'string'},
    ],
    returns: 'array',
    sqlName: 'splitByChar',
    aliases: ['split_by_char'],
  },
  {
    name: 'startswith',
    description: trim(`
      startsWith(string, prefix)

      Returns true when string starts with prefix.
    `),
    url: `${click}/functions/string-functions#startswith`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'prefix', type: 'string'},
    ],
    returns: 'boolean',
    sqlName: 'startsWith',
    aliases: ['starts_with'],
  },
  {
    name: 'substring',
    description: trim(`
      substring(string, offset, length)

      Returns a substring starting at the requested position.
    `),
    url: `${click}/functions/string-functions#substring`,
    args: [
      {name: 'string', type: 'string'},
      {name: 'offset', type: 'number'},
      {name: 'length', type: 'number?'},
    ],
    returns: 'string',
  },
  {
    name: 'trim',
    description: trim(`
      trim(string)

      Removes leading and trailing whitespace.
    `),
    url: `${click}/functions/string-functions#trim`,
    args: [{name: 'string', type: 'string'}],
    returns: 'string',
  },
  {
    name: 'upper',
    description: trim(`
      upper(s)

      Converts the string to uppercase.
    `),
    url: `${click}/functions/string-functions#upper`,
    args: [{name: 's', type: 'string'}],
    returns: 'string',
  },

  // ============================================================================
  // Conditional and Null Functions
  // ============================================================================
  {
    name: 'coalesce',
    description: trim(`
      coalesce(expr, ...)

      Returns the first non-null expression from the argument list.
    `),
    url: `${click}/functions/functions-for-nulls#coalesce`,
    args: [{name: 'expressions', type: 'T...'}],
    returns: 'T',
  },
  {
    name: 'if',
    description: trim(`
      if(condition, then, else)

      Returns then when the condition is true, otherwise returns else.
    `),
    url: `${click}/functions/conditional-functions#if`,
    args: [
      {name: 'condition', type: 'boolean'},
      {name: 'then', type: 'T'},
      {name: 'else', type: 'T'},
    ],
    returns: 'T',
  },
  {
    name: 'ifnull',
    description: trim(`
      ifNull(x, alt)

      Returns x when it is not null, otherwise returns alt.
    `),
    url: `${click}/functions/functions-for-nulls#ifnull`,
    args: [
      {name: 'x', type: 'T'},
      {name: 'alt', type: 'T'},
    ],
    returns: 'T',
    sqlName: 'ifNull',
  },
  {
    name: 'multiif',
    description: trim(`
      multiIf(cond1, then1, cond2, then2, else)

      Evaluates the conditions in order and returns the matching branch.
    `),
    url: `${click}/functions/conditional-functions#multiif`,
    args: [{name: 'branches', type: 'T...'}],
    returns: 'T',
    sqlName: 'multiIf',
    aliases: ['multi_if'],
  },
  {
    name: 'nullif',
    description: trim(`
      nullIf(x, y)

      Returns null when x equals y, otherwise returns x.
    `),
    url: `${click}/functions/functions-for-nulls#nullif`,
    args: [
      {name: 'x', type: 'T'},
      {name: 'y', type: 'T'},
    ],
    returns: 'T',
    sqlName: 'nullIf',
  },

  // ============================================================================
  // Date and Time Functions
  // ============================================================================
  ...dateArithmeticFunctions('add'),
  ...dateArithmeticFunctions('subtract'),
  {
    name: 'current_date',
    description: trim(`
      current_date()

      Returns the current date.
    `),
    url: `${click}/functions/date-time-functions#current_date`,
    args: [],
    returns: 'date',
  },
  {
    name: 'current_timestamp',
    description: trim(`
      current_timestamp([timezone])

      Returns the current timestamp.
    `),
    url: `${click}/functions/date-time-functions#now`,
    args: [{name: 'timezone', type: 'string?'}],
    returns: 'timestamp',
  },
  {
    name: 'date_diff',
    description: trim(`
      date_diff(unit, start, end[, timezone])

      Returns the difference between two dates or timestamps in the requested unit.
    `),
    url: `${click}/functions/date-time-functions#date_diff`,
    args: [
      {name: 'unit', type: 'string'},
      {name: 'start', type: ['date', 'timestamp']},
      {name: 'end', type: ['date', 'timestamp']},
      {name: 'timezone', type: 'string?'},
    ],
    returns: 'number',
  },
  {
    name: 'date_trunc',
    description: trim(`
      date_trunc(unit, datetime[, timezone])

      Truncates a date or timestamp to the requested precision.
    `),
    url: `${click}/functions/date-time-functions#datetrunc`,
    args: [
      {name: 'date_part', type: 'string'},
      {name: 'datetime', type: ['date', 'timestamp']},
      {name: 'timezone', type: 'string?'},
    ],
    returns: 'timestamp',
    metadata: args => inferGrain(args[0]?.sql),
    sqlName: 'dateTrunc',
    aliases: ['datetrunc'],
  },
  {
    name: 'formatdatetime',
    description: trim(`
      formatDateTime(datetime, format[, timezone])

      Formats a date or timestamp as a string.
    `),
    url: `${click}/functions/date-time-functions#formatdatetime`,
    args: [
      {name: 'datetime', type: ['date', 'timestamp']},
      {name: 'format', type: 'string'},
      {name: 'timezone', type: 'string?'},
    ],
    returns: 'string',
    sqlName: 'formatDateTime',
    aliases: ['format_datetime'],
  },
  {
    name: 'now',
    description: trim(`
      now([timezone])

      Returns the current timestamp.
    `),
    url: `${click}/functions/date-time-functions#now`,
    args: [{name: 'timezone', type: 'string?'}],
    returns: 'timestamp',
  },
  {
    name: 'parsedatetimebesteffort',
    description: trim(`
      parseDateTimeBestEffort(text[, timezone])

      Parses a string into a timestamp using ClickHouse's best-effort parser.
    `),
    url: `${click}/functions/type-conversion-functions#parsedatetimebesteffort`,
    args: [
      {name: 'text', type: 'string'},
      {name: 'timezone', type: 'string?'},
    ],
    returns: 'timestamp',
    sqlName: 'parseDateTimeBestEffort',
    aliases: ['parse_datetime_best_effort'],
  },
  {
    name: 'today',
    description: trim(`
      today()

      Returns the current date.
    `),
    url: `${click}/functions/date-time-functions#today`,
    args: [],
    returns: 'date',
  },
  nativeFunction('fromUnixTimestamp', 'date-time-functions', [], 'timestamp', 'Converts Unix seconds to a timestamp.', {
    overloads: [
      {args: [{name: 'seconds', type: 'number'}], returns: 'timestamp'},
      {args: [{name: 'seconds', type: 'number'}, {name: 'format', type: 'string'}], returns: 'string'},
      {args: [{name: 'seconds', type: 'number'}, {name: 'format', type: 'string'}, {name: 'timezone', type: 'string'}], returns: 'string'},
    ],
    aliases: ['from_unix_timestamp'],
  }),
  nativeFunction('fromUnixTimestamp64Milli', 'type-conversion-functions', [{name: 'milliseconds', type: 'number'}, {name: 'timezone', type: 'string?'}], 'timestamp', 'Converts Unix milliseconds to a DateTime64 value.', {aliases: ['from_unix_timestamp64_milli']}),
  nativeFunction('toDateTime64', 'type-conversion-functions', [{name: 'value', type: ['string', 'date', 'timestamp', 'number']}, {name: 'precision', type: 'number'}, {name: 'timezone', type: 'string?'}], 'timestamp', 'Converts a value to a timestamp with the requested fractional precision.', {aliases: ['to_datetime64']}),
  nativeFunction('toString', 'type-conversion-functions', [{name: 'value', type: 'any'}], 'string', 'Converts a value to its text representation.', {
    overloads: [
      {args: [{name: 'value', type: 'any'}], returns: 'string'},
      {args: [{name: 'value', type: ['date', 'timestamp']}, {name: 'timezone', type: 'string'}], returns: 'string'},
    ],
    aliases: ['to_string'],
  }),
  nativeFunction('toTypeName', 'other-functions', [{name: 'value', type: 'any'}], 'string', 'Returns the ClickHouse type name of a value.', {aliases: ['to_type_name']}),
  nativeFunction('toUnixTimestamp', 'date-time-functions', [{name: 'value', type: ['string', 'date', 'timestamp']}, {name: 'timezone', type: 'string?'}], 'number', 'Converts a date or timestamp to Unix seconds.', {aliases: ['to_unix_timestamp']}),
  nativeFunction('toUnixTimestamp64Micro', 'type-conversion-functions', [{name: 'timestamp', type: 'timestamp'}], 'number', 'Converts a timestamp to Unix microseconds.', {aliases: ['to_unix_timestamp64_micro']}),
  nativeFunction('toUnixTimestamp64Milli', 'type-conversion-functions', [{name: 'timestamp', type: 'timestamp'}], 'number', 'Converts a timestamp to Unix milliseconds.', {aliases: ['to_unix_timestamp64_milli']}),
  nativeFunction('toUnixTimestamp64Nano', 'type-conversion-functions', [{name: 'timestamp', type: 'timestamp'}], 'number', 'Converts a timestamp to Unix nanoseconds.', {aliases: ['to_unix_timestamp64_nano']}),
  nativeFunction('toUnixTimestamp64Second', 'type-conversion-functions', [{name: 'timestamp', type: 'timestamp'}], 'number', 'Converts a timestamp to Unix seconds.', {aliases: ['to_unix_timestamp64_second']}),
  {
    name: 'todate',
    description: trim(`
      toDate(value[, timezone])

      Converts the value to a date.
    `),
    url: `${click}/functions/type-conversion-functions#todate`,
    args: [
      {name: 'value', type: ['string', 'date', 'timestamp', 'number']},
      {name: 'timezone', type: 'string?'},
    ],
    returns: 'date',
    sqlName: 'toDate',
    aliases: ['to_date'],
  },
  {
    name: 'todatetime',
    description: trim(`
      toDateTime(value[, timezone])

      Converts the value to a timestamp.
    `),
    url: `${click}/functions/type-conversion-functions#todatetime`,
    args: [
      {name: 'value', type: ['string', 'date', 'timestamp', 'number']},
      {name: 'timezone', type: 'string?'},
    ],
    returns: 'timestamp',
    sqlName: 'toDateTime',
    aliases: ['to_datetime'],
  },
  {
    name: 'todayofmonth',
    description: trim(`
      toDayOfMonth(datetime)

      Extracts the day of the month.
    `),
    url: `${click}/functions/date-time-functions#todayofmonth`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('day', 'clickhouse'),
    sqlName: 'toDayOfMonth',
    aliases: ['to_day_of_month'],
  },
  {
    name: 'todayofyear',
    description: trim(`
      toDayOfYear(datetime)

      Extracts the day of the year.
    `),
    url: `${click}/functions/date-time-functions#todayofyear`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('dayofyear', 'clickhouse'),
    sqlName: 'toDayOfYear',
    aliases: ['to_day_of_year'],
  },
  {
    name: 'todayofweek',
    description: trim(`
      toDayOfWeek(datetime[, mode[, timezone]])

      Extracts the day of the week.
    `),
    url: `${click}/functions/date-time-functions#todayofweek`,
    args: [
      {name: 'datetime', type: ['date', 'timestamp']},
      {name: 'mode', type: 'number?'},
      {name: 'timezone', type: 'string?'},
    ],
    returns: 'number',
    metadata: inferTimeOrdinal('dayofweek', 'clickhouse'),
    sqlName: 'toDayOfWeek',
    aliases: ['to_day_of_week'],
  },
  {
    name: 'tohour',
    description: trim(`
      toHour(datetime)

      Extracts the hour.
    `),
    url: `${click}/functions/date-time-functions#tohour`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('hour', 'clickhouse'),
    sqlName: 'toHour',
    aliases: ['to_hour'],
  },
  {
    name: 'tominute',
    description: trim(`
      toMinute(datetime)

      Extracts the minute.
    `),
    url: `${click}/functions/date-time-functions#tominute`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('minute', 'clickhouse'),
    sqlName: 'toMinute',
    aliases: ['to_minute'],
  },
  {
    name: 'tomonth',
    description: trim(`
      toMonth(datetime)

      Extracts the month number.
    `),
    url: `${click}/functions/date-time-functions#tomonth`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('month', 'clickhouse'),
    sqlName: 'toMonth',
    aliases: ['to_month'],
  },
  {
    name: 'toquarter',
    description: trim(`
      toQuarter(datetime)

      Extracts the quarter.
    `),
    url: `${click}/functions/date-time-functions#toquarter`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('quarter', 'clickhouse'),
    sqlName: 'toQuarter',
    aliases: ['to_quarter'],
  },
  {
    name: 'tosecond',
    description: trim(`
      toSecond(datetime)

      Extracts the second.
    `),
    url: `${click}/functions/date-time-functions#tosecond`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('second', 'clickhouse'),
    sqlName: 'toSecond',
    aliases: ['to_second'],
  },
  {
    name: 'toweek',
    description: trim(`
      toWeek(datetime[, mode[, timezone]])

      Extracts the week number.
    `),
    url: `${click}/functions/date-time-functions#toweek`,
    args: [
      {name: 'datetime', type: ['date', 'timestamp']},
      {name: 'mode', type: 'number?'},
      {name: 'timezone', type: 'string?'},
    ],
    returns: 'number',
    metadata: inferTimeOrdinal('week', 'clickhouse'),
    sqlName: 'toWeek',
    aliases: ['to_week'],
  },
  {
    name: 'tostartofday',
    description: trim(`
      toStartOfDay(datetime)

      Truncates to the start of the day.
    `),
    url: `${click}/functions/date-time-functions#tostartofday`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'timestamp',
    metadata: {timeGrain: 'day'},
    sqlName: 'toStartOfDay',
    aliases: ['to_start_of_day'],
  },
  {
    name: 'tostartofminute',
    description: trim(`
      toStartOfMinute(datetime)

      Truncates to the start of the minute.
    `),
    url: `${click}/functions/date-time-functions#tostartofminute`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'timestamp',
    metadata: {timeGrain: 'minute'},
    sqlName: 'toStartOfMinute',
    aliases: ['to_start_of_minute'],
  },
  {
    name: 'tostartofmonth',
    description: trim(`
      toStartOfMonth(datetime)

      Truncates to the start of the month.
    `),
    url: `${click}/functions/date-time-functions#tostartofmonth`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'timestamp',
    metadata: {timeGrain: 'month'},
    sqlName: 'toStartOfMonth',
    aliases: ['to_start_of_month'],
  },
  {
    name: 'tostartofquarter',
    description: trim(`
      toStartOfQuarter(datetime)

      Truncates to the start of the quarter.
    `),
    url: `${click}/functions/date-time-functions#tostartofquarter`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'timestamp',
    metadata: {timeGrain: 'quarter'},
    sqlName: 'toStartOfQuarter',
    aliases: ['to_start_of_quarter'],
  },
  {
    name: 'tostartofweek',
    description: trim(`
      toStartOfWeek(datetime[, mode[, timezone]])

      Truncates to the start of the week.
    `),
    url: `${click}/functions/date-time-functions#tostartofweek`,
    args: [
      {name: 'datetime', type: ['date', 'timestamp']},
      {name: 'mode', type: 'number?'},
      {name: 'timezone', type: 'string?'},
    ],
    returns: 'timestamp',
    metadata: {timeGrain: 'week'},
    sqlName: 'toStartOfWeek',
    aliases: ['to_start_of_week'],
  },
  {
    name: 'tostartofyear',
    description: trim(`
      toStartOfYear(datetime)

      Truncates to the start of the year.
    `),
    url: `${click}/functions/date-time-functions#tostartofyear`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'timestamp',
    metadata: {timeGrain: 'year'},
    sqlName: 'toStartOfYear',
    aliases: ['to_start_of_year'],
  },
  {
    name: 'toyear',
    description: trim(`
      toYear(datetime)

      Extracts the year number.
    `),
    url: `${click}/functions/date-time-functions#toyear`,
    args: [{name: 'datetime', type: ['date', 'timestamp']}],
    returns: 'number',
    metadata: inferTimeOrdinal('year', 'clickhouse'),
    sqlName: 'toYear',
    aliases: ['to_year'],
  },
]
