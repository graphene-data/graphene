// ClickHouse function catalog. Every entry is an ordinary `fn(args)` call described with Graphene's coarse
// types (number/string/record/map/array/sql native…); native subtypes (UInt64, FixedString(16), UUID, IPv6,
// Tuple(...)) collapse onto those. `nativeFunction` lowercases the gsql name and keeps the ClickHouse spelling
// in sqlName. Constant-ness, numeric domains, dictionary config and permissions are left to the server.
// Aggregate combinators (-If, -State, -Map, …) are synthesized on lookup by findClickHouseCombinatorOverloads.
// See the comment above `clickHouseFunctions` for which ClickHouse functions are deliberately not listed.
import type {FunctionDef} from './functionTypes.ts'
import type {Overload} from './functions.ts'

import {inferTimeOrdinal, inferGrain, inferDuration} from './temporalMetadata.ts'
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

// Snapshot alias_to additions live here, merged into compact and legacy definitions after construction.
// Inline aliases retain existing public spellings (Graphene conveniences and previously shipped native aliases);
// keep them stable, and add newly reconciled runtime aliases here rather than duplicating them inline.
const clickHouseAliases: Record<string, string[]> = {
  fqdn: ['fullhostname'], currentUser: ['user', 'current_user', 'session_user'], connectionId: ['connection_id'],
  tuplePlus: ['vectorsum'], tupleMinus: ['vectordifference'],
  quantileExactHigh: ['medianexacthigh'], quantileExactLow: ['medianexactlow'],
  formatReadableSize: ['format_bytes'], parseDateTimeOrNull: ['str_to_date'],
  IPv4NumToString: ['inet_ntoa'], IPv4StringToNum: ['inet_aton'], IPv6NumToString: ['inet6_ntoa'], IPv6StringToNum: ['inet6_aton'],
  base64Encode: ['to_base64'], base64Decode: ['from_base64'], lengthUTF8: ['char_length', 'character_length'],
  editDistance: ['levenshteindistance'], editDistanceUTF8: ['levenshteindistanceutf8'],
  leftPad: ['lpad'], rightPad: ['rpad'], trimLeft: ['ltrim'], trimRight: ['rtrim'],
  substringIndex: ['substring_index'], concatWithSeparator: ['concat_ws'], alphaTokens: ['splitbyalpha'],
  kostikConsistentHash: ['yandexconsistenthash'], extractKeyValuePairs: ['str_to_map', 'mapfromstring'],
  // Additional aliases from the complete 26.10.1.20 runtime, including aliases absent from generated docs.
  arrayFlatten: ['flatten'],
  groupBitAnd: ['bit_and'], groupBitOr: ['bit_or'], groupBitXor: ['bit_xor'],
  length: ['cardinality', 'octet_length'], currentDatabase: ['database', 'schema', 'current_database'],
  formatDateTime: ['date_format'], toDayOfMonth: ['day', 'dayofmonth'], toDayOfWeek: ['dayofweek'], toDayOfYear: ['dayofyear'],
  fromDaysSinceYearZero: ['from_days'], fromUnixTimestamp: ['from_unixtime'], toLastDayOfMonth: ['last_day'],
  toHour: ['hour'], toMinute: ['minute'], toMonth: ['month'], toQuarter: ['quarter'], toSecond: ['second'],
  toMicrosecond: ['microsecond'], toMillisecond: ['millisecond'], toNanosecond: ['nanosecond'],
  naturalSortKey: ['natural_sort_key'], match: ['regexp_matches'], replaceRegexpAll: ['regexp_replace'], regexpExtract: ['regexp_substr'],
  stddevPop: ['std'], stddevSamp: ['stddev'], MVTEncodeGeom: ['st_asmvtgeom'],
  readWKBLineString: ['st_linefromwkb'], readWKBMultiLineString: ['st_mlinefromwkb'], readWKBMultiPoint: ['st_mpointfromwkb'],
  readWKBMultiPolygon: ['st_mpolyfromwkb'], readWKBPoint: ['st_pointfromwkb'], readWKBPolygon: ['st_polyfromwkb'],
  toStartOfInterval: ['date_bin', 'time_bucket'], dateDiff: ['timestamp_diff', 'timestampdiff'], toDaysSinceYearZero: ['to_days'], parseDateTime: ['to_unixtime'], UTCTimestamp: ['utc_timestamp'],
  anyLast_respect_nulls: ['anylastrespectnulls', 'lastvaluerespectnulls', 'last_value_respect_nulls'],
  any_respect_nulls: ['anyrespectnulls', 'anyvaluerespectnulls', 'any_value_respect_nulls', 'firstvaluerespectnulls', 'first_value_respect_nulls'],
  any: ['any_value'], arrayROCAUC: ['arrayauc'], arrayAUCPR: ['arrayprauc'], groupArray: ['array_agg'], arrayRemove: ['array_remove'],
  arrayStringConcat: ['array_to_string'], authenticatedUser: ['authuser'], substring: ['byteslice', 'mid', 'substr'],
  multiIf: ['casewithoutexpr', 'casewithoutexpression'], today: ['curdate'], currentQueryID: ['current_query_id'],
  cosineDistance: ['distancecosine'], cosineDistanceTransposed: ['distancecosinetransposed'],
  L1Distance: ['distancel1'], L2Distance: ['distancel2'], L2SquaredDistance: ['distancel2squared'],
  L2DistanceTransposed: ['distancel2transposed'], LinfDistance: ['distancelinf'], LpDistance: ['distancelp'],
  fromUTCTimestamp: ['from_utc_timestamp'], groupConcat: ['group_concat', 'string_agg'],
  hasAllTokens: ['hasalltoken'], hasAnyTokens: ['hasanytoken'], initialQueryID: ['initial_query_id'], initialQueryStartTime: ['initial_query_start_time'],
  positionCaseInsensitive: ['instr'], isValidASCII: ['isascii'], lower: ['lcase'], log: ['ln'], now: ['localtimestamp'], hasPhrase: ['matchphrase'],
  argMax: ['max_by'], argMin: ['min_by'], quantileBFloat16: ['medianbfloat16'], byteHammingDistance: ['mismatches'],
  modulo: ['mod'], moduloOrNull: ['modornull'], L1Norm: ['norml1'], L2Norm: ['norml2'], L2SquaredNorm: ['norml2squared'],
  LinfNorm: ['normlinf'], LpNorm: ['normlp'], L1Normalize: ['normalizel1'], L2Normalize: ['normalizel2'],
  LinfNormalize: ['normalizelinf'], LpNormalize: ['normalizelp'], pgGetUserById: ['pg_get_userbyid'], pgTableIsVisible: ['pg_table_is_visible'],
  positiveModulo: ['pmod', 'positive_modulo'], positiveModuloOrNull: ['pmodornull', 'positive_modulo_or_null'],
  queryID: ['query_id'], rand: ['rand32'], regexpPosition: ['regexpinstr', 'regexp_instr'], removeDiacriticsUTF8: ['removeaccentsutf8'],
  dotProduct: ['scalarproduct'], dotProductTransposed: ['scalarproducttransposed'], timeSeriesIdToGroup: ['timeseriesidtotagsgroup'],
  timeSeriesGroupToTags: ['timeseriestagsgrouptotags'], toStartOfFiveMinutes: ['tostartoffiveminute'], toUTCTimestamp: ['to_utc_timestamp'],
  upper: ['ucase'], toWeek: ['week'], toYearWeek: ['yearweek'],
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

// Every name in the complete ClickHouse 26.10.1.20 runtime (system.functions, aliases included) is either listed
// below or has an explicit exclusion; lang.test.ts pins all 1,921 names and the per-name exclusion ledger.
// Resolution is not full overload support: results must fit the existing fixed, generic or container
// type-inference contracts. What is NOT listed, and why:
//
// Needs syntax gsql doesn't have:
// - Mandatory fn(parameters)(arguments): histogram, sequenceMatch/Count/MatchEvents/NextNode, windowFunnel,
//   sumMapFiltered(WithOverflow), exponentialMovingAverage, exponentialTimeDecayed*, groupArraySample/Sorted,
//   largestTriangleThreeBuckets, meanZTest, sparkbar, groupFormat, MVTEncode/ST_AsMVT, hierarchicalKMeans,
//   quantileGK/DD, every quantiles* variant, every timeSeries*ToGrid, and every -Resample combinator.
//   Aggregates whose parameters are optional (quantile*, topK, uniqUpTo, groupArrayMoving*, stochastic*Regression…)
//   ARE listed, but only with their default parameters.
// - Required lambdas: arrayMap/Filter/Fold, arrayFill/ReverseFill, arrayFirst/Last(Index/OrNull), arraySplit/ReverseSplit,
//   mapApply, mapFilter. Lambda-taking overloads of arraySort, arrayCount, arrayAll, arrayExists and map sorting are
//   also unavailable, but their ordinary forms are listed. mapAll/mapExists are different: their optional-lambda
//   documentation is misleading; the native map adapter supplies Array(Tuple), which the no-lambda UInt8 predicate
//   rejects. They require a lambda.
// - Reserved operator names (and, or, not, in, like, ilike) use operators or callable variants.
//   Soft keywords such as row/range/left/right remain ordinary callable identifiers in lang.grammar.
// - Row expansion, not scalar expressions: arrayJoin/unnest; historical untuple expands tuple columns. GROUPING is listed, but ROLLUP/CUBE/GROUPING SETS are not.
//
// Result type can't be expressed with the existing fixed, generic or container contracts (would need literal- or
// config-dependent inference, not new syntax):
// - Type chosen by a type-name string: CAST, accurateCast(OrNull/OrDefault), reinterpret, defaultValueOfTypeName, variantElement.
// - Type chosen by server config: dictGet(OrNull/OrDefault), joinGet(OrNull), getSetting(OrDefault),
//   getServerSetting, getMergeTreeSetting, globalVariable.
// - Type chosen by the aggregate inside a state or named by a string: finalizeAggregation, initializeAggregation,
//   runningAccumulate, arrayReduce.
// Known outer arrays with unknown elements use array<sql native>, not an exclusion or first-array inference:
// dictGetKeys, arrayReduceInRanges, arrayFlatten/flatten and ranked enumeration.
//
// Internal, not public SQL API: registry-marked planner helpers (_CAST, __*, caseWithExpression/caseWithExpr, nested,
// validateNestedArraySizes), *InIgnoreSet type-analysis variants, nothing/nothingNull/nothingUInt64 placeholder
// aggregates, and kql* lowering helpers (kqlDateTimeBinAt has a documented fixed-result contract and is listed).
// Historical/build-dependent catboostEvaluate also needs model-dependent result inference. It and
// untuple are absent from this baseline, so are not in its exclusion ledger. stringCompare was renamed compareSubstrings.
//
// Listed with a partial signature for the same reason (see each entry's summary): mapPopulateSeries (no two-array
// form), transform (no four-argument form), dictGetAll (single attribute only). tumble/hop Start/End expose
// only UInt32 boundaries: standalone DateTime is rejected natively; tuple and interval-based forms need
// Date-versus-timestamp result inference. Metadata can annotate results but cannot select their type.
// Other partial contracts: toStartOfInterval/date_bin/time_bucket require an explicit timestamp origin (no-origin
// month/year results are Date, unlike day/hour DateTime results); addDate/subDate and tuple-of-interval arithmetic
// expose timestamp inputs only. Numeric forms of plus/minus/midpoint/clamp/firstNonDefault/arrayWithConstant/
// icebergTruncate avoid same-arity argument-pair or second-argument result inference. Typed dictionary getters
// expose single attributes. Tag-group functions accept additional tags through their array/map containers.
export const clickHouseFunctions: FunctionDef[] = [
  // ============================================================================
  // JSON and Dynamic Functions
  // https://clickhouse.com/docs/en/sql-reference/functions/json-functions
  // ============================================================================
  ...clickHouseJsonFunctions,


  // ============================================================================
  // Server Context, Introspection, and Other Functions
  // ============================================================================

  // Server context and introspection.
  ...['hostName', 'fqdn', 'buildId', 'currentDatabase', 'currentUser', 'displayName', 'version'].map(name => nativeFunction(name, 'other-functions', [], 'string', `Returns the server ${name} value.`)),
  ...['blockNumber', 'blockSize', 'connectionId', 'filesystemAvailable', 'filesystemCapacity', 'filesystemUnreserved', 'revision', 'rowNumberInAllBlocks', 'rowNumberInBlock', 'transactionLatestSnapshot', 'transactionOldestSnapshot', 'uptime'].map(name => nativeFunction(name, 'other-functions', name.startsWith('filesystem') ? [['disk', 'string?']] : [], 'number', `Returns ${name} for the executing server, block or transaction. Filesystem calls optionally select a configured disk.`)),
  ...['currentProfiles', 'currentRoles', 'defaultProfiles', 'defaultRoles', 'enabledProfiles', 'enabledRoles'].map(name => nativeFunction(name, 'other-functions', [], 'array<string>', `Returns ${name} for the current user.`)),
  ...[['authenticatedUser', 'Returns the authenticated user.'], ['currentHandler', 'Returns the request handler name.'], ['currentQueryID', 'Returns the executing query ID.'], ['currentRequestURL', 'Returns the HTTP request URL.']].map(([name, summary]) => nativeFunction(name, 'other-functions', [], 'string', summary)),
  nativeFunction('digits', 'other-functions', [['value', 'number'], ['offset', 'number'], ['length', 'number?']], 'number', 'Extracts decimal digits of an integer as an unsigned integer.'),
  ...['colorOKLABToSRGB', 'colorSRGBToOKLAB'].map(name => nativeFunction(name, 'other-functions', [['color', 'record'], ['gamma', 'number?']], 'record', 'Converts an RGB/OKLAB three-component color tuple, with optional gamma.')),
  ...['fuzzQuery', 'parseQueryToJSON'].map(name => nativeFunction(name, 'other-functions', [['query', 'string']], 'string', name == 'fuzzQuery' ? 'Returns a fuzzed SQL query without executing it.' : 'Returns a SQL query AST as JSON without executing it.')),
  nativeFunction('formatQueryFromJSON', 'other-functions', [['json', 'string'], ['original_query', 'string?']], 'string', 'Formats a JSON SQL AST, optionally preserving original query formatting.'),
  ...['highlightQuery', 'tokenizeQuery'].map(name => nativeFunction(name, 'other-functions', [['query', 'string']], 'array<record>', 'Returns query token ranges as named (begin, end, type) tuples.')),
  nativeFunction('obfuscateQuery', 'other-functions', [['query', 'string'], ['tag', 'any?']], 'string', 'Obfuscates SQL identifiers and literals; the optional tag prevents common-subexpression reuse.'),
  nativeFunction('obfuscateQueryWithSeed', 'other-functions', [['query', 'string'], ['seed', ['number', 'string']]], 'string', 'Obfuscates SQL deterministically using a seed.'),
  nativeFunction('parseISO8601Duration', 'other-functions', [['duration', 'string']], 'number', 'Returns the number of seconds in an ISO 8601 duration.'),
  nativeFunction('generateSerialID', 'other-functions', [['series', 'string'], ['start_value', 'number?']], 'number', 'Allocates a serial number using ClickHouse Keeper; start_value applies only when the series is created.'),
  nativeFunction('icebergBucket', 'other-functions', [['buckets', 'number'], ['value', 'any']], 'number', 'Returns the Iceberg bucket number for a supported scalar value.'),
  nativeFunction('icebergTruncate', 'other-functions', [['width', 'number'], ['value', 'number']], 'number', 'Applies Iceberg truncation to a number. String forms need result inference from the second argument.'),
  nativeFunction('pgGetUserById', 'other-functions', [['oid', 'number']], 'string', 'Returns the current user for PostgreSQL compatibility; oid is ignored.'),
  nativeFunction('pgTableIsVisible', 'other-functions', [['oid', 'number']], 'boolean', 'Returns true for PostgreSQL compatibility; oid is ignored.'),
  nativeFunction('currentSchemas', 'other-functions', [['include_implicit', 'boolean']], 'array<string>', 'Returns the current database as a single-element array.', {aliases: ['current_schemas']}),
  nativeFunction('showCertificate', 'other-functions', [], 'map', 'Returns configured SSL certificate attributes.'),
  nativeFunction('transactionID', 'other-functions', [], 'record', 'Returns (start_csn, local_tid, host_id) for the current transaction.'),
  nativeFunction('hasThreadFuzzer', 'other-functions', [], 'boolean', 'Tests whether the thread fuzzer is enabled.'),
  ...['getClientHTTPHeader', 'getMacro', 'normalizeQuery', 'normalizeQueryKeepNames', 'formatQuery', 'formatQueryOrNull', 'formatQuerySingleLine', 'formatQuerySingleLineOrNull'].map(name => nativeFunction(name, 'other-functions', [['value', 'string']], 'string', `Evaluates ${name}; header/macro names are constant strings, query functions accept SQL text.`)),
  ...['getMaxTableNameLengthForDatabase', 'getServerPort', 'normalizedQueryHash', 'normalizedQueryHashKeepNames'].map(name => nativeFunction(name, 'other-functions', [['value', 'string']], 'number', `Returns ${name} for the supplied name or query text.`)),
  nativeFunction('errorCodeToName', 'other-functions', [['code', 'number']], 'string', 'Returns the symbolic name of an integer error code.'),
  ...['dumpColumnStructure', 'toColumnTypeName'].map(name => nativeFunction(name, 'other-functions', [['value', 'any']], 'string', 'Describes the internal column representation.')),
  ...['getSizeOfEnumType', 'lowCardinalityIndices', 'visibleWidth'].map(name => nativeFunction(name, 'other-functions', [['value', 'any']], 'number', `Returns ${name}; enum/cardinality functions require the corresponding native column type.`)),
  nativeFunction('getTypeSerializationStreams', 'other-functions', [['value', 'any']], 'array<string>', 'Returns serialization substream paths for a column or type-name string.'),
  ...[
    ['identity', 'Returns its argument unchanged.'], ['materialize', 'Turns a constant into a full column, preserving its logical type.'],
    ['defaultValueOfArgumentType', 'Returns the default value of the argument type.'], ['lowCardinalityKeys', 'Exposes native LowCardinality dictionary keys.'],
  ].map(([name, summary]) => nativeFunction(name, 'other-functions', [['value', 'T']], 'T', summary)),
  ...['byteSize', 'blockSerializedSize'].map(name => nativeFunction(name, 'other-functions', [['value', 'any'], ['rest', 'any...']], 'number', name == 'byteSize' ? 'Returns the in-memory byte size of the supplied values.' : 'Returns the serialized block byte size of the supplied values.')),
  ...['ignore', 'indexHint'].map(name => nativeFunction(name, 'other-functions', [], 'number', name == 'ignore' ? 'Accepts arbitrary expressions and returns zero.' : 'Supplies index hints and returns one without evaluating its arguments.', {overloads: [{args: [], returns: 'number'}, {args: [['values', 'any...']], returns: 'number'}]})),
  nativeFunction('partitionID', 'other-functions', [['value', 'any'], ['rest', 'any...']], 'string', 'Computes a partition identifier for the supplied values.'),
  nativeFunction('isConstant', 'other-functions', [['value', 'any']], 'boolean', 'Tests whether the expression is constant.'),
  nativeFunction('isDecimalOverflow', 'other-functions', [['value', 'number'], ['precision', 'number?']], 'boolean', 'Tests whether a native Decimal exceeds its own or the supplied precision.'),
  ...['sleep', 'sleepEachRow'].map(name => nativeFunction(name, 'other-functions', [['seconds', 'number']], 'number', 'Sleeps for the specified constant duration (at most three seconds), returning zero.')),
  nativeFunction('throwIf', 'other-functions', [['condition', ['number', 'boolean']], ['message', 'string?'], ['error_code', 'number?']], 'number', 'Throws when the condition is nonzero; otherwise returns zero. Message and error code must be constant.'),
  nativeFunction('bar', 'other-functions', [['value', 'number'], ['min', 'number'], ['max', 'number'], ['width', 'number?']], 'string', 'Draws a Unicode bar between constant bounds; width defaults to 80.'),
  nativeFunction('hasColumnInTable', 'other-functions', [['database_or_host', 'string'], ['table_or_user', 'string'], ['column_or_password', 'string'], ['database_or_table', 'string?'], ['table_or_column', 'string?'], ['column', 'string?']], 'boolean', 'Checks database/table/column locally, or prefixes host and optional username/password for remote checks.'),
  nativeFunction('generateRandomStructure', 'other-functions', [['columns', 'number?'], ['seed', 'number?']], 'string', 'Generates a random table schema; zero/null columns chooses a random count.'),
  ...['structureToCapnProtoSchema', 'structureToProtobufSchema'].map(name => nativeFunction(name, 'other-functions', [['structure', 'string'], ['root_name', 'string?']], 'string', 'Converts a constant SQL column schema to the named serialization schema; root name defaults to Message.')),
  ...['colorOKLCHToSRGB', 'colorSRGBToOKLCH'].map(name => nativeFunction(name, 'other-functions', [['color', 'record'], ['gamma', 'number?']], 'record', 'Converts a three-channel color tuple; gamma defaults to 2.2.')),
  nativeFunction('minSampleSizeConversion', 'other-functions', [['baseline', 'number'], ['mde', 'number'], ['power', 'number'], ['alpha', 'number']], 'record', 'Returns (minimum_sample_size, detect_range_lower, detect_range_upper) for conversion metrics.'),
  nativeFunction('minSampleSizeContinuous', 'other-functions', [['baseline', 'number'], ['sigma', 'number'], ['mde', 'number'], ['power', 'number'], ['alpha', 'number']], 'record', 'Returns sample size and detectable bounds for continuous metrics.', {aliases: ['minsamplesizecontinous']}),
  nativeFunction('neighbor', 'other-functions', [['value', 'T'], ['offset', 'number'], ['default', 'T?']], 'T', 'Returns a block-local neighbor value; deprecated and controlled by native settings.'),
  ...['runningDifference', 'runningDifferenceStartingWithFirstValue'].map(name => nativeFunction(name, 'other-functions', [['value', ['number', 'date', 'timestamp']]], 'number', 'Returns block-local consecutive differences; deprecated and controlled by native settings.')),
  nativeFunction('runningConcurrency', 'other-functions', [['start', ['date', 'timestamp']], ['end', ['date', 'timestamp']]], 'number', 'Counts concurrent intervals at each event start.'),
  nativeFunction('replicate', 'other-functions', [['value', 'any'], ['array', 'array']], 'array<sql native>', 'Repeats a value to match the length of an array; preserves nested values without flattening.'),
  nativeFunction('variantType', 'other-functions', [['variant', 'any']], 'string', 'Returns the native Variant alternative name as Enum8.'),
  ...['addressToLine', 'addressToSymbol'].map(name => nativeFunction(name, 'introspection', [['address', 'number']], 'string', 'Resolves a process instruction address; requires native introspection permission.')),
  nativeFunction('addressToLineWithInlines', 'introspection', [['address', 'number']], 'array<string>', 'Resolves source and inlined frames for an instruction address.'),
  nativeFunction('demangle', 'introspection', [['symbol', 'string']], 'string', 'Demangles a C++ symbol.'),
  nativeFunction('tid', 'introspection', [], 'number', 'Returns the executing thread ID.'),
  nativeFunction('logTrace', 'introspection', [['message', 'string']], 'number', 'Logs a trace message and returns zero.'),
  nativeFunction('mergeTreePartInfo', 'introspection', [['part', 'string']], 'record', 'Parses a MergeTree part name into a metadata tuple.'),
  nativeFunction('isMergeTreePartCoveredBy', 'introspection', [['nested', 'string'], ['covering', 'string']], 'boolean', 'Tests whether a MergeTree part covers another.'),
  ...['encrypt', 'decrypt', 'tryDecrypt'].map(name => nativeFunction(name, 'encryption-functions', [['mode', 'string'], ['text', 'string'], ['key', 'string'], ['iv', 'string?'], ['aad', 'string?']], 'string', 'Encrypts/decrypts bytes using the named AES mode; IV/AAD requirements depend on the mode. tryDecrypt returns null on decryption failure.')),
  ...['aes_encrypt_mysql', 'aes_decrypt_mysql'].map(name => nativeFunction(name, 'encryption-functions', [['mode', 'string'], ['text', 'string'], ['key', 'string'], ['iv', 'string?']], 'string', 'Uses MySQL-compatible AES key folding and IV handling.')),
  ...['detectCharset', 'detectLanguage', 'detectLanguageUnknown', 'detectProgrammingLanguage'].map(name => nativeFunction(name, 'nlp-functions', [['text', 'string']], 'string', `Returns ${name} for the text; requires the corresponding native NLP build support.`)),
  nativeFunction('detectLanguageMixed', 'nlp-functions', [['text', 'string']], 'map', 'Returns language codes and their proportions.'),
  nativeFunction('detectTonality', 'nlp-functions', [['text', 'string']], 'number', 'Returns average text sentiment.'),
  ...['stem', 'lemmatize'].map(name => nativeFunction(name, 'nlp-functions', [['language', 'string'], ['word', 'string']], 'string', name == 'stem' ? 'Stems a lowercase word using the named language.' : 'Lemmatizes a lowercase word using the named language.')),
  nativeFunction('synonyms', 'nlp-functions', [['extension', 'string'], ['word', 'string']], 'array<string>', 'Looks up synonyms in a configured extension.'),
  nativeFunction('file', 'files', [['path', 'string'], ['default', 'string?']], 'string', 'Reads bytes relative to user_files_path, optionally returning a default on failure.'),

  // Time-series tag groups are query-local UInt64 handles, not aggregate states.
  nativeFunction('timeSeriesCopyTag', 'time-series-functions', [['destination', 'number'], ['source', 'number'], ['tag', 'string']], 'number', 'Copies one tag between groups.'),
  nativeFunction('timeSeriesCopyTags', 'time-series-functions', [['destination', 'number'], ['source', 'number'], ['tags', 'array']], 'number', 'Copies named tags between groups.'),
  nativeFunction('timeSeriesExtractTag', 'time-series-functions', [['group', 'number'], ['tag', 'string']], 'string', 'Returns the named tag value or null.'),
  nativeFunction('timeSeriesGroupToSamplingKey', 'time-series-functions', [['group', 'number']], 'number', 'Returns a stable sampling hash of a tag group.'),
  nativeFunction('timeSeriesGroupToTags', 'time-series-functions', [['group', 'number']], 'array<record>', 'Returns sorted (name, value) tag pairs.'),
  nativeFunction('timeSeriesIdToGroup', 'time-series-functions', [['id', 'any']], 'number', 'Returns the group previously stored for a series ID.'),
  nativeFunction('timeSeriesIdToTags', 'time-series-functions', [['id', 'any']], 'array<record>', 'Returns sorted tag pairs previously stored for a series ID.'),
  nativeFunction('timeSeriesJoinTags', 'time-series-functions', [['group', 'number'], ['destination_tag', 'string'], ['separator', 'string'], ['source_tags', 'array']], 'number', 'Adds a tag by joining the values of named source tags.'),
  nativeFunction('timeSeriesMetricTypeToSuffixes', 'time-series-functions', [['type', 'string']], 'array<string>', 'Returns Prometheus family suffixes for a metric type.'),
  nativeFunction('timeSeriesPrometheusValueToString', 'time-series-functions', [['value', 'number']], 'string', 'Formats a floating-point sample using Prometheus conventions.'),
  nativeFunction('timeSeriesRemoveTag', 'time-series-functions', [['group', 'number'], ['tag', 'string']], 'number', 'Removes a named tag from a group.'),
  ...['timeSeriesRemoveTags', 'timeSeriesRemoveAllTagsExcept'].map(name => nativeFunction(name, 'time-series-functions', [['group', 'number'], ['tags', 'array']], 'number', 'Removes named tags or retains only named tags.')),
  nativeFunction('timeSeriesReplaceTag', 'time-series-functions', [['group', 'number'], ['destination', 'string'], ['replacement', 'string'], ['source', 'string'], ['regex', 'string']], 'number', 'Adds or replaces a tag using a regular-expression substitution.'),
  nativeFunction('timeSeriesStoreTags', 'time-series-functions', [['id', 'T'], ['tags', 'array']], 'T', 'Associates tag pairs with an ID and returns the ID. Additional name/value pairs can be supplied inside the array.'),
  nativeFunction('timeSeriesTagsToGroup', 'time-series-functions', [['tags', 'array']], 'number', 'Interns an array of tag pairs as a query-local group. Extra tags can be supplied in the array.'),
  nativeFunction('timeSeriesTagsToMap', 'time-series-functions', [['tags', ['array', 'map']]], 'map', 'Normalizes tag pairs or a tag map into a sorted map. Extra tags can be supplied in the container.'),
  nativeFunction('timeSeriesThrowDuplicateSeriesIf', 'time-series-functions', [['condition', 'boolean'], ['group', 'number']], 'number', 'Throws for duplicate series when condition is true; otherwise returns zero.'),
  nativeFunction('seriesDecomposeSTL', 'time-series-analysis-functions', [['series', 'array'], ['period', 'number']], 'array<sql native>', 'Decomposes numeric samples into seasonal, trend, residual and baseline arrays.'),
  nativeFunction('seriesPeriodDetectFFT', 'time-series-analysis-functions', [['series', 'array']], 'number', 'Estimates the period of numeric samples using FFT.'),
  nativeFunction('seriesOutliersDetectTukey', 'time-series-analysis-functions', [], 'array<number>', 'Scores Tukey outliers; either omit all tuning arguments (0.25, 0.75, 1.5) or supply all three.', {overloads: [{args: [['series', 'array']], returns: 'array<number>'}, {args: [['series', 'array'], ['min_percentile', 'number'], ['max_percentile', 'number'], ['k', 'number']], returns: 'array<number>'}]}),

  // Native AI calls require server-side credentials/configuration; catalog tests never execute external requests.
  ...['aiClassify', 'aiRedact'].map(name => nativeFunction(name, 'ai-functions', [['text', 'string'], ['categories', 'array'], ['params', 'map?']], 'string', 'Classifies or redacts text using constant category labels and optional model parameters.')),
  ...['aiExtract', 'aiTranslate'].map(name => nativeFunction(name, 'ai-functions', [['text', 'string'], ['instruction_or_language', 'string'], ['params', 'map?']], 'string', 'Extracts information or translates text through a configured AI model.')),
  nativeFunction('aiGenerate', 'ai-functions', [['prompt', 'string'], ['params', 'map?']], 'string', 'Generates text using a configured AI model.'),
  nativeFunction('aiFilter', 'ai-functions', [['text', 'string'], ['condition', 'string'], ['params', 'map?']], 'boolean', 'Tests a natural-language condition through a configured AI model.'),
  nativeFunction('aiEmbed', 'ai-functions', [['text', 'string'], ['model', 'string'], ['params', 'map?']], 'array<number>', 'Returns the numeric embedding of text from a configured model.'),
  nativeFunction('aiSimilarity', 'ai-functions', [['first', 'string'], ['second', 'string'], ['model', 'string'], ['params', 'map?']], 'number', 'Returns embedding cosine similarity using a configured AI model.'),
  nativeFunction('assignCentroid', 'machine-learning-functions', [['vector', 'array'], ['centroids', ['array', 'string']]], 'number', 'Returns the closest centroid ID from constant nested vectors or a centroid dictionary.'),
  ...[['naiveBayesClassifier', 'number'], ['naiveBayesClassifierWithProb', 'record'], ['naiveBayesClassifierWithAllProbs', 'array<record>']].map(([name, returns]) => nativeFunction(name, 'machine-learning-functions', [['dictionary', 'string'], ['text', 'string']], returns, 'Classifies text using a NAIVE_BAYES dictionary, optionally returning probabilities.')),
  ...['quantizeBFloat16ToInt8', 'dequantizeInt8ToBFloat16'].map(name => nativeFunction(name, 'qbit-functions', [['value', ['number', 'array', 'sql native']]], 'T', 'Quantizes or reconstructs numeric values, arrays, or native QBit vectors, preserving the coarse container type.')),
  nativeFunction('evalMLMethod', 'machine-learning-functions', [['model', 'sql native'], ['feature', 'number'], ['features', 'number...']], 'number', 'Predicts with a native stochastic linear/logistic regression state.'),

  // Numeric indexed vectors and uniqTheta sketches are aggregate states, typed `sql native` like -State results.
  nativeFunction('bitmapBuild', 'bitmap-functions', [['array', 'array']], 'sql native', 'Builds an AggregateFunction(groupBitmap, T) state from an integer array.'),
  ...['bitmapAnd', 'bitmapOr', 'bitmapXor', 'bitmapAndnot'].map(name => nativeFunction(name, 'bitmap-functions', [['first', 'sql native'], ['second', 'sql native']], 'sql native', 'Combines groupBitmap states with the named set operation.')),
  ...['bitmapAndCardinality', 'bitmapOrCardinality', 'bitmapXorCardinality', 'bitmapAndnotCardinality'].map(name => nativeFunction(name, 'bitmap-functions', [['first', 'sql native'], ['second', 'sql native']], 'number', 'Returns the cardinality of the named bitmap set operation.')),
  ...['bitmapCardinality', 'bitmapMin', 'bitmapMax'].map(name => nativeFunction(name, 'bitmap-functions', [['bitmap', 'sql native']], 'number', 'Returns the bitmap cardinality or an unsigned extremal element.')),
  ...['bitmapHasAll', 'bitmapHasAny'].map(name => nativeFunction(name, 'bitmap-functions', [['first', 'sql native'], ['second', 'sql native']], 'boolean', 'Tests bitmap subset or intersection membership.')),
  nativeFunction('bitmapContains', 'bitmap-functions', [['bitmap', 'sql native'], ['value', 'number']], 'boolean', 'Tests whether an integer is present in a bitmap.'),
  nativeFunction('bitmapToArray', 'bitmap-functions', [['bitmap', 'sql native']], 'array<number>', 'Returns the integer elements of a groupBitmap state.'),
  ...['bitmapSubsetInRange', 'bitmapSubsetLimit', 'subBitmap'].map(name => nativeFunction(name, 'bitmap-functions', [['bitmap', 'sql native'], ['start', 'number'], ['end_or_limit', 'number']], 'sql native', 'Extracts a bitmap by value range, starting value and count, or zero-based offset and count, respectively.')),
  nativeFunction('bitmapTransform', 'bitmap-functions', [['bitmap', 'sql native'], ['from', 'array'], ['to', 'array']], 'sql native', 'Replaces bitmap elements according to two integer mapping arrays.'),
  nativeFunction('numericIndexedVectorBuild', 'numeric-indexed-vector-functions', [['map', 'map']], 'sql native', 'Builds a numeric indexed vector aggregate state from a numeric map.'),
  ...[['numericIndexedVectorToMap', 'map'], ['numericIndexedVectorCardinality', 'number'], ['numericIndexedVectorAllValueSum', 'number'], ['numericIndexedVectorShortDebugString', 'string']].map(([name, returns]) => nativeFunction(name, 'numeric-indexed-vector-functions', [['state', 'sql native']], returns, 'Inspects a native numeric indexed vector state.')),
  nativeFunction('numericIndexedVectorGetValue', 'numeric-indexed-vector-functions', [['state', 'sql native'], ['index', 'number']], 'number', 'Retrieves a value from a numeric indexed vector.'),
  ...['Add', 'Subtract', 'Multiply', 'Divide', 'Equal', 'NotEqual', 'Greater', 'GreaterEqual', 'Less', 'LessEqual'].map(operation => nativeFunction(`numericIndexedVectorPointwise${operation}`, 'numeric-indexed-vector-functions', [['state', 'sql native'], ['operand', ['sql native', 'number']]], 'sql native', 'Applies pointwise arithmetic/comparison to numeric indexed vectors or a numeric constant; vector index/value types must match.')),
  ...['uniqThetaUnion', 'uniqThetaIntersect', 'uniqThetaNot'].map(name => nativeFunction(name, 'uniqtheta-functions', [['left', 'sql native'], ['right', 'sql native']], 'sql native', 'Combines native uniqTheta aggregate sketches.')),

  // Dictionary lookups whose outer result type doesn't depend on dictionary config.
  nativeFunction('dictGetKeys', 'ext-dict-functions', [['dictionary', 'string'], ['attribute', 'string'], ['value', 'any']], 'array<sql native>', 'Returns dictionary keys matching an attribute value. Keys may be scalars or tuples; their element type depends on dictionary configuration.'),
  nativeFunction('dictGetAll', 'ext-dict-functions', [['dictionary', 'string'], ['attribute', 'string'], ['key', 'any'], ['limit', 'number?']], 'array<sql native>', 'Returns matching attribute values from a regexp-tree dictionary. Tuple-of-attribute names (tuple-of-arrays result) is not supported by this signature.'),
  // Typed dictionary getters have fixed results; only single-attribute forms are exposed.
  ...['Int8', 'Int16', 'Int32', 'Int64', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'Float32', 'Float64', 'String', 'Date', 'DateTime', 'UUID', 'IPv4', 'IPv6'].flatMap(type => {
    let returns = 'number'
    if (type == 'Date') returns = 'date'
    if (type == 'DateTime') returns = 'timestamp'
    if (['String', 'UUID', 'IPv4', 'IPv6'].includes(type)) returns = 'string'
    let args: FunctionDef['args'] = [['dictionary', 'string'], ['attribute', 'string'], ['key', 'any']]
    return [
      nativeFunction(`dictGet${type}`, 'ext-dict-functions', args, returns, `Looks up one ${type} dictionary attribute; absent keys use its configured null value.`),
      nativeFunction(`dictGet${type}OrDefault`, 'ext-dict-functions', [...args, ['default', returns]], returns, `Looks up one ${type} dictionary attribute with an explicit fallback.`),
    ]
  }),
  nativeFunction('dictGetRoot', 'ext-dict-functions', [['dictionary', 'string'], ['key', 'number']], 'number', 'Returns the topmost ancestor in a hierarchical dictionary (26.7+).'),
  ...['Area', 'City', 'Continent', 'Country', 'District', 'Population', 'TopContinent'].map(part => nativeFunction(`regionTo${part}`, 'ym-dict-functions', [['id', 'number'], ['geobase', 'string?']], 'number', 'Looks up a region in the configured embedded geographical dictionary.')),
  nativeFunction('regionHierarchy', 'ym-dict-functions', [['id', 'number'], ['geobase', 'string?']], 'array<number>', 'Returns a region and its ancestor IDs from an embedded geographical dictionary.'),
  nativeFunction('regionIn', 'ym-dict-functions', [['region', 'number'], ['ancestor', 'number'], ['geobase', 'string?']], 'boolean', 'Tests geographical region membership.'),
  nativeFunction('regionToName', 'ym-dict-functions', [['id', 'number'], ['language', 'string?']], 'string', 'Returns the geographical region name in the requested language.'),
  nativeFunction('dictHas', 'ext-dict-functions', [], 'boolean', 'Tests for a dictionary key. Dictionary name must be constant; key must match the configured simple or composite key type. Range dictionaries additionally require a range value convertible to Int64.', {overloads: [
    {args: [['dictionary', 'string'], ['key', 'any']], returns: 'boolean'},
    {args: [['dictionary', 'string'], ['key', 'any'], ['range', ['number', 'date', 'timestamp']]], returns: 'boolean'},
  ]}),
  nativeFunction('dictIsIn', 'ext-dict-functions', [['dictionary', 'string'], ['child', 'number'], ['ancestor', 'number']], 'boolean', 'Tests hierarchical ancestry (including identity) for UInt64 keys in a constant named dictionary.'),
  nativeFunction('dictGetHierarchy', 'ext-dict-functions', [['dictionary', 'string'], ['key', 'number']], 'array<number>', 'Returns the ancestor UInt64 keys from a constant named hierarchical dictionary.'),
  nativeFunction('dictGetChildren', 'ext-dict-functions', [['dictionary', 'string'], ['key', 'number']], 'array<number>', 'Returns the immediate child UInt64 keys from a constant named hierarchical dictionary.'),
  nativeFunction('dictGetDescendants', 'ext-dict-functions', [['dictionary', 'string'], ['key', 'number'], ['level', 'number?']], 'array<number>', 'Returns descendant UInt64 keys from a constant named hierarchical dictionary. UInt8 level defaults to zero (all descendants).'),
  ...[
    ['queryID', 'Returns the current query ID, potentially different on each shard.'],
    ['initialQueryID', 'Returns the initiating query ID, shared across shards.'],
    ['getOSKernelVersion', 'Returns the server OS kernel version.'],
  ].map(([name, summary]) => nativeFunction(name, 'other-functions', [], 'string', summary)),
  ...[
    ['tcpPort', 'Returns the native TCP port on the executing server.'],
    ['shardNum', 'Returns the one-based shard index, or zero for a non-distributed query.'],
    ['shardCount', 'Returns the number of shards, or zero for a non-distributed query.'],
    ['zookeeperSessionUptime', 'Returns the current ZooKeeper session uptime in seconds.'],
  ].map(([name, summary]) => nativeFunction(name, 'other-functions', [], 'number', summary)),
  nativeFunction('initialQueryStartTime', 'other-functions', [], 'timestamp', 'Returns the initiating query start time, shared across shards.'),
  nativeFunction('basename', 'other-functions', [['path', 'string']], 'string', 'Returns the tail after the last slash or backslash, or the whole string if neither is present.'),
  nativeFunction('countDigits', 'other-functions', [['value', 'number']], 'number', 'Counts decimal digits in an integer or the underlying scaled integer of a Decimal.'),
  ...['formatReadableSize', 'formatReadableDecimalSize', 'formatReadableQuantity'].map(name => nativeFunction(name, 'other-functions', [['value', 'number']], 'string', 'Formats a rounded number with binary byte, decimal byte or quantity suffixes.')),
  nativeFunction('formatReadableTimeDelta', 'other-functions', [['seconds', 'number'], ['maximum_unit', 'string?'], ['minimum_unit', 'string?']], 'string', 'Formats seconds as a readable duration with optional maximum/minimum units from years through nanoseconds.'),
  ...['parseReadableSize', 'parseReadableSizeOrNull', 'parseReadableSizeOrZero'].map(name => nativeFunction(name, 'other-functions', [['value', 'string']], 'number', 'Parses a readable byte size, rounding up to UInt64 bytes. Invalid inputs throw, or return null/zero for the named variants.')),
  nativeFunction('parseTimeDelta', 'other-functions', [['value', 'string']], 'number', 'Parses a sequence of numbers and time units into floating-point seconds.'),
  nativeFunction('MACNumToString', 'other-functions', [['value', 'number']], 'string', 'Formats a UInt64 big-endian MAC address as colon-separated hexadecimal.'),
  ...['MACStringToNum', 'MACStringToOUI'].map(name => nativeFunction(name, 'other-functions', [['value', 'string']], 'number', 'Parses a MAC address into UInt64; OUI returns its first three octets. Invalid input returns zero.')),

  // ============================================================================
  // Window Functions
  // ============================================================================
  ...['lagInFrame', 'leadInFrame'].map(name => nativeFunction(name, '../window-functions', [['value', 'T'], ['offset', 'number?'], ['default', 'T?']], 'T', 'Returns a preceding/following value within the current window frame; offset defaults to one.', {window: true})),
  nativeFunction('nonNegativeDerivative', '../window-functions', [['metric', 'number'], ['time', 'timestamp'], ['interval', 'interval?']], 'number', 'Returns the nonnegative metric derivative over timestamps; interval defaults to one second.', {window: true}),


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
    metadata: 'idempotent',
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
    metadata: 'idempotent',
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
    metadata: 'idempotent',
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
    metadata: 'idempotent',
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
    metadata: 'idempotent',
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
  nativeFunction('GROUPING', '../aggregate-functions/grouping_function', [['key', 'any'], ['keys', 'any...']], 'number', 'Returns a bitmask of grouping keys omitted from the current group. Ordinary GROUP BY is supported; ROLLUP/CUBE/GROUPING SETS syntax is not.', {aggregate: true}),

  // Parametric aggregates called with their default parameters (see the header comment).
  ...['contingency', 'cramersV', 'cramersVBiasCorrected', 'theilsU'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['left', 'any'], ['right', 'any']], 'number', 'Computes association between two categorical columns.', {aggregate: true})),
  ...['deltaSum', 'kurtPop', 'kurtSamp', 'skewPop', 'skewSamp'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['value', 'number']], 'number', `Computes ${name} over numeric rows.`, {aggregate: true})),
  ...['entropy', 'estimateCompressionRatio'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['value', 'any']], 'number', 'Computes Shannon entropy or compression ratio (default codec and 1 MiB block size).', {aggregate: true})),
  ...['corrMatrix', 'covarPopMatrix', 'covarSampMatrix'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['value', 'number'], ['rest', 'number...']], 'array<sql native>', 'Computes a nested numeric correlation/covariance matrix.', {aggregate: true})),
  ...['rankCorr', 'maxIntersections', 'maxIntersectionsPosition'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['first', 'number'], ['second', 'number']], 'number', 'Computes rank correlation or maximum interval intersection count/position.', {aggregate: true})),
  ...['kolmogorovSmirnovTest', 'mannWhitneyUTest', 'studentTTest', 'welchTTest', 'simpleLinearRegression'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['value', 'number'], ['sample_or_x', 'number']], 'record', 'Returns test statistic/p-value or linear-regression coefficients using native default parameters.', {aggregate: true})),
  nativeFunction('singleValueOrNull', '../aggregate-functions/reference/singlevalueornull', [['value', ['number', 'string', 'boolean', 'date', 'timestamp', 'time', 'interval']]], 'T', 'Returns the sole distinct non-null scalar value, or null.', {aggregate: true}),
  nativeFunction('distinctDynamicTypes', '../aggregate-functions/reference/distinctdynamictypes', [['value', 'any']], 'array<string>', 'Returns sorted type names observed in a native Dynamic column.', {aggregate: true}),
  nativeFunction('distinctJSONPaths', '../aggregate-functions/reference/distinctjsonpaths', [['value', 'json']], 'array<string>', 'Returns sorted paths observed in a native JSON column.', {aggregate: true}),
  nativeFunction('distinctJSONPathsAndTypes', '../aggregate-functions/reference/distinctjsonpaths', [['value', 'json']], 'map', 'Returns JSON paths mapped to observed native type names.', {aggregate: true}),
  nativeFunction('flameGraph', '../aggregate-functions/reference/flame_graph', [['trace', 'array'], ['size', 'number?'], ['pointer', 'number?']], 'array<string>', 'Aggregates UInt64 stack traces into folded flamegraph strings, with optional allocation size/pointer.', {aggregate: true}),
  nativeFunction('groupArrayLast', '../aggregate-functions/reference/grouparraylast', [['value', 'any']], 'array<sql native>', 'Collects the last values using the server array limit. Ordinary calls require aggregate_function_group_array_action_when_limit_is_reached=discard; otherwise an explicit aggregate size parameter is required.', {aggregate: true}),
  nativeFunction('uniqUpTo', '../aggregate-functions/parametric-functions', [['value', 'any'], ['rest', 'any...']], 'number', 'Counts distinct values up to the default threshold of five, returning six once exceeded. Explicit thresholds require aggregate parameters.', {aggregate: true}),
  nativeFunction('groupBitmap', '../aggregate-functions/reference/groupbitmap', [['value', 'number']], 'number', 'Returns cardinality of the bitmap of unsigned integer values; -State returns the bitmap.', {aggregate: true}),
  ...['groupBitmapOr', 'groupBitmapXor'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['state', 'sql native']], 'number', 'Combines native groupBitmap states and returns cardinality.', {aggregate: true})),
  nativeFunction('groupNumericIndexedVector', 'numeric-indexed-vector-functions', [['index', 'number'], ['value', 'number']], 'number', 'Aggregates indexed numeric values and returns their sum; -State exposes the numeric indexed vector.', {aggregate: true}),
  ...['stochasticLinearRegression', 'stochasticLogisticRegression'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['target', 'number'], ['feature', 'number'], ['features', 'number...']], 'array<number>', 'Fits a regression model with native default optimizer parameters; -State returns a model for evalMLMethod.', {aggregate: true})),
  nativeFunction('timeSeriesGroupArray', '../aggregate-functions/reference/timeSeriesGroupArray', [['timestamp', ['number', 'timestamp', 'array']], ['value', ['number', 'array']]], 'array<record>', 'Collects sorted timestamp/value pairs, retaining the greatest value for duplicate timestamps. Inputs are UInt32/DateTime/DateTime64 and Float32/64, or two arrays of those types.', {aggregate: true}),
  // Registry-only aggregate names and ordinary default-parameter variants.
  ...['any_respect_nulls', 'anyLast_respect_nulls'].map(name => nativeFunction(name, '../aggregate-functions/reference/any', [['value', 'T']], 'T', 'Returns the first or last encountered value, including nulls.', {aggregate: true})),
  ...['argAndMax', 'argAndMin'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['arg', 'any'], ['value', 'any']], 'record', 'Returns a tuple of the argument and its extremal comparison value.', {aggregate: true})),
  ...['gini', 'sumKahan'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['value', 'number']], 'number', 'Computes the Gini coefficient of finite nonnegative values, or a compensated numeric sum, respectively.', {aggregate: true})),
  nativeFunction('sumCount', '../aggregate-functions/reference/sumcount', [['value', 'number']], 'record', 'Returns the (sum, non-null count) tuple.', {aggregate: true}),
  nativeFunction('boundingRatio', '../aggregate-functions/reference/boundingratio', [['x', 'number'], ['y', 'number']], 'number', 'Returns the slope between the leftmost and rightmost points.', {aggregate: true}),
  nativeFunction('categoricalInformationValue', '../aggregate-functions/reference/categoricalinformationvalue', [['category', 'number'], ['categories', 'number...'], ['tag', 'number']], 'array<number>', 'Returns information values for categorical UInt8 features relative to a binary UInt8 target.', {aggregate: true}),
  nativeFunction('deltaSumTimestamp', '../aggregate-functions/reference/deltasumtimestamp', [['value', 'number'], ['timestamp', ['number', 'date', 'timestamp']]], 'number', 'Sums nonnegative changes in numeric values ordered by timestamp.', {aggregate: true}),
  nativeFunction('intervalLengthSum', '../aggregate-functions/reference/intervallengthsum', [['start', ['number', 'date', 'timestamp']], ['end', ['number', 'date', 'timestamp']]], 'number', 'Returns the total length of the union of intervals.', {aggregate: true}),
  nativeFunction('groupBitmapAnd', '../aggregate-functions/reference/groupbitmapand', [['state', 'sql native']], 'number', 'Returns the cardinality of the intersection of groupBitmap states.', {aggregate: true}),
  nativeFunction('groupArrayArray', '../aggregate-functions/combinators', [['array', 'array']], 'array', 'Concatenates input arrays through the groupArray Array combinator.', {aggregate: true, aliases: ['array_concat_agg']}),
  nativeFunction('groupConcat', '../aggregate-functions/reference/groupconcat', [['value', 'string'], ['delimiter', 'string?']], 'string', 'Concatenates strings with an optional delimiter; explicit element limits require parameterized syntax.', {aggregate: true}),
  ...['maxMappedArrays', 'minMappedArrays'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [], 'record', 'Computes extremal values for each array key, returning sorted key and value arrays.', {aggregate: true, overloads: [
    {args: [['pair', 'record']], returns: 'record'}, {args: [['keys', 'array'], ['values', 'array'], ['rest', 'array...']], returns: 'record'},
  ]})),
  nativeFunction('mergedJSONPatch', '../aggregate-functions/reference/mergedjsonpatch', [['json', 'json'], ['sort_key', 'any']], 'json', 'Merges JSON objects with the largest sort key winning for each path.', {aggregate: true}),
  ...['avgx', 'avgy', 'count', 'intercept', 'r2', 'slope', 'sxx', 'sxy', 'syy'].map(part => nativeFunction(`regr_${part}`, `../aggregate-functions/reference/regr_${part}`, [['y', 'number'], ['x', 'number']], 'number', 'Computes the named regression statistic over non-null (dependent, independent) pairs.', {aggregate: true})),
  nativeFunction('quantileBFloat16', '../aggregate-functions/reference/quantilebfloat16', [['value', ['number', 'date', 'timestamp']]], 'T', 'Computes the default median using a BFloat16 histogram, preserving the coarse numeric or temporal type.', {aggregate: true}),
  nativeFunction('quantilePrometheusHistogram', '../aggregate-functions/reference/quantileprometheushistogram', [['bucket_upper_bound', 'number'], ['cumulative_bucket_value', 'number']], 'number', 'Computes the default 0.5 quantile of Prometheus cumulative histogram buckets.', {aggregate: true}),
  nativeFunction('studentTTestOneSample', '../aggregate-functions/reference/studentttestonesample', [['sample', 'number'], ['population_mean', 'number']], 'record', 'Returns the one-sample t-statistic and p-value without explicit confidence parameters.', {aggregate: true}),
  nativeFunction('uniqTheta', '../aggregate-functions/reference/uniqtheta', [['values', 'any...']], 'number', 'Estimates the number of distinct input tuples using a Theta sketch.', {aggregate: true, fanoutSafe: true}),
  ...['cume_dist', 'denseRank', 'percentRank'].map(name => nativeFunction(name, '../window-functions', [], 'number', 'Returns the cumulative distribution, dense rank, or relative rank within a window.', {window: true})),
  nativeFunction('ntile', '../window-functions/ntile', [['buckets', 'number']], 'number', 'Assigns the window row to one of the requested buckets.', {window: true}),
  nativeFunction('timeSeriesLastTwoSamples', '../aggregate-functions/reference/timeserieslasttwosamples', [['timestamp', ['number', 'timestamp']], ['value', 'number']], 'record', 'Returns the two latest timestamps and corresponding values as a pair of arrays.', {aggregate: true}),
  ...['timeSeriesTopKMasks', 'timeSeriesBottomKMasks'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['k', ['number', 'array']], ['key', 'number'], ['values', 'array']], 'array<record>', 'Returns selected series IDs with their per-step selection masks.', {aggregate: true})),
  nativeFunction('timeSeriesLimitKMasks', '../aggregate-functions/reference/timeserieslimitkmasks', [['k', ['number', 'array']], ['key', 'number'], ['sampling_key', 'number'], ['values', 'array']], 'array<record>', 'Returns sampled series IDs with per-step masks ordered by key.', {aggregate: true}),
  nativeFunction('approx_top_k', '../aggregate-functions/reference/approxtopk', [['value', 'any']], 'array<record>', 'Returns approximate top values and counts using the default ten entries.', {aggregate: true, aliases: ['approx_top_count']}),
  nativeFunction('approx_top_sum', '../aggregate-functions/reference/approxtopsum', [['value', 'any'], ['weight', 'number']], 'array<record>', 'Returns approximate top weighted values/counts using the default ten entries.', {aggregate: true}),
  nativeFunction('aggThrow', '../aggregate-functions/reference/aggthrow', [], 'number', 'Tests aggregate exception safety with default throw probability zero. Explicit probability requires aggregate parameters; ordinary arguments are ignored.', {aggregate: true, overloads: [{args: [], returns: 'number'}, {args: [['values', 'any...']], returns: 'number'}]}),
  ...['quantileExactExclusive', 'quantileExactHigh', 'quantileExactInclusive', 'quantileExactLow'].map(name => nativeFunction(name, '../aggregate-functions/reference/quantileexact', [['value', ['number', 'date', 'timestamp']]], 'T', 'Returns the default 0.5 quantile with the named native interpolation convention.', {aggregate: true})),
  ...['quantileExactWeighted', 'quantileExactWeightedInterpolated', 'quantileInterpolatedWeighted', 'quantileTDigestWeighted'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['value', ['number', 'date', 'timestamp']], ['weight', 'number']], 'T', 'Returns the default 0.5 weighted quantile; native weights are nonnegative occurrence counts.', {aggregate: true, aliases: [name.replace('quantile', 'median').toLowerCase()]})),
  ...['quantileBFloat16Weighted', 'quantileTimingWeighted'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['value', 'number'], ['weight', 'number']], 'number', 'Returns the default 0.5 weighted numeric quantile.', {aggregate: true, aliases: [name.replace('quantile', 'median').toLowerCase()]})),


  nativeFunction('anyHeavy', '../aggregate-functions/reference/anyheavy', [['value', 'T']], 'T', 'Selects a frequent value using the heavy-hitters algorithm; normally nondeterministic.', {aggregate: true}),
  nativeFunction('avgWeighted', '../aggregate-functions/reference/avgweighted', [['value', 'number'], ['weight', 'number']], 'number', 'Computes a weighted mean of integer or floating-point inputs; zero total weight returns NaN.', {aggregate: true}),
  ...[
    ['corrStable', 'Computes numerically stable Pearson correlation.'],
    ['covarPopStable', 'Computes numerically stable population covariance.'],
    ['covarSampStable', 'Computes numerically stable sample covariance.'],
  ].map(([name, summary]) => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['x', 'number'], ['y', 'number']], 'number', summary, {aggregate: true})),
  ...[
    ['stddevPopStable', 'Computes numerically stable population standard deviation.'],
    ['stddevSampStable', 'Computes numerically stable sample standard deviation.'],
    ['varPopStable', 'Computes numerically stable population variance.'],
    ['varSampStable', 'Computes numerically stable sample variance.'],
    ['sumWithOverflow', 'Sums using the input numeric width, overflowing rather than widening.'],
    ['groupBitAnd', 'Computes bitwise AND over integer inputs.'],
    ['groupBitOr', 'Computes bitwise OR over integer inputs.'],
    ['groupBitXor', 'Computes bitwise XOR over integer inputs.'],
  ].map(([name, summary]) => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['value', 'number']], 'number', summary, {aggregate: true, aliases: [snakeCaseFunctionName(name)]})),
  nativeFunction('uniqHLL12', '../aggregate-functions/reference/uniqhll12', [['value', 'any'], ['values', 'any...']], 'number', 'Counts distinct argument combinations approximately using HyperLogLog.', {aggregate: true, fanoutSafe: true}),
  nativeFunction('analysisOfVariance', '../aggregate-functions/reference/analysis_of_variance', [['value', 'number'], ['group_no', 'number']], 'record', 'Returns the ANOVA (F statistic, p value) tuple; integer groups start at zero.', {aggregate: true, aliases: ['anova']}),
  nativeFunction('groupArrayIntersect', '../aggregate-functions/reference/grouparrayintersect', [['array', 'array']], 'array', 'Returns the intersection of all input arrays.', {aggregate: true}),
  nativeFunction('groupArrayInsertAt', '../aggregate-functions/reference/grouparrayinsertat', [['value', 'any'], ['position', 'number']], 'array<sql native>', 'Inserts values at zero-based UInt32 positions using native defaults for holes; duplicate positions are nondeterministic.', {aggregate: true}),
  ...['groupArrayMovingAvg', 'groupArrayMovingSum'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['value', 'number']], 'array<number>', 'Returns moving averages or sums with the default window equal to the number of rows. Explicit window sizes require parameterized syntax.', {aggregate: true})),
  // quantile* without parameters computes the median; other levels need fn(params)(args) syntax.
  ...['quantile', 'quantileExact', 'quantileTDigest'].map(name => nativeFunction(name, `../aggregate-functions/reference/${name.toLowerCase()}`, [['value', ['number', 'date', 'timestamp']]], 'T', 'Returns the default 0.5 quantile, preserving the coarse numeric/date/timestamp type. Explicit levels require parameterized syntax.', {aggregate: true, aliases: [name.replace('quantile', 'median').toLowerCase()]})),
  nativeFunction('quantileDeterministic', '../aggregate-functions/reference/quantiledeterministic', [['value', ['number', 'date', 'timestamp']], ['determinator', 'number']], 'T', 'Returns the default 0.5 quantile using deterministic reservoir sampling; determinator is a positive numeric identifier.', {aggregate: true, aliases: ['mediandeterministic']}),
  nativeFunction('quantileTiming', '../aggregate-functions/reference/quantiletiming', [['value', 'number']], 'number', 'Returns the default 0.5 timing quantile; nonnegative timings above 30000 are clamped.', {aggregate: true, aliases: ['mediantiming']}),
  // Opaque array elements avoid inferring a flat array when the collected values are themselves arrays.
  nativeFunction('topK', '../aggregate-functions/reference/topk', [['value', 'any']], 'array<sql native>', 'Returns approximately the ten most frequent values with default load factor three.', {aggregate: true}),
  nativeFunction('topKWeighted', '../aggregate-functions/reference/topkweighted', [['value', 'any'], ['weight', 'number']], 'array<sql native>', 'Returns approximately the ten most frequent values weighted by UInt64 weights, with default load factor three.', {aggregate: true}),
  // Native sumMap also accepts arrays/tuples, unlike the synthesized -Map combinator.
  nativeFunction('sumMap', '../aggregate-functions/reference/summap', [], 'record', 'Sums numeric value arrays by key without overflow. Keys and value arrays must have equal lengths; tuple and map forms preserve their coarse container type.', {aggregate: true, aliases: ['summappedarrays'], overloads: [
    {args: [['map_or_tuple', ['map', 'record']]], returns: 'T'},
    {args: [['keys', 'array'], ['values', 'array'], ['more_values', 'array...']], returns: 'record'},
  ]}),
  nativeFunction('sumMapWithOverflow', '../aggregate-functions/reference/summapwithoverflow', [], 'record', 'Sums numeric value arrays by key using the input width, allowing overflow. Keys and value arrays must have equal lengths.', {aggregate: true, overloads: [
    {args: [['tuple', 'record']], returns: 'record'},
    {args: [['keys', 'array'], ['values', 'array'], ['more_values', 'array...']], returns: 'record'},
  ]}),
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
    metadata: 'idempotent',
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
    metadata: 'idempotent',
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
    metadata: 'idempotent',
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
    metadata: 'idempotent',
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
    metadata: 'counting',
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
    metadata: 'counting',
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
    metadata: 'idempotent',
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
    metadata: 'idempotent',
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
    metadata: 'idempotent',
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
    metadata: 'idempotent',
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
    metadata: 'additive',
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
    metadata: 'additive',
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
  nativeFunction('toDateTime32', 'type-conversion-functions', [['value', ['number', 'string', 'date', 'time', 'timestamp']], ['timezone', 'string?']], 'timestamp', 'Converts a value to DateTime.'),
  nativeFunction('toTime', 'type-conversion-functions', [['value', ['number', 'string', 'timestamp']]], 'time', 'Converts seconds, text or a timestamp to Time (25.6+).'),
  nativeFunction('toTime64', 'type-conversion-functions', [['value', ['number', 'string', 'timestamp']], ['scale', 'number']], 'time', 'Converts a value to Time64 at the requested fractional precision (25.6+).'),
  ...['toTimeOrNull', 'toTimeOrZero'].map(name => nativeFunction(name, 'type-conversion-functions', [['value', 'string']], 'time', 'Parses Time text, returning null or zero on failure.')),
  ...['toTime64OrNull', 'toTime64OrZero'].map(name => nativeFunction(name, 'type-conversion-functions', [['value', 'string'], ['precision', 'number?']], 'time', 'Parses Time64 text, returning null or zero on failure.')),
  ...['toDateOrDefault', 'toDate32OrDefault'].map(name => nativeFunction(name, 'type-conversion-functions', [['value', 'any'], ['default', 'date?']], 'date', 'Casts to a native date, returning the supplied date or the type default on failure.')),
  nativeFunction('toDateTimeOrDefault', 'type-conversion-functions', [['value', 'any'], ['timezone', 'string?'], ['default', 'timestamp?']], 'timestamp', 'Casts to DateTime with optional timezone and fallback timestamp.'),
  nativeFunction('toDateTime64OrDefault', 'type-conversion-functions', [['value', 'any'], ['scale', 'number'], ['timezone', 'string?'], ['default', 'timestamp?']], 'timestamp', 'Casts to DateTime64 at a constant precision, optionally selecting timezone and fallback timestamp.'),
  nativeFunction('toBool', 'type-conversion-functions', [['value', ['number', 'string']]], 'boolean', 'Converts a number or case-insensitive true/false string to Bool; invalid strings throw.'),
  ...['toDateOrNull', 'toDateOrZero'].map(name => nativeFunction(name, 'type-conversion-functions', [['value', 'string']], 'date', 'Converts a string to Date; invalid input returns null or the Date lower boundary. Unlike toDate, these variants do not take a timezone.')),
  // Date/time parsers: the OrNull/OrZero variants share their base function's signature.
  ...['parseDateTime', 'parseDateTimeInJodaSyntax', 'parseDateTime64', 'parseDateTime64InJodaSyntax'].flatMap(base => ['', 'OrNull', 'OrZero'].map(suffix => nativeFunction(`${base}${suffix}`, 'type-conversion-functions', [['value', 'string'], ['format', 'string?'], ['timezone', 'string?']], 'timestamp', 'Parses a string using an optional constant format and timezone. Joda variants use Joda patterns; other variants use MySQL patterns. Failure throws or returns null/zero according to the suffix.'))),
  ...['parseDateTime32BestEffort', 'parseDateTimeBestEffortUS'].flatMap(base => ['', 'OrNull', 'OrZero'].map(suffix => nativeFunction(`${base}${suffix}`, 'type-conversion-functions', [['value', 'string'], ['timezone', 'string?']], 'timestamp', 'Parses common date/time formats with an optional constant timezone; US prefers month/day order. Failure throws or returns null/zero according to the suffix.'))),
  ...['parseDateTimeBestEffortOrNull', 'parseDateTimeBestEffortOrZero', 'toDateTimeOrNull', 'toDateTimeOrZero'].map(name => nativeFunction(name, 'type-conversion-functions', [['value', 'string'], ['timezone', 'string?']], 'timestamp', 'Parses a String/FixedString date and time; invalid input returns null or the lower boundary.')),
  ...['parseDateTime64BestEffort', 'parseDateTime64BestEffortUS'].flatMap(base => ['', 'OrNull', 'OrZero'].map(suffix => nativeFunction(`${base}${suffix}`, 'type-conversion-functions', [['value', 'string'], ['precision', 'number?'], ['timezone', 'string?']], 'timestamp', 'Parses common date/time strings with optional constant fractional precision (default 3) and timezone. US prefers month/day order; failure variants return null/zero.'))),
  ...['toDateTime64OrNull', 'toDateTime64OrZero'].map(name => nativeFunction(name, 'type-conversion-functions', [['value', 'string'], ['precision', 'number?'], ['timezone', 'string?']], 'timestamp', 'Parses String/FixedString with optional constant precision (default 3) and timezone; unlike toDateTime64, these try-conversions require strings.')),
  ...['toDate32OrNull', 'toDate32OrZero'].map(name => nativeFunction(name, 'type-conversion-functions', [['value', 'string']], 'date', 'Parses String/FixedString as Date32; invalid input returns null or the minimum Date32.')),
  nativeFunction('toDate32', 'type-conversion-functions', [['value', ['number', 'string', 'date', 'timestamp']], ['timezone', 'string?']], 'date', 'Converts a value to Date32; an optional timezone controls timestamp-to-date conversion.'),
  ...['fromUnixTimestamp64Second', 'fromUnixTimestamp64Micro', 'fromUnixTimestamp64Nano'].map(name => nativeFunction(name, 'type-conversion-functions', [['value', 'number'], ['timezone', 'string?']], 'timestamp', 'Converts an Int64 Unix timestamp at the named precision to DateTime64 with an optional timezone.')),
  ...['Int8', 'Int16', 'Int32', 'Int64', 'Int128', 'Int256', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'UInt128', 'UInt256', 'Float32', 'Float64'].map(target => nativeFunction(`reinterpretAs${target}`, 'type-conversion-functions', [['value', ['number', 'string', 'date', 'timestamp']]], 'number', `Reinterprets the input bytes as ${target}, without numeric conversion.`)),
  ...[['Date', 'date'], ['DateTime', 'timestamp']].map(([target, returns]) => nativeFunction(`reinterpretAs${target}`, 'type-conversion-functions', [['value', ['number', 'string', 'date', 'timestamp']]], returns, 'Reinterprets bytes as days or seconds since the Unix epoch.')),
  ...['reinterpretAsString', 'reinterpretAsFixedString'].map(name => nativeFunction(name, 'type-conversion-functions', [['value', ['number', 'date', 'timestamp']]], 'string', 'Returns the bytes representing a numeric or date/time value.')),
  nativeFunction('reinterpretAsUUID', 'type-conversion-functions', [['value', 'string']], 'string', 'Interprets a big-endian FixedString as a native UUID, represented by the coarse string type.'),
  nativeFunction('toFixedString', 'type-conversion-functions', [['value', 'string'], ['length', 'number']], 'string', 'Pads a string with zero bytes to a constant length; throws if the input is longer.'),
  nativeFunction('toLowCardinality', 'type-conversion-functions', [['value', 'T']], 'T', 'Changes physical encoding to LowCardinality without changing the logical value type.'),
  ...['Year', 'Quarter', 'Month', 'Week', 'Day', 'Hour', 'Minute', 'Second', 'Millisecond', 'Microsecond', 'Nanosecond'].map(unit => nativeFunction(`toInterval${unit}`, 'type-conversion-functions', [['value', ['number', 'string']]], 'interval', `Constructs an interval measured in ${unit.toLowerCase()}s from a number or numeric string.`)),
  nativeFunction('toInterval', 'type-conversion-functions', [['value', ['number', 'string']], ['unit', 'string']], 'interval', 'Constructs an interval in the specified constant unit.'),
  ...['formatRow', 'formatRowNoNewline'].map(name => nativeFunction(name, 'type-conversion-functions', [['format', 'string'], ['value', 'any'], ['rest', 'any...']], 'string', 'Serializes values using a constant ClickHouse output format; NoNewline removes the trailing row delimiter.')),
  nativeFunction('toDecimalString', 'type-conversion-functions', [['value', 'number'], ['scale', 'number']], 'string', 'Formats a numeric value with a UInt8 fractional scale, rounding when necessary; maximum scale is 77 for integer/decimal and 60 for float.'),
  nativeFunction('toStringCutToZero', 'type-conversion-functions', [['value', 'string']], 'string', 'Truncates String/FixedString at the first zero byte.'),

  ...['Int8', 'Int16', 'Int32', 'Int64', 'Int128', 'Int256', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'UInt128', 'UInt256', 'Float32', 'Float64'].flatMap(numericConversionFamily),
  ...[32, 64, 128, 256].flatMap(decimalConversionFamily),
  nativeFunction('toBFloat16', 'type-conversion-functions', [{name: 'value', type: 'any'}], 'number', 'Converts a numeric value or numeric string to BFloat16.', {aliases: ['to_bfloat16']}),
  nativeFunction('toBFloat16OrZero', 'type-conversion-functions', [{name: 'value', type: 'string'}], 'number', 'Converts a string to BFloat16, returning zero when parsing fails.', {aliases: ['to_bfloat16_or_zero']}),
  nativeFunction('toBFloat16OrNull', 'type-conversion-functions', [{name: 'value', type: 'string'}], 'number', 'Converts a string to BFloat16, returning null when parsing fails.', {aliases: ['to_bfloat16_or_null']}),

  // ============================================================================
  // Numeric Functions
  // ============================================================================
  ...[
    ['sin', 'Returns the sine of an angle given in radians.'], ['cos', 'Returns the cosine of an angle given in radians.'], ['tan', 'Returns the tangent of an angle given in radians.'],
    ['asin', 'Returns the inverse sine in radians.'], ['acos', 'Returns the inverse cosine in radians.'], ['atan', 'Returns the inverse tangent in radians.'],
    ['sinh', 'Returns the hyperbolic sine.'], ['cosh', 'Returns the hyperbolic cosine.'], ['tanh', 'Returns the hyperbolic tangent.'],
    ['asinh', 'Returns the inverse hyperbolic sine.'], ['acosh', 'Returns the inverse hyperbolic cosine.'], ['atanh', 'Returns the inverse hyperbolic tangent.'],
    ['exp2', 'Returns two raised to x.'], ['exp10', 'Returns ten raised to x.'],
    ['intExp2', 'Returns two raised to x as UInt64.'], ['intExp10', 'Returns ten raised to x as UInt64.'],
    ['cbrt', 'Returns the cube root.'], ['erf', 'Returns the error function.'], ['erfc', 'Returns the complementary error function.'],
    ['lgamma', 'Returns the logarithm of the gamma function.'], ['tgamma', 'Returns the gamma function.'],
    ['log1p', 'Returns log(1 + x), accurately for small x.'], ['sigmoid', 'Returns the sigmoid function.'],
    ['degrees', 'Converts radians to degrees.'], ['radians', 'Converts degrees to radians.'],
    ['factorial', 'Returns the UInt64 factorial of an integer; negative inputs return one and inputs above 20 throw.'],
  ].map(([name, summary]) => nativeFunction(name, 'math-functions', [['x', 'number']], 'number', summary)),
  nativeFunction('pi', 'math-functions', [], 'number', 'Returns pi.'),
  nativeFunction('e', 'math-functions', [], 'number', 'Returns Euler\'s number.'),
  nativeFunction('atan2', 'math-functions', [['y', 'number'], ['x', 'number']], 'number', 'Returns the angle to (x, y) in radians.'),
  nativeFunction('hypot', 'math-functions', [['x', 'number'], ['y', 'number']], 'number', 'Returns the hypotenuse length without intermediate overflow or underflow.'),
  // numeric_container produces numeric array elements or a coarse tuple record, without same-arity overload dispatch.
  ...['L1Norm', 'L2Norm', 'L2SquaredNorm', 'LinfNorm'].map(name => nativeFunction(name, 'distance-functions', [['vector', ['array', 'record']]], 'number', 'Returns the named norm of a numeric array or tuple.')),
  ...['L1Distance', 'L2Distance', 'L2SquaredDistance', 'LinfDistance', 'cosineDistance', 'arrayDotProduct', 'dotProduct'].map(name => nativeFunction(name, 'distance-functions', [['first', ['array', 'record']], ['second', ['array', 'record']]], 'number', 'Returns a numeric vector distance or dot product; vectors must have equal lengths and compatible numeric element types.')),
  ...['L1Normalize', 'L2Normalize', 'LinfNormalize'].map(name => nativeFunction(name, 'distance-functions', [['vector', ['array', 'record']]], 'numeric_container', 'Returns a unit-norm vector as a numeric array or tuple.')),
  nativeFunction('LpNorm', 'distance-functions', [['vector', ['array', 'record']], ['power', 'number']], 'number', 'Returns the p-norm of a numeric vector, for finite p >= 1.'),
  nativeFunction('LpNormalize', 'distance-functions', [['vector', ['array', 'record']], ['power', 'number']], 'numeric_container', 'Normalizes a vector to unit p-norm, returning a numeric array or tuple.'),
  nativeFunction('LpDistance', 'distance-functions', [['first', ['array', 'record']], ['second', ['array', 'record']], ['power', 'number']], 'number', 'Returns the p-norm distance between numeric vectors.'),
  ...['L2DistanceTransposed', 'cosineDistanceTransposed', 'dotProductTransposed', 'L2DistanceTransposedQuantized', 'cosineDistanceTransposedQuantized', 'dotProductTransposedQuantized'].map(name => nativeFunction(name, 'distance-functions', [['vectors', 'sql native'], ['reference', 'array'], ['bits', 'number'], ['used_dims', 'number?']], 'number', 'Compares native QBit vectors against a numeric reference array. Requires 25.10+ (L2), 26.1+ (cosine), or 26.7+ (dot product and quantized forms).')),
  nativeFunction('financialInternalRateOfReturn', 'financial-functions', [['cashflows', 'array'], ['guess', 'number?']], 'number', 'Returns IRR for numeric cashflows at regular intervals (25.7+); default guess is 0.1.'),
  nativeFunction('financialInternalRateOfReturnExtended', 'financial-functions', [['cashflows', 'array'], ['dates', 'array'], ['guess', 'number?'], ['daycount', 'string?']], 'number', 'Returns XIRR for numeric cashflows and sorted unique Date values (25.7+).'),
  nativeFunction('financialNetPresentValue', 'financial-functions', [['rate', 'number'], ['cashflows', 'array'], ['start_from_zero', 'boolean?']], 'number', 'Returns NPV for numeric cashflows at regular intervals (25.7+). Period numbering starts at zero by default.'),
  nativeFunction('financialNetPresentValueExtended', 'financial-functions', [['rate', 'number'], ['cashflows', 'array'], ['dates', 'array'], ['daycount', 'string?']], 'number', 'Returns XNPV for numeric cashflows and sorted unique Date values (25.7+).'),
  nativeFunction('widthBucket', 'math-functions', [['operand', 'number'], ['low', 'number'], ['high', 'number'], ['count', 'number']], 'number', 'Returns the equal-width histogram bucket; count must be a positive unsigned integer.', {aliases: ['width_bucket']}),
  nativeFunction('proportionsZTest', 'math-functions', [['successes_x', 'number'], ['successes_y', 'number'], ['trials_x', 'number'], ['trials_y', 'number'], ['conf_level', 'number'], ['pool_type', 'string']], 'record', 'Returns (z statistic, p value, lower confidence bound, upper confidence bound). Pool type is pooled or unpooled; successes/trials are UInt64.'),
  nativeFunction('roundBankers', 'rounding-functions', [['x', 'number'], ['precision', 'number?']], 'number', 'Rounds to the nearest even value on ties; integer precision defaults to zero.'),
  nativeFunction('truncate', 'rounding-functions', [['x', 'number'], ['precision', 'number?']], 'number', 'Rounds toward zero at the specified integer decimal precision (default zero).', {aliases: ['trunc']}),
  nativeFunction('roundAge', 'rounding-functions', [['age', 'number']], 'number', 'Maps an age to the standard age groups 0, 17, 18, 25, 35, 45, 55.'),
  nativeFunction('roundDuration', 'rounding-functions', [['seconds', 'number']], 'number', 'Rounds down to a common duration, or zero below one.'),
  nativeFunction('roundToExp2', 'rounding-functions', [['x', 'number']], 'number', 'Rounds down to a power of two, or zero below one.'),
  nativeFunction('roundDown', 'rounding-functions', [['x', 'number'], ['bounds', 'array']], 'number', 'Rounds down to a numeric array boundary, returning the lowest boundary if x is below all boundaries.'),
  nativeFunction('exp', 'math-functions', [{name: 'x', type: 'number'}], 'number', 'Returns e raised to x.'),
  // Numeric ordinary calls; plus/minus expose numeric forms only because temporal results need argument-pair dispatch.
  ...['plus', 'minus', 'multiply', 'divide', 'divideOrNull', 'intDivOrNull', 'intDivOrZero', 'modulo', 'moduloOrNull', 'moduloOrZero', 'moduloLegacy', 'positiveModulo', 'positiveModuloOrNull', 'gcd', 'lcm', 'min2', 'max2', 'avg2', 'ifNotFinite'].map(name => nativeFunction(name, 'arithmetic-functions', [['x', 'number'], ['y', 'number']], 'number', 'Applies native numeric arithmetic. Integer, decimal and floating-point domain restrictions are checked by ClickHouse.')),
  ...[['negate', 'Negates a number.'], ['byteSwap', 'Reverses the bytes of an integer.'], ['sqr', 'Squares a number (26.7+).']].map(([name, summary]) => nativeFunction(name, 'arithmetic-functions', [['x', 'number']], 'number', summary)),
  ...['divideDecimal', 'multiplyDecimal'].map(name => nativeFunction(name, 'arithmetic-functions', [['x', 'number'], ['y', 'number'], ['result_scale', 'number?']], 'number', 'Computes Decimal256 arithmetic with an optional constant result scale. Inputs must be decimals.')),
  nativeFunction('midpoint', 'arithmetic-functions', [['values', 'number...']], 'number', 'Returns the average of numeric arguments (25.11+). Temporal forms are not exposed because their common result needs argument-dependent inference.'),
  ...['isFinite', 'isInfinite', 'isNaN'].map(name => nativeFunction(name, 'arithmetic-functions', [['x', 'number']], 'boolean', 'Tests a floating-point value for finiteness, infinity, or NaN.')),
  nativeFunction('isPrime', 'math-functions', [['x', 'number']], 'boolean', 'Tests whether an integer is prime (26.5+).'),
  nativeFunction('isProbablePrime', 'math-functions', [['x', 'number'], ['rounds', 'number?']], 'boolean', 'Tests probable primality with an optional number of Miller-Rabin rounds (26.5+).'),
  ...['bitAnd', 'bitOr', 'bitXor', 'bitHammingDistance', 'bitRotateLeft', 'bitRotateRight'].map(name => nativeFunction(name, 'bit-functions', [['x', 'number'], ['y', 'number']], 'number', 'Applies the named bitwise operation to numeric inputs. Rotations require integers.')),
  nativeFunction('bitCount', 'bit-functions', [['x', 'number']], 'number', 'Counts set bits without sign extension.'),
  nativeFunction('bitNot', 'bit-functions', [['x', ['number', 'string']]], 'T', 'Inverts numeric or string bits, preserving the coarse input type.'),
  ...['bitShiftLeft', 'bitShiftRight'].map(name => nativeFunction(name, 'bit-functions', [['x', ['number', 'string']], ['count', 'number']], 'T', 'Shifts integer or string bits, preserving the coarse input type.')),
  nativeFunction('bitSlice', 'bit-functions', [['value', 'string'], ['offset', 'number'], ['length', 'number?']], 'string', 'Extracts a one-based bit slice, padded to whole bytes.'),
  nativeFunction('bitTest', 'bit-functions', [['x', 'number'], ['index', 'number']], 'boolean', 'Tests a zero-based bit position.'),
  ...['bitTestAll', 'bitTestAny'].map(name => nativeFunction(name, 'bit-functions', [['x', 'number'], ['index', 'number'], ['indexes', 'number...']], 'boolean', 'Tests whether all or any specified zero-based bit positions are set.')),
  nativeFunction('intDiv', 'arithmetic-functions', [{name: 'x', type: 'number'}, {name: 'y', type: 'number'}], 'number', 'Divides x by y and rounds down to an integer.', {aliases: ['int_div']}),
  nativeFunction('log', 'math-functions', [{name: 'x', type: 'number'}], 'number', 'Returns the natural logarithm of x.'),
  nativeFunction('log10', 'math-functions', [{name: 'x', type: 'number'}], 'number', 'Returns the base-10 logarithm of x.'),
  nativeFunction('log2', 'math-functions', [{name: 'x', type: 'number'}], 'number', 'Returns the base-2 logarithm of x.'),
  nativeFunction('sign', 'math-functions', [{name: 'x', type: 'number'}], 'number', 'Returns -1, 0, or 1 for the sign of x.'),
  {
    name: 'abs',
    metadata: 'idempotent',
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
    metadata: 'idempotent',
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
    metadata: 'idempotent',
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
    metadata: 'idempotent',
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
    metadata: 'selection',
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
    metadata: 'selection',
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
    metadata: 'idempotent',
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
  // UUID, IP, and Geography (native subtypes use coarse strings/records/arrays)
  // ============================================================================
  nativeFunction('flipCoordinates', 'other-functions', [['geometry', ['record', 'array', 'sql native']]], 'T', 'Swaps geometry coordinates, preserving the native container type.'),
  nativeFunction('MGRSToGeo', 'geo/coordinates', [['mgrs', 'string']], 'record', 'Decodes an MGRS reference to a longitude/latitude tuple.'),
  nativeFunction('geoToMGRS', 'geo/coordinates', [['longitude', 'number'], ['latitude', 'number'], ['precision', 'number?']], 'string', 'Encodes longitude/latitude as an MGRS reference.'),
  nativeFunction('geoToUTM', 'geo/coordinates', [['longitude', 'number'], ['latitude', 'number'], ['zone', 'number?']], 'record', 'Returns UTM easting, northing, zone and latitude band.'),
  nativeFunction('UTMToGeo', 'geo/coordinates', [['easting', 'number'], ['northing', 'number'], ['zone', 'number'], ['hemisphere', ['number', 'string']]], 'record', 'Decodes UTM coordinates to longitude/latitude; hemisphere is a flag or MGRS band letter.'),
  ...['MVTBoundingBox', 'MVTBoundingBoxMercator'].map(name => nativeFunction(name, 'geo/polygon', [['zoom', 'number'], ['tile_x', 'number'], ['tile_y', 'number'], ['margin', 'number?']], 'record', 'Returns a tile bounding box as a four-coordinate tuple, in degrees or Web Mercator.')),
  nativeFunction('MVTEncodeGeom', 'geo/polygon', [['geometry', ['record', 'array', 'sql native']], ['zoom', 'number'], ['tile_x', 'number'], ['tile_y', 'number'], ['extent', 'number?'], ['buffer', 'number?'], ['clip', 'number?']], 'sql native', 'Clips a named native geometry to tile space, returning the native Geometry variant, not an inferred coordinate shape.'),
  ...['areaCartesian', 'areaSpherical', 'perimeterCartesian', 'perimeterSpherical'].map(name => nativeFunction(name, 'geo/polygon', [['geometry', ['record', 'array', 'sql native']]], 'number', 'Measures area or perimeter of a named native geometry.')),
  ...['geometryIntersectCartesian', 'geometryIntersectSpherical'].map(name => nativeFunction(name, 'geo/polygon', [['first', ['record', 'array', 'sql native']], ['second', ['record', 'array', 'sql native']]], 'boolean', 'Tests geometry intersection in Cartesian or spherical coordinates.')),
  nativeFunction('h3PolygonToCells', 'geo/h3', [['geometry', ['array', 'sql native']], ['resolution', 'number']], 'array<number>', 'Returns H3 cell indexes covering a polygon.'),
  nativeFunction('h3PolygonToCellsWithContainment', 'geo/h3', [['geometry', ['array', 'sql native']], ['resolution', 'number'], ['flags', 'number']], 'array<number>', 'Returns H3 cell indexes covering a polygon using the requested containment flags.'),
  nativeFunction('svg', 'geo/polygon', [['geometry', ['record', 'array', 'sql native']], ['style', 'string?']], 'string', 'Serializes a named native geometry to SVG with optional CSS style.'),
  nativeFunction('wkb', 'geo/polygon', [['geometry', ['record', 'array', 'sql native']]], 'string', 'Serializes a named native geometry to WKB. Plain Tuple/Array values need a geometry type annotation.'),
  ...['readWKT', 'readWKB'].map(name => nativeFunction(name, 'geo/polygon', [['value', 'string']], 'sql native', 'Parses a geometry into the native Geometry variant (the result type is fixed, not selected by the text).')),
  ...['readWKTMultiPoint', 'readWKBMultiPoint'].map(name => nativeFunction(name, 'geo/polygon', [['value', 'string']], 'array<record>', 'Parses a multipoint into an array of coordinate tuples.')),
  ...['geoDistance', 'greatCircleAngle', 'greatCircleDistance'].map(name => nativeFunction(name, 'geo/coordinates', [['longitude1', 'number'], ['latitude1', 'number'], ['longitude2', 'number'], ['latitude2', 'number']], 'number', 'Compares two longitude/latitude pairs in degrees. Distance variants return meters; greatCircleAngle returns degrees. Longitude must be -180..180 and latitude -90..90.')),
  ...['isIPv4String', 'isIPv6String'].map(name => nativeFunction(name, 'ip-address-functions', [['address', 'string']], 'boolean', 'Tests whether a string is a valid address of the indicated IP version.')),
  nativeFunction('isIPAddressInRange', 'ip-address-functions', [['address', 'string'], ['prefix', 'string']], 'boolean', 'Tests membership of an IPv4/IPv6 address in a CIDR prefix; differing IP versions return false.'),
  ...['toIPv4', 'toIPv6'].map(name => nativeFunction(name, 'ip-address-functions', [['value', ['number', 'string']]], 'string', 'Constructs a native IP address from a string or native unsigned integer (UInt8/16/32 for IPv4, UInt128 for IPv6); represented as a coarse string.')),
  ...['IPv4', 'IPv6'].flatMap(version => ['OrNull', 'OrZero', 'OrDefault'].map(suffix => nativeFunction(`to${version}${suffix}`, 'ip-address-functions', suffix == 'OrDefault' ? [['value', 'string'], ['default', 'string?']] : [['value', 'string']], 'string', `Parses a native ${version} address. Invalid input returns null, the zero address or a native ${version} default according to the suffix.`))),
  ...['IPv4NumToString', 'IPv4NumToStringClassC', 'IPv4ToIPv6'].map(name => nativeFunction(name, 'ip-address-functions', [['value', 'number']], 'string', 'Converts a UInt32 IPv4 address to text (ClassC masks the last octet) or IPv6 FixedString(16) bytes.')),
  ...['IPv4StringToNum', 'IPv4StringToNumOrDefault', 'IPv4StringToNumOrNull'].map(name => nativeFunction(name, 'ip-address-functions', [['value', 'string']], 'number', 'Parses an IPv4 address into UInt32; invalid input throws, returns zero or returns null according to the suffix.')),
  ...['IPv6StringToNum', 'IPv6StringToNumOrDefault', 'IPv6StringToNumOrNull', 'IPv6NumToString'].map(name => nativeFunction(name, 'ip-address-functions', [['value', 'string']], 'string', 'Converts between textual IPv6 addresses and FixedString(16) bytes; StringToNum failure variants return zero bytes or null.')),
  ...['IPv4CIDRToRange', 'IPv6CIDRToRange'].map(name => nativeFunction(name, 'ip-address-functions', [['address', 'string'], ['prefix_length', 'number']], 'record', 'Returns a tuple of the lowest and highest native IP addresses in a UInt8-length subnet.')),
  nativeFunction('cutIPv6', 'ip-address-functions', [['address', 'string'], ['ipv6_bytes', 'number'], ['ipv4_bytes', 'number']], 'string', 'Masks trailing bytes of a FixedString(16) IPv6 address and returns its textual representation; IPv4-mapped addresses use ipv4_bytes.'),

  ...['generateUUIDv4', 'generateUUIDv7'].map(name => nativeFunction(name, 'uuid-functions', [['ignored', 'any?']], 'string', 'Generates a native UUID; the optional expression bypasses common-subexpression elimination.')),
  nativeFunction('generateULID', 'ulid-functions', [['ignored', 'any?']], 'string', 'Generates a ULID string; the optional expression bypasses common-subexpression elimination.'),
  nativeFunction('generateSnowflakeID', 'uuid-functions', [['ignored', 'any?'], ['machine_id', 'number?']], 'number', 'Generates a UInt64 Snowflake ID; the optional machine ID uses its lowest ten bits.'),
  nativeFunction('serverUUID', 'uuid-functions', [], 'string', 'Returns the server native UUID.'),
  ...['toUUID', 'toUUIDOrNull', 'toUUIDOrZero'].map(name => nativeFunction(name, 'uuid-functions', [['value', 'string']], 'string', 'Parses a native UUID; invalid input throws or returns null/zero according to the suffix.')),
  nativeFunction('toUUIDOrDefault', 'uuid-functions', [['value', 'any'], ['default', 'string?']], 'string', 'Parses a native UUID, returning the supplied native UUID on failure.'),
  ...['UUIDNumToString', 'UUIDStringToNum', 'UUIDToNum'].map(name => nativeFunction(name, 'uuid-functions', [['value', 'string'], ['variant', 'number?']], 'string', 'Converts UUID text/native UUID/binary FixedString(16); variant is 1 for big-endian (default), 2 for Microsoft byte order.')),
  nativeFunction('dateTimeToUUIDv7', 'uuid-functions', [['value', 'timestamp']], 'string', 'Constructs a UUIDv7 from a DateTime timestamp.'),
  nativeFunction('UUIDv7ToDateTime', 'uuid-functions', [['value', 'string'], ['timezone', 'string?']], 'timestamp', 'Extracts a DateTime64(3) timestamp from a native UUIDv7; invalid versions return the epoch.'),
  nativeFunction('ULIDStringToDateTime', 'ulid-functions', [['value', 'string'], ['timezone', 'string?']], 'timestamp', 'Extracts a DateTime64(3) timestamp from a ULID string.'),
  ...['dateTimeToSnowflake', 'dateTime64ToSnowflake'].map(name => nativeFunction(name, 'uuid-functions', [['value', 'timestamp']], 'number', 'Converts a timestamp to a legacy Int64 Snowflake ID using the native legacy epoch.')),
  ...['dateTimeToSnowflakeID', 'dateTime64ToSnowflakeID'].map(name => nativeFunction(name, 'uuid-functions', [['value', 'timestamp'], ['epoch', 'number?']], 'number', 'Converts a timestamp to UInt64 Snowflake ID; epoch is unsigned milliseconds since 1970, default zero.')),
  ...['snowflakeToDateTime', 'snowflakeToDateTime64'].map(name => nativeFunction(name, 'uuid-functions', [['value', 'number'], ['timezone', 'string?']], 'timestamp', 'Extracts a timestamp from a legacy Int64 Snowflake ID.')),
  ...['snowflakeIDToDateTime', 'snowflakeIDToDateTime64'].map(name => nativeFunction(name, 'uuid-functions', [['value', 'number'], ['epoch', 'number?'], ['timezone', 'string?']], 'timestamp', 'Extracts a timestamp from UInt64 Snowflake ID; epoch is unsigned milliseconds since 1970, default zero.')),
  nativeFunction('geohashEncode', 'geo/geohash', [['longitude', 'number'], ['latitude', 'number'], ['precision', 'number?']], 'string', 'Encodes longitude/latitude as a geohash; integer precision defaults to 12.'),
  nativeFunction('geohashDecode', 'geo/geohash', [['hash', 'string']], 'record', 'Decodes a geohash into a (longitude, latitude) tuple.'),
  nativeFunction('geohashesInBox', 'geo/geohash', [['min_longitude', 'number'], ['min_latitude', 'number'], ['max_longitude', 'number'], ['max_latitude', 'number'], ['precision', 'number']], 'array<string>', 'Returns geohash cells covering a bounding box at a UInt8 precision from 1 through 12.'),
  nativeFunction('geoToH3', 'geo/h3', [['latitude', 'number'], ['longitude', 'number'], ['resolution', 'number']], 'number', 'Returns an H3 UInt64 index at resolution 0..15. Uses v25.8 latitude/longitude order; native compatibility settings may change the order.'),
  ...['h3GetResolution', 'h3GetBaseCell', 'h3CellAreaM2', 'h3CellAreaRads2', 'h3ExactEdgeLengthKm', 'h3ExactEdgeLengthM', 'h3ExactEdgeLengthRads', 'h3GetOriginIndexFromUnidirectionalEdge', 'h3GetDestinationIndexFromUnidirectionalEdge'].map(name => nativeFunction(name, 'geo/h3', [['index', 'number']], 'number', `Computes ${name} for a UInt64 H3 index.`)),
  ...['h3EdgeAngle', 'h3EdgeLengthKm', 'h3EdgeLengthM', 'h3HexAreaKm2', 'h3HexAreaM2', 'h3NumHexagons'].map(name => nativeFunction(name, 'geo/h3', [['resolution', 'number']], 'number', `Computes ${name} for a UInt8 H3 resolution from 0 through 15.`)),
  ...['h3IsValid', 'h3IsPentagon', 'h3IsResClassIII', 'h3UnidirectionalEdgeIsValid'].map(name => nativeFunction(name, 'geo/h3', [['index', 'number']], 'boolean', `Tests ${name} for a UInt64 H3 index.`)),
  ...['h3ToGeo', 'h3GetIndexesFromUnidirectionalEdge'].map(name => nativeFunction(name, 'geo/h3', [['index', 'number']], 'record', 'Returns a coordinate tuple (latitude, longitude) or an edge endpoint tuple (origin, destination).')),
  ...['h3ToGeoBoundary', 'h3GetUnidirectionalEdgeBoundary'].map(name => nativeFunction(name, 'geo/h3', [['index', 'number']], 'array<record>', 'Returns boundary coordinate pairs for a UInt64 H3 cell/edge.')),
  ...['h3GetFaces', 'h3GetUnidirectionalEdgesFromHexagon', 'h3GetPentagonIndexes'].map(name => nativeFunction(name, 'geo/h3', [['index_or_resolution', 'number']], 'array<number>', 'Returns H3 faces, directed edges or pentagon indexes; GetPentagonIndexes takes a resolution, other variants an index.')),
  nativeFunction('h3GetRes0Indexes', 'geo/h3', [], 'array<number>', 'Returns all resolution-zero H3 indexes.'),
  ...['h3Distance', 'h3GetUnidirectionalEdge', 'h3ToParent', 'h3ToCenterChild'].map(name => nativeFunction(name, 'geo/h3', [['index', 'number'], ['index_or_resolution', 'number']], 'number', 'Computes an H3 distance, edge or ancestor/center-child index; hierarchy functions take a target resolution as their second argument.')),
  nativeFunction('h3IndexesAreNeighbors', 'geo/h3', [['first', 'number'], ['second', 'number']], 'boolean', 'Tests whether two UInt64 H3 cells are neighbors.'),
  ...['h3kRing', 'h3HexRing', 'h3Line', 'h3ToChildren'].map(name => nativeFunction(name, 'geo/h3', [['index', 'number'], ['distance_end_or_resolution', 'number']], 'array<number>', 'Returns H3 indexes in a disk/ring, along a line to another index, or children at a target resolution.')),
  ...['h3PointDistKm', 'h3PointDistM', 'h3PointDistRads'].map(name => nativeFunction(name, 'geo/h3', [['latitude1', 'number'], ['longitude1', 'number'], ['latitude2', 'number'], ['longitude2', 'number']], 'number', 'Returns great-circle distance between two degree-valued latitude/longitude pairs in the named unit.')),
  nativeFunction('h3ToString', 'geo/h3', [['index', 'number']], 'string', 'Formats a UInt64 H3 index.'),
  nativeFunction('stringToH3', 'geo/h3', [['value', 'string']], 'number', 'Parses a UInt64 H3 index, returning zero on error.'),
  nativeFunction('geoToS2', 'geo/s2', [['longitude', 'number'], ['latitude', 'number']], 'number', 'Returns the S2 UInt64 index of a longitude/latitude pair.'),
  nativeFunction('s2ToGeo', 'geo/s2', [['index', 'number']], 'record', 'Returns the longitude/latitude pair of an S2 index.'),
  nativeFunction('s2GetNeighbors', 'geo/s2', [['index', 'number']], 'array<number>', 'Returns the four neighboring S2 cell indexes.'),
  nativeFunction('s2CellsIntersect', 'geo/s2', [['first', 'number'], ['second', 'number']], 'boolean', 'Tests whether two S2 cells intersect.'),
  nativeFunction('s2CapContains', 'geo/s2', [['center', 'number'], ['degrees', 'number'], ['point', 'number']], 'boolean', 'Tests whether a spherical cap contains an S2 point index.'),
  nativeFunction('s2RectContains', 'geo/s2', [['low', 'number'], ['high', 'number'], ['point', 'number']], 'boolean', 'Tests whether an S2 rectangle contains a point index.'),
  nativeFunction('s2RectAdd', 'geo/s2', [['low', 'number'], ['high', 'number'], ['point', 'number']], 'record', 'Returns the low/high corners of a rectangle expanded to include an S2 point.'),
  ...['s2CapUnion', 's2RectUnion', 's2RectIntersection'].map(name => nativeFunction(name, 'geo/s2', [['first', 'number'], ['second', 'number'], ['third', 'number'], ['fourth', 'number']], 'record', 'Combines two S2 caps (center, radius in degrees) or rectangles (low, high point indexes), returning a tuple describing the result.')),
  nativeFunction('pointInEllipses', 'geo/coordinates', [['x', 'number'], ['y', 'number'], ['center_x', 'number'], ['center_y', 'number'], ['axis_x', 'number'], ['axis_y', 'number'], ['more_ellipses', 'number...']], 'boolean', 'Tests whether a point lies in any ellipse. Additional numeric arguments must occur in groups of four: center x/y and axes x/y.'),
  nativeFunction('pointInPolygon', 'geo/coordinates', [['point', 'record'], ['polygon', 'array'], ['holes_or_polygons', 'array...']], 'boolean', 'Tests a tuple point against constant ring/polygon/multipolygon arrays; additional arrays describe holes or component polygons.'),
  nativeFunction('wkt', 'geo/polygon', [['value', ['record', 'array']]], 'string', 'Converts native geometric tuples/arrays to WKT.'),
  ...['readWKTPoint', 'readWKBPoint'].map(name => nativeFunction(name, 'geo/polygon', [['value', 'string']], 'record', 'Parses WKT/WKB points into coordinate tuples.')),
  ...['readWKTRing', 'readWKTLineString', 'readWKBLineString'].map(name => nativeFunction(name, 'geo/polygon', [['value', 'string']], 'array<record>', 'Parses a WKT/WKB ring or line into an array of coordinate tuples.')),
  ...['readWKTPolygon', 'readWKTMultiPolygon', 'readWKTMultiLineString', 'readWKBPolygon', 'readWKBMultiPolygon', 'readWKBMultiLineString'].map(name => nativeFunction(name, 'geo/polygon', [['value', 'string']], 'array<sql native>', 'Parses WKT/WKB into nested native coordinate arrays.')),
  ...['polygonAreaCartesian', 'polygonAreaSpherical', 'polygonPerimeterCartesian', 'polygonPerimeterSpherical'].map(name => nativeFunction(name, 'geo/polygon', [['polygon', 'array']], 'number', 'Computes polygon area or perimeter using the named coordinate system.')),
  nativeFunction('polygonConvexHullCartesian', 'geo/polygon', [['polygons', 'array']], 'array<sql native>', 'Returns the Cartesian convex hull as a native polygon array.'),
  ...['polygonsDistanceCartesian', 'polygonsDistanceSpherical'].map(name => nativeFunction(name, 'geo/polygon', [['first', 'array'], ['second', 'array']], 'number', 'Computes minimum distance between two native polygon/multipolygon arrays.')),
  ...['polygonsEqualsCartesian', 'polygonsWithinCartesian', 'polygonsWithinSpherical', 'polygonsIntersectCartesian', 'polygonsIntersectSpherical'].map(name => nativeFunction(name, 'geo/polygon', [['first', 'array'], ['second', 'array']], 'boolean', 'Tests equality, containment or intersection of native polygon/multipolygon arrays.')),
  ...['polygonsIntersectionCartesian', 'polygonsIntersectionSpherical', 'polygonsSymDifferenceCartesian', 'polygonsSymDifferenceSpherical', 'polygonsUnionCartesian', 'polygonsUnionSpherical'].map(name => nativeFunction(name, 'geo/polygon', [['first', 'array'], ['second', 'array']], 'array<sql native>', 'Returns the native multipolygon resulting from intersection, symmetric difference or union.')),

  // ============================================================================
  // Array, Map, and Tuple Functions
  // ============================================================================
  // Tuples are `record`; nested native arrays are `array<sql native>`.
  ...[['flattenTuple', 'Flattens a nested named tuple.'], ['tupleNegate', 'Negates numeric tuple elements.']].map(([name, summary]) => nativeFunction(name, 'tuple-functions', [['tuple', 'record']], 'record', summary)),
  nativeFunction('tuplePositiveModuloByNumber', 'tuple-functions', [['values', 'record'], ['divisor', 'number']], 'record', 'Computes nonnegative remainders for a tuple of numbers.'),
  ...['tupleDivide', 'tupleIntDiv', 'tupleIntDivOrZero', 'tupleMinus', 'tupleModulo', 'tupleMultiply', 'tuplePlus'].map(name => nativeFunction(name, 'tuple-functions', [['left', 'record'], ['right', 'record']], 'record', 'Applies arithmetic elementwise to equal-sized numeric tuples.')),
  ...['tupleDivideByNumber', 'tupleIntDivByNumber', 'tupleIntDivOrZeroByNumber', 'tupleModuloByNumber', 'tupleMultiplyByNumber'].map(name => nativeFunction(name, 'tuple-functions', [['tuple', 'record'], ['number', 'number']], 'record', 'Applies scalar arithmetic to each numeric tuple element.')),
  nativeFunction('tupleConcat', 'tuple-functions', [['tuple', 'record'], ['rest', 'record...']], 'record', 'Concatenates tuples.'),
  nativeFunction('tupleHammingDistance', 'tuple-functions', [['left', 'record'], ['right', 'record']], 'number', 'Counts unequal tuple elements.'),
  nativeFunction('tupleNames', 'tuple-functions', [['tuple', 'record']], 'array<string>', 'Returns tuple element names.'),
  nativeFunction('tupleToNameValuePairs', 'tuple-functions', [['tuple', 'record']], 'array<record>', 'Returns name/value pairs; native tuple values must share a type.'),
  nativeFunction('map', 'tuple-map-functions', [], 'map', 'Builds a native map from alternating keys and values; all keys and all values must have compatible native types.', {overloads: [{args: [], returns: 'map'}, {args: [['key', 'any'], ['value', 'any'], ['pairs', 'any...']], returns: 'map'}]}),
  nativeFunction('transform', 'other-functions', [['value', ['number', 'string']], ['from', 'array'], ['to', 'array']], 'T', 'Three-argument form maps values or retains the input; output array elements must be compatible with the input type. Four-argument cross-type/default form requires return inference from the target array.'),
  nativeFunction('mapPopulateSeries', 'tuple-map-functions', [], 'map', 'Fills missing integer keys with zero values. Map calls and explicit-max array calls are supported; the two-array form conflicts by arity with (map, max).', {overloads: [
    {args: [['map', 'map'], ['max', 'number?']], returns: 'map'},
    {args: [['keys', 'array'], ['values', 'array'], ['max', 'number']], returns: 'record'},
  ]}),

  nativeFunction('tuple', 'tuple-functions', [], 'record', 'Groups values into a native tuple; element types and names are determined by the server.', {overloads: [{args: [], returns: 'record'}, {args: [['values', 'any...']], returns: 'record'}]}),
  // Only ordinary, key-ordered variants are exposed; custom ordering requires lambdas.
  ...['mapSort', 'mapReverseSort'].map(name => nativeFunction(name, 'tuple-map-functions', [['map', 'map']], 'map', 'Sorts map entries by key; Reverse sorts descending.')),
  ...['mapPartialSort', 'mapPartialReverseSort'].map(name => nativeFunction(name, 'tuple-map-functions', [['limit', 'number'], ['map', 'map']], 'map', 'Sorts the first limit map entries by key; Reverse sorts descending. The remaining order is unspecified.')),
  ...['mapAdd', 'mapSubtract'].map(name => nativeFunction(name, 'tuple-map-functions', [['first', ['map', 'record']], ['second', ['map', 'record']], ['rest', 'T...']], 'T', 'Combines numeric values by key, adding or subtracting subsequent arguments. Inputs must all be maps or all tuples of key/value arrays; the result has the same coarse container type.')),
  nativeFunction('mapFromArrays', 'tuple-map-functions', [['keys', ['array', 'map']], ['values', ['array', 'map']]], 'map', 'Creates a map from keys and values; arrays must have equal lengths and keys must not contain null.', {aliases: ['map_from_arrays']}),
  nativeFunction('mapUpdate', 'tuple-map-functions', [['map', 'map'], ['updates', 'map']], 'map', 'Updates map values and adds keys from the second map.'),
  nativeFunction('mapContainsValueLike', 'tuple-map-functions', [['map', 'map'], ['pattern', 'string']], 'boolean', 'Tests whether a string map value matches a LIKE pattern.'),
  nativeFunction('mapExtractValueLike', 'tuple-map-functions', [['map', 'map'], ['pattern', 'string']], 'map', 'Returns entries whose string values match a LIKE pattern.'),
  ...['extractKeyValuePairs', 'extractKeyValuePairsWithEscaping'].map(name => nativeFunction(name, 'tuple-map-functions', [['data', 'string'], ['key_value_delimiter', 'string?'], ['pair_delimiters', 'string?'], ['quoting_character', 'string?'], ['unexpected_quoting_character_strategy', 'string?']], 'map', 'Parses noisy key/value text into a string map. Defaults: colon, space/comma/semicolon, double quote. WithEscaping interprets escape sequences.')),
  nativeFunction('range', 'array-functions', [], 'array<number>', 'Returns integers from start (default zero) up to but excluding end, using step (default one). Arguments must be Int8/16/32/64 or UInt8/16/32/64; native range size and null-value restrictions apply.', {overloads: [
    {args: [['end', 'number']], returns: 'array<number>'},
    {args: [['start', 'number'], ['end', 'number']], returns: 'array<number>'},
    {args: [['start', 'number'], ['end', 'number'], ['step', 'number']], returns: 'array<number>'},
  ]}),
  // Runtime-generated array families; optional lambdas are deliberately omitted from these ordinary forms.
  ...['Int8', 'Int16', 'Int32', 'Int64', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'Float32', 'Float64'].map(type => nativeFunction(`emptyArray${type}`, 'array-functions', [], 'array<number>', `Returns an empty ${type} array.`)),
  ...[['Date', 'date'], ['DateTime', 'timestamp'], ['String', 'string']].map(([type, returns]) => nativeFunction(`emptyArray${type}`, 'array-functions', [], `array<${returns}>`, `Returns an empty ${type} array.`)),
  nativeFunction('arrayWithConstant', 'array-functions', [['length', 'number'], ['value', 'number']], 'array<number>', 'Repeats a numeric value length times. Only the numeric form is exposed: other results require inference from the second argument.'),
  ...['arrayCumSum', 'arrayCumSumNonNegative', 'arrayDifference'].map(name => nativeFunction(name, 'array-functions', [['array', 'array']], 'array<number>', 'Computes running sums or adjacent differences of a numeric array. Only the no-lambda form is exposed.')),
  ...['arrayAvg', 'arrayProduct', 'arraySum'].map(name => nativeFunction(name, 'array-functions', [['array', 'array']], 'number', 'Reduces a numeric array without a lambda.')),
  ...['arrayMax', 'arrayMin'].map(name => nativeFunction(name, 'array-functions', [['array', 'array']], 'array_element', 'Returns the greatest or least array element without a lambda.')),
  ...[['arrayCompact', 'Removes consecutive duplicate array elements.'], ['arrayReverseSort', 'Sorts array elements in descending order.'], ['emptyArrayToSingle', 'Replaces an empty array with one default element.']].map(([name, summary]) => nativeFunction(name, 'array-functions', [['array', 'array']], 'array', summary)),
  ...['arrayEnumerate', 'arrayEnumerateDense'].map(name => nativeFunction(name, 'array-functions', [['array', 'array']], 'array<number>', 'Returns one-based element indexes or first-occurrence ranks.')),
  nativeFunction('arrayEnumerateUniq', 'array-functions', [['arrays', 'array...']], 'array<number>', 'Returns occurrence ranks, comparing tuples of corresponding elements when multiple arrays are supplied.'),
  nativeFunction('arrayExcept', 'array-functions', [['source', 'array'], ['except', 'array']], 'array', 'Removes elements present in the second array, preserving source order and duplicates.'),
  ...['arrayUnion', 'arraySymmetricDifference'].map(name => nativeFunction(name, 'array-functions', [['arrays', 'array...']], 'array', 'Returns the union or symmetric difference of arrays with a common element supertype.')),
  nativeFunction('arrayRemove', 'array-functions', [['array', 'array'], ['value', 'any']], 'array', 'Removes all occurrences of a value (25.11+).'),
  ...['arrayPartialSort', 'arrayPartialReverseSort', 'arrayTopK', 'arrayBottomK'].map(name => nativeFunction(name, 'array-functions', [['limit', 'number'], ['array', 'array']], 'array', 'Sorts the requested prefix or returns the top/bottom K elements, without a lambda. TopK/BottomK require 26.6+.')),
  ...['arrayRotateLeft', 'arrayRotateRight', 'arrayRandomSample'].map(name => nativeFunction(name, 'array-functions', [['array', 'array'], ['count', 'number']], 'array', 'Rotates array elements or samples the requested number of elements.')),
  nativeFunction('arrayShuffle', 'array-functions', [['array', 'array'], ['seed', 'number?']], 'array', 'Shuffles an array, optionally with a reproducible seed.'),
  nativeFunction('arrayPartialShuffle', 'array-functions', [['array', 'array'], ['limit', 'number?'], ['seed', 'number?']], 'array', 'Partially shuffles an array, with optional limit and seed.'),
  nativeFunction('arrayShingles', 'array-functions', [['array', 'array'], ['length', 'number']], 'array<sql native>', 'Returns consecutive sub-arrays of the requested length. Inner arrays retain their native element type; the nested shape is opaque like other nested-array results.'),
  nativeFunction('arrayTranspose', 'array-functions', [['array', 'array']], 'T', 'Transposes a rectangular two-dimensional array (26.4+), preserving its nested element type.'),
  // These functions have a known outer array, but leaf types or nesting cannot be inferred statically.
  nativeFunction('arrayFlatten', 'array-functions', [['array', 'array']], 'array<sql native>', 'Flattens all nested array dimensions to an array of leaf values; leaf types remain opaque.'),
  nativeFunction('arrayReduceInRanges', 'array-functions', [['aggregate_name', 'string'], ['ranges', 'array'], ['array', 'array'], ['more_arrays', 'array...']], 'array<sql native>', 'Applies a constant aggregate-name string to each (start, length) range over the input arrays. Returns an array of aggregate results, which may themselves be arrays or tuples.'),
  ...['arrayEnumerateDenseRanked', 'arrayEnumerateUniqRanked'].map(name => nativeFunction(name, 'array-functions', [], 'array<sql native>', `${name == 'arrayEnumerateDenseRanked' ? 'Enumerates distinct values by first occurrence' : 'Counts occurrences of equal values'} while preserving array dimensions. Supports (array) and (clear_depth, array, max_array_depth); ambiguous two-argument forms are not exposed.`, {overloads: [
    {args: [['array', 'array']], returns: 'array<sql native>'},
    {args: [['clear_depth', 'number'], ['array', 'array'], ['max_array_depth', 'number']], returns: 'array<sql native>'},
  ]})),
  nativeFunction('arrayFlattenedLength', 'array-functions', [['array', 'array']], 'number', 'Counts leaf elements after recursively flattening an array (26.9+).'),
  nativeFunction('arrayAutocorrelation', 'array-functions', [['array', 'array'], ['max_lag', 'number?']], 'array<number>', 'Returns the autocorrelation of a numeric array (26.4+).'),
  nativeFunction('randomHadamardTransform', 'array-functions', [['vector', 'array'], ['seed', 'number?'], ['output_dims', 'number?']], 'array<number>', 'Applies a norm-preserving randomized Hadamard transform to a floating-point vector (26.7+).'),
  ...['arrayJaccardIndex', 'arrayLevenshteinDistance'].map(name => nativeFunction(name, 'array-functions', [['first', 'array'], ['second', 'array']], 'number', 'Computes array Jaccard similarity or Levenshtein edit distance.')),
  ...['arrayLevenshteinDistanceWeighted', 'arraySimilarity'].map(name => nativeFunction(name, 'array-functions', [['first', 'array'], ['second', 'array'], ['first_weights', 'array'], ['second_weights', 'array']], 'number', 'Computes weighted array edit distance or similarity. Weight arrays must be numeric.')),
  nativeFunction('arrayNormalizedGini', 'array-functions', [['predicted', 'array'], ['label', 'array']], 'record', 'Returns predicted, normalized and relative Gini coefficients as a tuple.'),
  nativeFunction('arrayAUCPR', 'array-functions', [['scores', 'array'], ['labels', 'array'], ['partial_offsets', 'array?']], 'number', 'Computes precision-recall AUC, optionally using partial distributed offsets.'),
  nativeFunction('arrayROCAUC', 'array-functions', [['scores', 'array'], ['labels', 'array'], ['scale', 'boolean?'], ['partial_offsets', 'array?']], 'number', 'Computes ROC AUC, optionally normalized and with distributed offsets.'),
  nativeFunction('arrayZipUnaligned', 'array-functions', [['arrays', 'array...']], 'array<record>', 'Zips unequal-length arrays into tuples, filling absent positions with null.'),
  ...['countEqual', 'indexOfAssumeSorted'].map(name => nativeFunction(name, 'array-functions', [['array', 'array'], ['value', 'any']], 'number', 'Counts matching elements or finds the first one-based index in an ascending sorted array.')),
  ...['hasAll', 'hasAny', 'hasSubstr'].map(name => nativeFunction(name, 'array-functions', [['first', 'array'], ['second', 'array']], 'boolean', 'Tests array subset, intersection, or contiguous subsequence membership.')),
  nativeFunction('notHas', 'array-functions', [['collection', ['array', 'map', 'json']], ['value', 'any']], 'boolean', 'Negates array element, map key or JSON path membership (26.8+).'),
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
  nativeFunction('arrayCount', 'array-functions', [['array', 'array']], 'number', 'Counts nonzero elements in a native Array(UInt8), returning UInt32. Only the ordinary single-array form is supported; predicate lambdas are unavailable.'),
  ...['arrayAll', 'arrayExists'].map(name => nativeFunction(name, 'array-functions', [['array', 'array']], 'boolean', 'Tests whether all/any elements of a native Array(UInt8) are nonzero. Only the ordinary single-array form is supported; predicate lambdas are unavailable.')),
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
  nativeFunction('printf', 'string-replace-functions', [['format', 'string'], ['values', ['string...', 'number']]], 'string', 'Formats strings and numbers using a constant printf format. Format specifiers must match native argument types.'),

  ...[
    ['decodeURLComponent', 'Decodes percent-encoded URL components.'],
    ['encodeURLFormComponent', 'Encodes form components, encoding spaces as plus signs.'],
    ['decodeURLFormComponent', 'Decodes form components, decoding plus signs as spaces.'],
    ['domainRFC', 'Extracts the hostname using RFC 3986 parsing.'],
    ['domainWithoutWWWRFC', 'Extracts the RFC 3986 hostname without a leading www.'],
    ['topLevelDomainRFC', 'Extracts the top-level domain using RFC 3986 parsing.'],
    ['firstSignificantSubdomain', 'Extracts the first significant subdomain using the built-in suffix rules.'],
    ['firstSignificantSubdomainRFC', 'Extracts the first significant subdomain using RFC parsing.'],
    ['cutToFirstSignificantSubdomain', 'Keeps the domain through the first significant subdomain.'],
    ['cutToFirstSignificantSubdomainRFC', 'Keeps the domain through the first significant subdomain using RFC parsing.'],
    ['cutToFirstSignificantSubdomainWithWWW', 'Keeps the domain through the first significant subdomain without stripping www.'],
    ['cutToFirstSignificantSubdomainWithWWWRFC', 'Keeps the domain through the first significant subdomain using RFC parsing without stripping www.'],
    ['netloc', 'Extracts username:password@host:port from a URL.'],
    ['pathFull', 'Extracts the path including query string and fragment.'],
    ['queryStringAndFragment', 'Extracts the query string and fragment identifier.'],
    ['cutWWW', 'Removes a leading www. from the URL domain.'],
    ['cutQueryString', 'Removes the query string including the question mark.'],
    ['cutFragment', 'Removes the fragment including the hash sign.'],
    ['cutQueryStringAndFragment', 'Removes the query string and fragment.'],
  ].map(([name, summary]) => nativeFunction(name, 'url-functions', [['url', 'string']], 'string', summary)),
  ...[
    'firstSignificantSubdomainCustom', 'firstSignificantSubdomainCustomRFC',
    'cutToFirstSignificantSubdomainCustom', 'cutToFirstSignificantSubdomainCustomRFC',
    'cutToFirstSignificantSubdomainCustomWithWWW', 'cutToFirstSignificantSubdomainCustomWithWWWRFC',
  ].map(name => nativeFunction(name, 'url-functions', [['url', 'string'], ['tld', 'string']], 'string', 'Extracts the significant subdomain or domain suffix using a constant, server-configured TLD list name. RFC variants use RFC parsing; WithWWW preserves www.')),
  ...['port', 'portRFC'].map(name => nativeFunction(name, 'url-functions', [['url', 'string'], ['default_port', 'number?']], 'number', 'Extracts the UInt16 port, returning default_port (default zero) if absent or invalid. RFC uses RFC 3986 parsing.')),
  ...[
    ['extractURLParameters', 'Returns undecoded name=value strings for URL query parameters.'],
    ['URLHierarchy', 'Returns successively longer URL prefixes split at path and query separators.'],
    ['URLPathHierarchy', 'Returns URL path prefixes without protocol, host or the root element.'],
  ].map(([name, summary]) => nativeFunction(name, 'url-functions', [['url', 'string']], 'array<string>', summary)),
  nativeFunction('cutURLParameter', 'url-functions', [['url', 'string'], ['name', ['string', 'array']]], 'string', 'Removes one parameter name or an array of string names without encoding or decoding them.'),
  // string -> string transforms; try* decoders return '' instead of throwing.
  ...[
    'base32Encode', 'base32Decode', 'tryBase32Decode', 'base58Encode', 'base58Decode', 'tryBase58Decode',
    'base64Encode', 'base64Decode', 'tryBase64Decode', 'base64URLEncode', 'base64URLDecode', 'tryBase64URLDecode',
    'lowerUTF8', 'upperUTF8', 'reverseUTF8', 'toValidUTF8', 'normalizeUTF8NFC', 'normalizeUTF8NFD', 'normalizeUTF8NFKC', 'normalizeUTF8NFKD',
    'encodeXMLComponent', 'decodeXMLComponent', 'decodeHTMLComponent', 'extractTextFromHTML', 'firstLine',
    'idnaEncode', 'idnaDecode', 'tryIdnaEncode', 'punycodeEncode', 'punycodeDecode', 'tryPunycodeDecode', 'initcap', 'initcapUTF8', 'soundex',
  ].map(name => nativeFunction(name, 'string-functions', [['value', 'string']], 'string', `Applies ${name} to a string. UTF8 variants operate on Unicode code points; HTML extraction does not decode entities.`)),
  ...['ascii', 'lengthUTF8', 'CRC32', 'CRC32IEEE', 'CRC64', 'stringBytesEntropy', 'stringBytesUniq'].map(name => nativeFunction(name, 'string-functions', [['value', 'string']], 'number', `Computes ${name} for the input string.`)),
  nativeFunction('isValidUTF8', 'string-functions', [['value', 'string']], 'boolean', 'Tests whether the bytes form valid UTF-8.'),
  ...['startsWithUTF8', 'endsWithUTF8'].map(name => nativeFunction(name, 'string-functions', [['value', 'string'], ['substring', 'string']], 'boolean', `Tests the ${name == 'startsWithUTF8' ? 'prefix' : 'suffix'} using UTF-8 characters.`)),
  ...['byteHammingDistance', 'damerauLevenshteinDistance', 'editDistance', 'editDistanceUTF8', 'jaroSimilarity', 'jaroWinklerSimilarity', 'stringJaccardIndex', 'stringJaccardIndexUTF8'].map(name => nativeFunction(name, 'string-functions', [['left', 'string'], ['right', 'string']], 'number', `Computes ${name} between two strings. UTF8 variants compare code points rather than bytes.`)),
  ...['leftUTF8', 'rightUTF8'].map(name => nativeFunction(name, 'string-functions', [['value', 'string'], ['offset', 'number']], 'string', 'Extracts the requested left/right portion; negative offsets omit characters from the opposite end. UTF8 variants count code points, otherwise bytes.')),
  ...['leftPad', 'rightPad', 'leftPadUTF8', 'rightPadUTF8'].map(name => nativeFunction(name, 'string-functions', [['value', 'string'], ['length', 'number'], ['padding', 'string?']], 'string', 'Pads or truncates to an integer length, using spaces by default. UTF8 variants measure code points rather than bytes.')),
  ...['trimLeft', 'trimRight'].map(name => nativeFunction(name, 'string-functions', [['value', 'string'], ['characters', 'string?']], 'string', 'Removes consecutive characters from the indicated end; the default character is ASCII space.')),
  nativeFunction('substringUTF8', 'string-functions', [['value', 'string'], ['offset', 'number'], ['length', 'number?']], 'string', 'Extracts a UTF-8 substring with one-based integer offset; negative offsets count from the end.'),
  ...['substringIndex', 'substringIndexUTF8'].map(name => nativeFunction(name, 'string-functions', [['value', 'string'], ['delimiter', 'string'], ['count', 'number']], 'string', 'Returns the substring before count delimiter occurrences; negative counts work from the right.')),
  nativeFunction('repeat', 'string-functions', [['value', 'string'], ['count', 'number']], 'string', 'Repeats a string an integer number of times; nonpositive counts return an empty string.'),
  nativeFunction('space', 'string-functions', [['count', 'number']], 'string', 'Returns count spaces, or an empty string for a nonpositive integer count.'),
  nativeFunction('appendTrailingCharIfAbsent', 'string-functions', [['value', 'string'], ['character', 'string']], 'string', 'Appends a single character unless the string already ends with it.'),
  nativeFunction('convertCharset', 'string-functions', [['value', 'string'], ['from', 'string'], ['to', 'string']], 'string', 'Converts a string between the specified constant character encodings.'),
  nativeFunction('concatAssumeInjective', 'string-functions', [['first', 'string'], ['second', 'string'], ['rest', 'string...']], 'string', 'Concatenates strings, allowing GROUP BY optimization under the caller guarantee that concatenation is injective.'),
  ...['concatWithSeparator', 'concatWithSeparatorAssumeInjective'].map(name => nativeFunction(name, 'string-functions', [['separator', 'string'], ['rest', 'any...']], 'string', 'Concatenates serialized values using a constant separator; a separator alone returns an empty string. AssumeInjective additionally requires an injectivity guarantee.')),
  nativeFunction('compareSubstrings', 'string-functions', [['left', 'string'], ['right', 'string'], ['left_offset', 'number'], ['right_offset', 'number'], ['length', 'number']], 'number', 'Compares byte substrings using zero-based unsigned offsets and length; returns -1, 0 or 1.'),
  ...['sparseGrams', 'sparseGramsUTF8', 'sparseGramsHashes', 'sparseGramsHashesUTF8'].map(name => nativeFunction(name, 'string-functions', [['value', 'string'], ['min_length', 'number?'], ['max_length', 'number?']], name.includes('Hashes') ? 'array<number>' : 'array<string>', 'Extracts sparse n-grams or their CRC32 hashes. Minimum length defaults to 3, maximum to 100; UTF8 variants count code points.')),
  ...['overlay', 'overlayUTF8'].map(name => nativeFunction(name, 'string-replace-functions', [['value', 'string'], ['replacement', 'string'], ['offset', 'number'], ['length', 'number?']], 'string', 'Replaces a substring at a one-based offset (negative from the end); omitted length is replacement length. UTF8 counts code points instead of bytes.')),
  ...['replaceOne', 'replaceRegexpOne', 'translate', 'translateUTF8'].map(name => nativeFunction(name, 'string-replace-functions', [['value', 'string'], ['pattern', 'string'], ['replacement', 'string']], 'string', name.startsWith('translate') ? 'Translates characters; unmatched source characters are deleted when the replacement alphabet is shorter.' : 'Replaces only the first substring or regular-expression match.')),
  ...['countMatches', 'countMatchesCaseInsensitive'].map(name => nativeFunction(name, 'string-search-functions', [['haystack', 'string'], ['pattern', 'string']], 'number', 'Counts non-overlapping RE2 regular-expression matches.')),
  ...['countSubstrings', 'countSubstringsCaseInsensitive', 'countSubstringsCaseInsensitiveUTF8', 'positionUTF8', 'positionCaseInsensitive', 'positionCaseInsensitiveUTF8'].map(name => nativeFunction(name, 'string-search-functions', [['haystack', 'string'], ['needle', 'string'], ['start', 'number?']], 'number', 'Counts substring occurrences or returns the first position; optional unsigned starting position is one-based. UTF8 variants use code points.')),
  nativeFunction('locate', 'string-search-functions', [['needle', 'string'], ['haystack', 'string'], ['start', 'number?']], 'number', 'Returns the one-based substring position. Uses the post-24.3 needle-first order; function_locate_has_mysql_compatible_argument_order controls native compatibility.'),
  ...['hasSubsequence', 'hasSubsequenceUTF8', 'hasSubsequenceCaseInsensitive', 'hasSubsequenceCaseInsensitiveUTF8', 'hasToken', 'hasTokenOrNull', 'hasTokenCaseInsensitive', 'hasTokenCaseInsensitiveOrNull'].map(name => nativeFunction(name, 'string-search-functions', [['haystack', 'string'], ['needle', 'string']], 'boolean', 'Tests for a subsequence or an ASCII-delimited token. Token must be constant; OrNull variants return null for malformed tokens.')),
  ...['ngramDistance', 'ngramSearch'].flatMap(base => ['', 'CaseInsensitive', 'UTF8', 'CaseInsensitiveUTF8'].map(suffix => nativeFunction(`${base}${suffix}`, 'string-search-functions', [['haystack', 'string'], ['needle', 'string']], 'number', 'Compares n-gram multisets; Distance returns symmetric distance, Search the asymmetric match score. Constant strings exceeding 32 KiB throw.'))),
  nativeFunction('extract', 'string-search-functions', [['haystack', 'string'], ['pattern', 'string']], 'string', 'Returns the first RE2 match, or the first capturing group if present.'),
  ...['left', 'right'].map(name => nativeFunction(name, 'string-functions', [['value', 'string'], ['length', 'number']], 'string', 'Returns the requested byte prefix or suffix; negative lengths omit bytes from the opposite end.')),
  ...[['caseFoldUTF8', 'Applies Unicode case folding.'], ['normalizeUTF8NFKCCasefold', 'Applies Unicode NFKC normalization and case folding.'], ['removeDiacriticsUTF8', 'Removes Unicode diacritics.'], ['naturalSortKey', 'Produces a key for natural string sorting.']].map(([name, summary]) => nativeFunction(name, 'string-functions', [['value', 'string']], 'string', summary)),
  nativeFunction('isValidASCII', 'string-functions', [['value', 'string']], 'boolean', 'Tests whether all bytes are ASCII.'),
  nativeFunction('conv', 'string-functions', [['value', ['string', 'number']], ['from_base', 'number'], ['to_base', 'number']], 'string', 'Converts a number between bases 2 through 36.'),
  ...['startsWithCaseInsensitive', 'startsWithCaseInsensitiveUTF8', 'endsWithCaseInsensitive', 'endsWithCaseInsensitiveUTF8', 'matchCaseInsensitive', 'notMatch', 'notMatchCaseInsensitive'].map(name => nativeFunction(name, 'string-search-functions', [['value', 'string'], ['pattern', 'string']], 'boolean', 'Tests a case-insensitive prefix/suffix or a regular-expression match/non-match.')),
  nativeFunction('regexpPosition', 'string-search-functions', [['value', 'string'], ['pattern', 'string'], ['position', 'number?'], ['occurrence', 'number?'], ['return_option', 'number?'], ['flags', 'string?'], ['subexpression', 'number?']], 'number', 'Returns the one-based byte position of a regular-expression match, or zero.'),
  ...['hasAllTokens', 'hasAnyTokens'].map(name => nativeFunction(name, 'string-search-functions', [['input', ['string', 'array']], ['needles', ['string', 'array']], ['tokenizer', 'string?']], 'boolean', 'Tests all or any search tokens using an optional constant tokenizer specification.')),
  nativeFunction('hasPhrase', 'string-search-functions', [['input', 'string'], ['phrase', 'string'], ['tokenizer', 'string?']], 'boolean', 'Tests for a consecutive token sequence.'),
  nativeFunction('highlight', 'string-search-functions', [], 'string', 'Wraps matched constant search terms in HTML tags; custom opening and closing tags must both be supplied.', {overloads: [
    {args: [['input', 'string'], ['needles', 'array']], returns: 'string'},
    {args: [['input', 'string'], ['needles', 'array'], ['open_tag', 'string'], ['close_tag', 'string']], returns: 'string'},
  ]}),
  nativeFunction('tokensForLikePattern', 'splitting-merging-functions', [['value', 'string'], ['tokenizer', 'string?'], ['tokenizer_argument', ['number?', 'array']], ['max_length', 'number?'], ['min_cutoff_length', 'number?']], 'array<string>', 'Extracts searchable tokens from a LIKE pattern. Optional tokenizer arguments specify n-gram sizes or separator arrays.'),
  nativeFunction('naiveBayesNgrams', 'splitting-merging-functions', [['text', 'string'], ['n', 'number'], ['mode', 'string'], ['start_token', 'string?'], ['end_token', 'string?']], 'array<string>', 'Splits text into byte, codepoint or token n-grams with optional boundary padding.'),
  nativeFunction('reverseBySeparator', 'splitting-merging-functions', [['value', 'string'], ['separator', 'string?']], 'string', 'Reverses separator-delimited components; default separator is a dot.'),
  nativeFunction('regexpExtract', 'string-search-functions', [['haystack', 'string'], ['pattern', 'string'], ['index', 'number?']], 'string', 'Extracts a group from a constant regular expression; index defaults to 1 and zero selects the whole match.', {aliases: ['regexp_extract']}),
  ...['extractAll', 'extractGroups'].map(name => nativeFunction(name, 'string-search-functions', [['haystack', 'string'], ['pattern', 'string']], 'array<string>', name == 'extractAll' ? 'Returns all matches (or first capturing groups) of a regular expression.' : 'Returns capturing groups from the first match; pattern must contain a group.')),
  ...['extractAllGroupsHorizontal', 'extractAllGroupsVertical'].map(name => nativeFunction(name, 'string-search-functions', [['haystack', 'string'], ['pattern', 'string']], 'array<sql native>', 'Returns nested arrays of captures grouped horizontally by group or vertically by match; pattern must contain groups.')),
  ...[['multiSearchAllPositions', 'array<number>'], ['multiSearchAny', 'boolean'], ['multiSearchFirstIndex', 'number'], ['multiSearchFirstPosition', 'number']].flatMap(([base, returns]) => ['', 'CaseInsensitive', 'UTF8', 'CaseInsensitiveUTF8'].map(suffix => nativeFunction(`${base}${suffix}`, 'string-search-functions', [['haystack', 'string'], ['needles', 'array']], returns, 'Searches an array of string needles; positions and indices are one-based, with zero indicating no match.'))),
  ...[['multiMatchAny', 'boolean'], ['multiMatchAnyIndex', 'number'], ['multiMatchAllIndices', 'array<number>']].map(([name, returns]) => nativeFunction(name, 'string-search-functions', [['haystack', 'string'], ['patterns', 'array']], returns, 'Searches constant regular-expression patterns using Hyperscan; patterns must be an array of strings.')),
  ...[['multiFuzzyMatchAny', 'boolean'], ['multiFuzzyMatchAnyIndex', 'number'], ['multiFuzzyMatchAllIndices', 'array<number>']].map(([name, returns]) => nativeFunction(name, 'string-search-functions', [['haystack', 'string'], ['distance', 'number'], ['patterns', 'array']], returns, 'Searches constant regular-expression patterns allowing the specified unsigned edit distance; requires Hyperscan.')),
  ...['searchAny', 'searchAll'].map(name => nativeFunction(name, 'string-search-functions', [['haystack', 'string'], ['needles', 'array']], 'boolean', 'Tests whether any/all of at most 64 string tokens match the input.')),
  ...['alphaTokens', 'splitByNonAlpha', 'splitByWhitespace'].map(name => nativeFunction(name, 'splitting-merging-functions', [['value', 'string'], ['max_substrings', 'number?']], 'array<string>', 'Splits into tokens, optionally limiting the number of returned substrings. A zero limit means unlimited.')),
  nativeFunction('splitByRegexp', 'splitting-merging-functions', [['pattern', 'string'], ['value', 'string'], ['max_substrings', 'number?']], 'array<string>', 'Splits on a constant RE2 pattern, optionally limiting the number of substrings.'),
  nativeFunction('ngrams', 'splitting-merging-functions', [['value', 'string'], ['size', 'number']], 'array<string>', 'Returns UTF-8 n-grams of the requested unsigned size.'),
  nativeFunction('arrayStringConcat', 'splitting-merging-functions', [['values', 'array'], ['separator', 'string?']], 'string', 'Joins serialized array elements with a constant separator, defaulting to the empty string.'),
  nativeFunction('extractAllGroups', 'splitting-merging-functions', [['value', 'string'], ['pattern', 'string']], 'array<sql native>', 'Returns nested arrays of captures from a constant regular expression, clustered by group.'),
  nativeFunction('tokens', 'splitting-merging-functions', [], 'array<string>', 'Tokenizes a string. Optional constant tokenizer is default, ngram, split or no_op; the third argument is an n-gram size or array of separators.', {overloads: [
    {args: [['value', 'string'], ['tokenizer', 'string?']], returns: 'array<string>'},
    {args: [['value', 'string'], ['tokenizer', 'string'], ['size_or_separators', ['number', 'array']]], returns: 'array<string>'},
  ]}),
  nativeFunction('regexpQuoteMeta', 'string-replace-functions', [['value', 'string']], 'string', 'Escapes regular-expression metacharacters.'),
  nativeFunction('format', 'string-replace-functions', [['pattern', 'string'], ['value', 'any'], ['rest', 'any...']], 'string', 'Formats serialized arguments into a constant brace-placeholder pattern; requires at least one value.'),
  nativeFunction('splitByString', 'splitting-merging-functions', [{name: 'separator', type: 'string'}, {name: 'string', type: 'string'}], 'array<string>', 'Splits a string using a multi-character separator.', {aliases: ['split_by_string']}),
  nativeFunction('replaceRegexpAll', 'string-replace-functions', [{name: 'string', type: 'string'}, {name: 'pattern', type: 'string'}, {name: 'replacement', type: 'string'}], 'string', 'Replaces every regular-expression match.', {aliases: ['replace_regexp_all']}),
  nativeFunction('reverse', 'string-functions', [{name: 'value', type: ['string', 'array']}], 'T', 'Reverses a string by bytes or reverses an array.'),
  nativeFunction('domain', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts the hostname from a URL.'),
  nativeFunction('domainWithoutWWW', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts the hostname and removes a leading www.', {aliases: ['domain_without_www']}),
  nativeFunction('encodeURLComponent', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Takes a regular string and converts it into a URL-encoded (percent-encoded) format where special characters are replaced with their percent-encoded equivalents.'),
  nativeFunction('extractURLParameter', 'url-functions', [{name: 'url', type: 'string'}, {name: 'name', type: 'string'}], 'string', 'Extracts a named URL query parameter.', {aliases: ['extract_url_parameter']}),
  nativeFunction('extractURLParameterNames', 'url-functions', [{name: 'url', type: 'string'}], 'array<string>', 'Returns URL query parameter names.', {aliases: ['extract_url_parameter_names']}),
  nativeFunction('fragment', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts a URL fragment.'),
  nativeFunction('path', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts a URL path without its query string.'),
  nativeFunction('protocol', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts a URL protocol.'),
  nativeFunction('queryString', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts a URL query string.', {aliases: ['query_string']}),
  nativeFunction('topLevelDomain', 'url-functions', [{name: 'url', type: 'string'}], 'string', 'Extracts a URL top-level domain.', {aliases: ['top_level_domain']}),
  // Binary results (FixedString bytes, 128-bit hashes) are typed as string.
  ...['bin', 'hex'].map(name => nativeFunction(name, 'encoding-functions', [['value', ['string', 'number', 'date', 'timestamp']]], 'string', 'Returns the binary-digit or hexadecimal representation of the value.')),
  ...['unbin', 'unhex'].map(name => nativeFunction(name, 'encoding-functions', [['value', 'string']], 'string', 'Decodes binary digits or hexadecimal into a byte string.')),
  nativeFunction('char', 'encoding-functions', [['bytes', 'number...']], 'string', 'Constructs a byte string from numeric values interpreted as integers.'),
  nativeFunction('bech32Encode', 'encoding-functions', [['hrp', 'string'], ['data', 'string'], ['witness_version', 'number?']], 'string', 'Encodes binary data as a Bech32 address. Witness version defaults to 1 (Bech32m); zero selects Bech32.'),
  nativeFunction('bech32Decode', 'encoding-functions', [['address', 'string']], 'record', 'Decodes a Bech32 address into a tuple of human-readable prefix and binary data.'),
  nativeFunction('bitmaskToList', 'encoding-functions', [['value', 'number']], 'string', 'Returns a comma-separated ascending list of powers of two in an integer bitmask.'),
  ...['bitmaskToArray', 'bitPositionsToArray'].map(name => nativeFunction(name, 'encoding-functions', [['value', 'number']], 'array<number>', 'Returns ascending powers of two or bit positions set in an integer.')),
  ...['mortonDecode', 'hilbertDecode'].map(name => nativeFunction(name, 'encoding-functions', [['size_or_mask', ['number', 'record']], ['code', 'number']], 'record', 'Decodes a UInt64 spatial code into a tuple; the first argument is a constant tuple size or range-expansion mask.')),
  ...[{name: 'mortonEncode', dimensions: 8}, {name: 'hilbertEncode', dimensions: 2}].map(({name, dimensions}) => {
    // One to N coordinates, with an optional leading mask. N+1 arguments must start with a mask.
    let overloads = Array.from({length: dimensions + 1}, (_, i) => {
      let args: FunctionDef['args'] = Array.from({length: i + 1}, (_, n) => [`coordinate_${n}`, 'number'])
      if (i > 0) args[0] = ['coordinate_or_mask', i == dimensions ? 'record' : ['number', 'record']]
      return {args, returns: 'number'}
    })
    return nativeFunction(name, 'encoding-functions', [], 'number', 'Encodes unsigned coordinates, optionally preceded by a constant tuple range-expansion mask.', {overloads})
  }),
  ...['farmHash64', 'gccMurmurHash', 'kafkaMurmurHash', 'metroHash64', 'murmurHash2_32', 'murmurHash2_64', 'murmurHash3_32', 'murmurHash3_64', 'xxh3', 'xxHash32'].map(name => nativeFunction(name, 'hash-functions', [['values', 'any...']], 'number', `Computes the native ${name} hash over one or more values.`)),
  ...['sipHash128', 'sipHash128Reference', 'murmurHash3_128'].map(name => nativeFunction(name, 'hash-functions', [['values', 'any...']], 'string', 'Returns the native 128-bit hash as a FixedString(16) byte string.')),
  ...['sipHash64Keyed', 'sipHash128Keyed', 'sipHash128ReferenceKeyed'].map(name => nativeFunction(name, 'hash-functions', [['key', 'record'], ['values', 'any...']], name == 'sipHash64Keyed' ? 'number' : 'string', 'Hashes values using a constant tuple of two UInt64 keys; 128-bit results are FixedString(16) bytes.')),
  ...['SHA512_256', 'keccak256'].map(name => nativeFunction(name, 'hash-functions', [['value', 'string']], 'string', 'Returns the cryptographic digest as raw FixedString bytes.')),
  ...['wyHash64', 'javaHashUTF16LE', 'hiveHash'].map(name => nativeFunction(name, 'hash-functions', [['value', 'string']], 'number', `Computes ${name}; javaHashUTF16LE interprets the bytes as UTF-16LE.`)),
  ...['intHash32', 'intHash64'].map(name => nativeFunction(name, 'hash-functions', [['value', 'number']], 'number', 'Hashes a native integer value.')),
  nativeFunction('javaHash', 'hash-functions', [['value', ['string', 'number']]], 'number', 'Computes the Java hash of a string or signed integer.'),
  ...['jumpConsistentHash', 'kostikConsistentHash'].map(name => nativeFunction(name, 'hash-functions', [['key', 'number'], ['buckets', 'number']], 'number', 'Maps a UInt64 key to a bucket with a consistent hash; bucket count must be a valid positive integer.')),
  nativeFunction('URLHash', 'hash-functions', [['url', 'string'], ['level', 'number?']], 'number', 'Hashes a normalized URL, optionally truncated to an integer URL hierarchy level.'),
  nativeFunction('sqidEncode', 'hash-functions', [['values', 'number...']], 'string', 'Encodes UInt8/16/32/64 values into a Sqid.', {aliases: ['sqid']}),
  nativeFunction('sqidDecode', 'hash-functions', [['sqid', 'string']], 'array<number>', 'Decodes a Sqid into unsigned integers.'),
  ...['ngram', 'wordShingle'].flatMap(prefix => ['', 'CaseInsensitive', 'UTF8', 'CaseInsensitiveUTF8'].flatMap(suffix => [
    nativeFunction(`${prefix}SimHash${suffix}`, 'hash-functions', [['value', 'string'], ['size', 'number?']], 'number', 'Returns a SimHash of n-grams or word shingles. Constant size is 1..25, default 3.'),
    ...['', 'Arg'].map(mode => nativeFunction(`${prefix}MinHash${mode}${suffix}`, 'hash-functions', [['value', 'string'], ['size', 'number?'], ['hash_count', 'number?']], 'record', 'Returns a tuple of minimum/maximum hashes, or tuples of associated strings for Arg variants. Constant size and hash count are 1..25, default 3 and 6.')),
  ])),
  // Random distributions: the trailing optional argument only defeats common-subexpression elimination.
  ...['randBernoulli', 'randChiSquared', 'randExponential', 'randPoisson', 'randStudentT'].map(name => nativeFunction(name, 'random-functions', [['parameter', 'number'], ['ignored', 'any?']], 'number', `Samples the ${name} distribution; the server enforces its probability/rate/degrees-of-freedom domain.`)),
  ...['randBinomial', 'randNegativeBinomial', 'randNormal', 'randLogNormal', 'randFisherF', 'randUniform'].map(name => nativeFunction(name, 'random-functions', [['first', 'number'], ['second', 'number'], ['ignored', 'any?']], 'number', `Samples the ${name} distribution using its two parameters; native numeric domains are enforced by the server.`)),
  nativeFunction('randConstant', 'random-functions', [['ignored', 'any?']], 'number', 'Returns a random UInt32 value constant within one query execution.'),
  ...['randomString', 'randomPrintableASCII'].map(name => nativeFunction(name, 'random-functions', [['length', 'number'], ['ignored', 'any?']], 'string', 'Returns an unsigned byte length of random bytes or printable ASCII characters.')),
  ...['randomFixedString', 'randomStringUTF8'].map(name => nativeFunction(name, 'random-functions', [['length', 'number']], 'string', 'Returns random data of the requested unsigned length; UTF8 counts code points, FixedString counts bytes.')),
  nativeFunction('fuzzBits', 'random-functions', [['value', 'string'], ['probability', 'number']], 'string', 'Flips each input bit with the specified constant probability between zero and one.'),
  nativeFunction('HMAC', 'encryption-functions', [['mode', 'string'], ['message', 'string'], ['key', 'string']], 'string', 'Returns a binary keyed hash digest using the specified algorithm.'),
  nativeFunction('icebergHash', 'hash-functions', [['value', 'any']], 'number', 'Returns the Iceberg-compatible 32-bit Murmur3 hash of a supported scalar value.'),
  nativeFunction('xxHash64Spark', 'hash-functions', [['value', 'string']], 'number', 'Returns the Spark-compatible xxHash64 of a string.'),
  nativeFunction('xxh3_128', 'hash-functions', [['values', 'any...']], 'number', 'Returns a 128-bit xxh3 hash of the input expressions.'),
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

      Returns string byte length, array element count, or native QBit dimension.
    `),
    url: `${click}/functions/string-functions#length`,
    args: [{name: 's', type: ['string', 'array', 'sql native']}],
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
    aliases: ['replaceall'],
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
      trim(string[, characters])

      Removes consecutive characters from both ends; the default character is ASCII space.
    `),
    url: `${click}/functions/string-functions#trimboth`,
    args: [['string', 'string'], ['characters', 'string?']],
    returns: 'string',
    sqlName: 'trimBoth',
    aliases: ['trimboth'],
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
  // Conditional, Comparison and Null Functions
  // ============================================================================
  ...['notLike', 'notILike'].map(name => nativeFunction(name, 'string-search-functions', [['value', 'string'], ['pattern', 'string']], 'boolean', name == 'notLike' ? 'Tests that a string does not match a SQL LIKE pattern.' : 'Tests that a string does not match a SQL LIKE pattern, ignoring case.')),
  nativeFunction('xor', 'logical-functions', [['first', ['number', 'boolean']], ['second', ['number', 'boolean']], ['rest', ['number...', 'boolean']]], 'boolean', 'Returns logical exclusive OR of numeric/boolean arguments.'),
  ...[
    ['globalIn', 'Tests membership in a tuple set distributed to remote servers.'],
    ['globalNotIn', 'Tests non-membership in a tuple set distributed to remote servers.'], ['notIn', 'Tests non-membership in a native tuple set.'],
  ].map(([name, summary]) => nativeFunction(name, 'in-functions', [['value', 'any'], ['set', 'record']], 'boolean', summary)),
  ...[['equals', 'Tests equality.'], ['notEquals', 'Tests inequality.'], ['less', 'Tests whether the first value is less.'], ['lessOrEquals', 'Tests whether the first value is less or equal.'], ['greater', 'Tests whether the first value is greater.'], ['greaterOrEquals', 'Tests whether the first value is greater or equal.'], ['isDistinctFrom', 'Tests inequality, treating nulls as comparable.'], ['isNotDistinctFrom', 'Tests equality, treating nulls as comparable.']].map(([name, summary]) => nativeFunction(name, 'comparison-functions', [['first', 'any'], ['second', 'any']], 'boolean', summary)),
  ...[['nullIn', 'Tests membership, treating nulls as comparable.'], ['notNullIn', 'Tests non-membership, treating nulls as comparable.'], ['globalNullIn', 'Tests membership, treating nulls as comparable and distributing the set.'], ['globalNotNullIn', 'Tests non-membership, treating nulls as comparable and distributing the set.']].map(([name, summary]) => nativeFunction(name, 'in-functions', [['value', 'any'], ['set', 'record']], 'boolean', summary)),
  ...[['assumeNotNull', 'Removes native nullability; the result for null input is arbitrary.'], ['toNullable', 'Adds native nullability, preserving the coarse input type. Native restrictions on nullable compound types apply.']].map(([name, summary]) => nativeFunction(name, 'functions-for-nulls', [['value', 'T']], 'T', summary)),
  ...[['isNull', 'Tests whether a value is null.'], ['isNotNull', 'Tests whether a value is non-null.'], ['isNullable', 'Tests whether the native type is nullable.']].map(([name, summary]) => nativeFunction(name, 'functions-for-nulls', [['value', 'any']], 'boolean', summary)),
  nativeFunction('isZeroOrNull', 'functions-for-nulls', [['value', 'number']], 'boolean', 'Tests whether a numeric value is zero or null.'),
  nativeFunction('firstNonDefault', 'functions-for-nulls', [['values', 'number...']], 'number', 'Returns the first non-default numeric value (25.9+). Other common-supertype forms require multi-argument result inference.'),
  nativeFunction('clamp', 'conditional-functions', [['value', 'number'], ['min', 'number'], ['max', 'number']], 'number', 'Restricts a number to the supplied bounds. Non-numeric common-supertype forms are not exposed.'),
  {
    name: 'coalesce',
    metadata: 'selection',
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
    metadata: 'selection',
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
    metadata: 'idempotent',
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
  nativeFunction('tumble', 'time-window-functions', [['time', 'timestamp'], ['interval', 'interval'], ['timezone', 'string?']], 'record', 'Returns a tumbling window tuple; interval must be positive. Tuple elements are Date or DateTime depending on interval kind.'),
  nativeFunction('hop', 'time-window-functions', [['time', 'timestamp'], ['hop', 'interval'], ['window', 'interval'], ['timezone', 'string?']], 'record', 'Returns a hopping window tuple; intervals must be positive. Tuple elements are Date or DateTime depending on interval kind.'),
  ...['tumbleStart', 'tumbleEnd', 'hopStart', 'hopEnd'].map(name => nativeFunction(name, 'time-window-functions', [['window', 'number']], 'timestamp', 'Converts a native UInt32 boundary to DateTime. Standalone DateTime is invalid. Tuple and interval-based overloads are omitted because their result may be Date or DateTime.')),
  nativeFunction('timeSeriesRange', 'time-series-functions', [['start', 'timestamp'], ['end', 'timestamp'], ['step', 'number']], 'array<timestamp>', 'Returns a regular timestamp grid using a positive step in seconds.'),
  nativeFunction('timeSeriesFromGrid', 'time-series-functions', [['start', 'timestamp'], ['end', 'timestamp'], ['step', 'number'], ['values', 'array']], 'array<record>', 'Pairs grid timestamps with values, skipping null values; grid length must match the values.'),
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
    metadata: args => inferDuration(args[0]?.sql),
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
  // Generated date/time registry families. All timestamp precisions collapse to the timestamp type.
  ...['YYYYMMDDToDate', 'YYYYMMDDToDate32', 'fromDaysSinceYearZero', 'fromDaysSinceYearZero32'].map(name => nativeFunction(name, 'date-time-functions', [['value', 'number']], 'date', 'Constructs a date from a numeric YYYYMMDD value or a count of days since year zero.')),
  nativeFunction('YYYYMMDDhhmmssToDateTime', 'date-time-functions', [['value', 'number'], ['timezone', 'string?']], 'timestamp', 'Converts numeric YYYYMMDDhhmmss to a timestamp.'),
  nativeFunction('YYYYMMDDhhmmssToDateTime64', 'date-time-functions', [['value', 'number'], ['precision', 'number?'], ['timezone', 'string?']], 'timestamp', 'Converts numeric YYYYMMDDhhmmss to a timestamp with optional fractional precision.'),
  ...['makeDate', 'makeDate32'].map(name => nativeFunction(name, 'date-time-functions', [['year', 'number'], ['month_or_day_of_year', 'number'], ['day', 'number?']], 'date', 'Constructs a date from year and day-of-year, or year, month and day.')),
  nativeFunction('makeDateTime', 'date-time-functions', [['year', 'number'], ['month', 'number'], ['day', 'number'], ['hour', 'number'], ['minute', 'number'], ['second', 'number'], ['timezone', 'string?']], 'timestamp', 'Constructs a timestamp from calendar and clock components.'),
  nativeFunction('makeDateTime64', 'date-time-functions', [['year', 'number'], ['month', 'number'], ['day', 'number'], ['hour', 'number'], ['minute', 'number'], ['second', 'number'], ['fraction', 'number?'], ['precision', 'number?'], ['timezone', 'string?']], 'timestamp', 'Constructs a timestamp with optional fractional seconds and precision.'),
  ...['now64', 'nowInBlock64'].map(name => nativeFunction(name, 'date-time-functions', [['scale', 'number?'], ['timezone', 'string?']], 'timestamp', name == 'now64' ? 'Returns the query-analysis timestamp with optional fractional precision.' : 'Returns the block-processing timestamp with optional fractional precision.')),
  nativeFunction('nowInBlock', 'date-time-functions', [['timezone', 'string?']], 'timestamp', 'Returns the current timestamp at block processing time.'),
  nativeFunction('UTCTimestamp', 'date-time-functions', [], 'timestamp', 'Returns the current UTC timestamp at query analysis time.'),
  nativeFunction('localtime', 'date-time-functions', [], 'time', 'Returns the current time of day (26.7+).'),
  nativeFunction('yesterday', 'date-time-functions', [], 'date', 'Returns the date of yesterday.'),
  ...['timezone', 'serverTimezone'].map(name => nativeFunction(name, 'date-time-functions', [], 'string', name == 'timezone' ? 'Returns the session time zone name.' : 'Returns the server time zone name.')),
  nativeFunction('timezoneOf', 'date-time-functions', [['datetime', 'timestamp']], 'string', 'Returns the timezone attached to a timestamp.'),
  nativeFunction('timezoneOffset', 'date-time-functions', [['datetime', 'timestamp']], 'number', 'Returns the timestamp timezone offset from UTC, in seconds.'),
  ...[
    ['toTimezone', 'Changes the timezone annotation without changing the Unix timestamp.'],
    ['toUTCTimestamp', 'Converts local wall-clock time in the named timezone to UTC.'], ['fromUTCTimestamp', 'Converts UTC to local wall-clock time in the named timezone.'],
  ].map(([name, summary]) => nativeFunction(name, 'date-time-functions', [['datetime', 'timestamp'], ['timezone', 'string']], 'timestamp', summary)),
  ...['dateDiff', 'age'].map(name => nativeFunction(name, 'date-time-functions', [['unit', 'string'], ['start', ['date', 'timestamp']], ['end', ['date', 'timestamp']], ['timezone', 'string?']], 'number', name == 'dateDiff' ? 'Counts unit boundaries between two temporal values.' : 'Counts complete units between two temporal values.')),
  nativeFunction('timeDiff', 'date-time-functions', [['start', ['date', 'timestamp']], ['end', ['date', 'timestamp']]], 'number', 'Returns the temporal difference in seconds.'),
  nativeFunction('dateName', 'date-time-functions', [['part', 'string'], ['datetime', ['date', 'timestamp']], ['timezone', 'string?']], 'string', 'Returns the requested date component as text.'),
  nativeFunction('monthName', 'date-time-functions', [['datetime', ['date', 'timestamp']]], 'string', 'Returns the month name.'),
  nativeFunction('formatDateTimeInJodaSyntax', 'date-time-functions', [['datetime', ['date', 'timestamp']], ['format', 'string'], ['timezone', 'string?']], 'string', 'Formats a temporal value using Joda pattern syntax.'),
  nativeFunction('fromUnixTimestampInJodaSyntax', 'date-time-functions', [], 'timestamp', 'Converts a Unix timestamp, or formats it using Joda syntax when a format is supplied.', {overloads: [
    {args: [['value', ['number', 'date', 'timestamp']]], returns: 'timestamp'},
    {args: [['value', ['number', 'date', 'timestamp']], ['format', 'string'], ['timezone', 'string?']], returns: 'string'},
  ]}),
  ...['addDate', 'subDate'].map(name => nativeFunction(name, 'date-time-functions', [['datetime', 'timestamp'], ['interval', 'interval']], 'timestamp', 'Adds or subtracts an interval. Only timestamp input is exposed: Date results can become timestamps depending on the interval unit.')),
  ...['addTupleOfIntervals', 'subtractTupleOfIntervals'].map(name => nativeFunction(name, 'date-time-functions', [['datetime', 'timestamp'], ['intervals', 'record']], 'timestamp', 'Applies a tuple of intervals to a timestamp. Date-input promotion requires interval-dependent result inference.')),
  ...['addInterval', 'subtractInterval'].map(name => nativeFunction(name, 'date-time-functions', [['first', ['interval', 'record']], ['second', 'interval']], 'record', 'Combines intervals into a tuple, adding or subtracting matching units.')),
  ...['changeDay', 'changeMonth', 'changeYear'].map(name => nativeFunction(name, 'date-time-functions', [['datetime', ['date', 'timestamp']], ['value', 'number']], 'T', 'Replaces a calendar component, preserving the input temporal type.')),
  ...['changeHour', 'changeMinute', 'changeSecond'].map(name => nativeFunction(name, 'date-time-functions', [['datetime', ['date', 'timestamp']], ['value', 'number']], 'timestamp', 'Replaces a clock component, promoting Date inputs to timestamps.')),
  ...['toDaysInMonth', 'toISOYear', 'toMonthNumSinceEpoch', 'toYearNumSinceEpoch', ...['Day', 'Hour', 'Minute', 'Month', 'Quarter', 'Second', 'Week', 'Year'].map(unit => `toRelative${unit}Num`)].map(name => nativeFunction(name, 'date-time-functions', [['datetime', ['date', 'timestamp']]], 'number', 'Returns the named calendar quantity or relative unit number. Relative epochs are implementation details.')),
  ...['toDaysSinceYearZero', 'toISOWeek', 'toYYYYMM', 'toYYYYMMDD', 'toYYYYMMDDhhmmss'].map(name => nativeFunction(name, 'date-time-functions', [['datetime', ['date', 'timestamp']], ['timezone', 'string?']], 'number', 'Returns the named numeric representation of a date or timestamp.')),
  ...['toMicrosecond', 'toMillisecond', 'toNanosecond'].map(name => nativeFunction(name, 'date-time-functions', [['datetime', 'timestamp']], 'number', 'Returns the fractional-second component of a timestamp. Microsecond and nanosecond extraction require DateTime64.')),
  ...['toLastDayOfMonth', 'toMonday', 'toStartOfISOYear'].map(name => nativeFunction(name, 'date-time-functions', [['datetime', ['date', 'timestamp']]], 'date', 'Returns the corresponding month-end, Monday, or ISO-year-start date.')),
  nativeFunction('toLastDayOfWeek', 'date-time-functions', [['datetime', ['date', 'timestamp']], ['mode', 'number?'], ['timezone', 'string?']], 'date', 'Rounds up to the nearest week-ending date according to the requested mode.'),
  nativeFunction('toYearWeek', 'date-time-functions', [['datetime', ['date', 'timestamp']], ['mode', 'number?'], ['timezone', 'string?']], 'number', 'Returns the combined year and week number.'),
  nativeFunction('year', 'date-time-functions', [['datetime', ['date?', 'timestamp']]], 'number', 'Returns the year of a temporal value, or the current year when omitted.'),
  ...['toStartOfHour', 'toStartOfFiveMinutes', 'toStartOfTenMinutes', 'toStartOfFifteenMinutes'].map(name => nativeFunction(name, 'date-time-functions', [['datetime', 'timestamp']], 'timestamp', 'Rounds down to the corresponding clock boundary.')),
  ...['toStartOfSecond', 'toStartOfMicrosecond', 'toStartOfMillisecond', 'toStartOfNanosecond', 'toTimeWithFixedDate', 'timeSlot'].map(name => nativeFunction(name, 'date-time-functions', [['datetime', 'timestamp'], ['timezone', 'string?']], 'timestamp', 'Truncates timestamp precision, extracts a fixed-date time, or rounds to a half-hour slot. Subsecond truncation requires DateTime64.')),
  // Without an origin, month/year intervals return Date but day/hour intervals return DateTime.
  // The origin overload always returns a timestamp; do not conflate its third argument with the timezone form.
  nativeFunction('toStartOfInterval', 'date-time-functions', [['datetime', 'timestamp'], ['interval', 'interval'], ['origin', 'timestamp'], ['timezone', 'string?']], 'timestamp', 'Rounds a timestamp to an interval aligned to an explicit timestamp origin. The no-origin forms need interval-dependent result inference and are not exposed.'),
  nativeFunction('timeSlots', 'date-time-functions', [['start', 'timestamp'], ['duration', ['number', 'timestamp']], ['size', ['number?', 'timestamp']]], 'array<timestamp>', 'Returns timestamp slots covering the requested interval.'),
  ...['fromModifiedJulianDay', 'fromModifiedJulianDayOrNull'].map(name => nativeFunction(name, 'date-time-functions', [['day', 'number']], 'string', 'Converts a Modified Julian Day number to a date string, optionally returning null on failure.')),
  ...['toModifiedJulianDay', 'toModifiedJulianDayOrNull'].map(name => nativeFunction(name, 'date-time-functions', [['date', 'string']], 'number', 'Converts a date string to a Modified Julian Day number, optionally returning null on failure.')),
  nativeFunction('kqlDateTimeBinAt', 'arithmetic-functions', [['value', 'timestamp'], ['bin_size', 'interval'], ['fixed_point', 'timestamp']], 'timestamp', 'Rounds a DateTime64 to a timespan multiple counted from a DateTime64 fixed point (26.8+); Date and DateTime are rejected natively.'),
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

// Merge native runtime aliases for both compact and legacy definitions without replacing their existing gsql aliases.
for (let [name, aliases] of Object.entries(clickHouseAliases)) {
  for (let def of clickHouseFunctions.filter(def => (def.sqlName || def.name).toLowerCase() == name.toLowerCase())) {
    def.aliases = [...new Set([...(def.aliases || []), ...aliases])]
  }
}
