import {type SyntaxNode} from '@lezer/common'

import type {Analyzer} from './analyze.ts'
import type {FunctionDef, ArgDef} from './functionTypes.ts'

import {bigQueryFunctions} from './bigQueryFunctions.ts'
import {clickHouseFunctions} from './clickHouseFunctions.ts'
import {duckDbFunctions} from './duckDbFunctions.ts'
import {extendFanoutPath, mergeFanoutPaths, mergeSensitiveFanouts, normalizeExprFanout} from './fanout.ts'
import {snowflakeFunctions} from './snowflakeFunctions.ts'
import {arrayOf, scalarType, type Expr, type FieldMeta, type FieldType, isArrayType, isScalarType, type Scope, type TimeGrain, type TypeKind} from './types.ts'
import {txt} from './util.ts'

// The shape that analyzeFunction works with. Converted from FunctionDef at startup.
interface Overload {
  params: {name: string; allowedTypes: {type: TypeKind; rawType?: string}[]; isVariadic?: boolean}[]
  returnType: {type: FieldType | 'generic' | 'array'; expressionType?: 'aggregate' | 'scalar' | 'window'}
  fanoutSafe?: boolean
  sqlName?: string
  supportsBareInvocation?: boolean
  bareSqlName?: string
}

// Convert a FunctionDef arg type string (e.g. 'number', 'T', 'string...', 'kw') to allowedTypes
function parseArgType(typeStr: string): {type: TypeKind; rawType?: string}[] {
  let base = typeStr.replace(/[?.]/g, '')
  if (base === 'kw') return [{type: 'sql native', rawType: 'kw'}]
  if (base === 'T' || base === 'any') return ['string', 'number', 'boolean', 'date', 'timestamp', 'json', 'array'].map(type => ({type: type as TypeKind}))
  if (base === 'array') return [{type: 'array'}]
  return [{type: base as TypeKind}]
}

function getArgInfo(arg: ArgDef): {name: string; type: string} {
  let [name, type] = Array.isArray(arg) ? [arg[0], arg[1]] : [arg.name, arg.type]
  return {name, type: Array.isArray(type) ? type[0] : type}
}

function parseArgTypes(arg: ArgDef): {type: TypeKind; rawType?: string}[] {
  let type = Array.isArray(arg) ? arg[1] : arg.type
  if (Array.isArray(type)) return type.map(t => ({type: t as TypeKind}))
  return parseArgType(type)
}

// Convert a FunctionDef into one or more Overloads (optional args expand into multiple overloads)
function convertDef(def: FunctionDef): Overload[] {
  let expressionType: 'aggregate' | 'window' | 'scalar' = 'scalar'
  if (def.aggregate) expressionType = 'aggregate'
  else if (def.window) expressionType = 'window'
  let returnType = def.returns === 'T' ? ('generic' as const) : normalizeReturnType(def.returns)

  let argSets: ArgDef[][] = [def.args]
  // If any args are optional (type ends with '?'), expand into multiple overloads
  let optIdx = def.args.findIndex(a => getArgInfo(a).type.endsWith('?'))
  if (optIdx >= 0) {
    argSets = []
    for (let i = optIdx; i <= def.args.length; i++) argSets.push(def.args.slice(0, i))
  }

  return argSets.map(args => ({
    params: args.map(a => {
      let {name, type} = getArgInfo(a)
      return {name, allowedTypes: parseArgTypes(a), isVariadic: type.endsWith('...')}
    }),
    returnType: {type: returnType, expressionType},
    fanoutSafe: def.fanoutSafe,
    sqlName: def.sqlName,
    supportsBareInvocation: def.supportsBareInvocation && args.length == 0,
    bareSqlName: def.bareSqlName,
  }))
}

function normalizeReturnType(type: string): FieldType | 'array' {
  if (type == 'array') return 'array'
  if (type == 'bytes') return scalarType('string')
  return scalarType(type as Exclude<TypeKind, 'array'>)
}

// Build a name -> Overload[] map from a FunctionDef array
function buildMap(defs: FunctionDef[]): Record<string, Overload[]> {
  let map: Record<string, Overload[]> = {}
  for (let def of defs) {
    let overloads = convertDef(def)
    map[def.name] = overloads
    // Register aliases, ensuring they emit the original SQL name
    for (let alias of def.aliases || []) {
      map[alias] = overloads.map(o => ({...o, sqlName: o.sqlName || def.name}))
    }
  }
  return map
}

let dialectMaps: Record<string, Record<string, Overload[]>> = {
  bigquery: buildMap(bigQueryFunctions),
  clickhouse: buildMap(clickHouseFunctions),
  duckdb: buildMap(duckDbFunctions),
  snowflake: buildMap(snowflakeFunctions),
}

function findOverloads(name: string, dialect: string): Overload[] {
  let map = dialectMaps[dialect] || dialectMaps['duckdb']
  return map[name.toLowerCase()] || []
}

// ============================================================================
// Function Call Analysis
// ============================================================================

export function analyzeFunction(analyzer: Analyzer, node: SyntaxNode, scope: Scope, opts: {isWindow?: boolean} = {}): Expr {
  let name = txt(node.getChild('Identifier')).toLowerCase()
  let argNodes = node.getChildren('Expression')
  return analyzeNamedFunction(analyzer, node, name, argNodes, scope, opts)
}

export function analyzeBareFunction(analyzer: Analyzer, node: SyntaxNode, name: string, scope: Scope, opts: {isWindow?: boolean} = {}): Expr | undefined {
  let overloads = findOverloads(name, analyzer.config.dialect)
  if (overloads.length == 0) return
  let overload = overloads.find(o => o.supportsBareInvocation && o.params.length == 0)
  if (!overload) return
  return analyzeResolvedFunction(name, overload, [], [], scope, {...opts, bare: true})
}

function analyzeNamedFunction(analyzer: Analyzer, node: SyntaxNode, name: string, argNodes: SyntaxNode[], scope: Scope, opts: {isWindow?: boolean} = {}): Expr {
  // Check for percentile functions (p50, p90, etc.) before overload lookup
  let percentileMatch = /^p(\d+)$/.exec(name)
  if (percentileMatch) {
    let args = argNodes.map(n => analyzer.analyzeExpr(n, scope))
    if (args[0]) analyzer.checkTypes(args[0], ['number'], argNodes[0])
    return analyzePercentile(analyzer, node, args, percentileMatch[1], scope, opts)
  }

  // Find matching overload
  let overloads = findOverloads(name, analyzer.config.dialect)
  let overload = overloads.find(o => {
    if (o.params.length == argNodes.length) return true
    if (!o.params.some(p => p.isVariadic)) return false
    let requiredCount = o.params.filter(p => !p.isVariadic).length || 1
    return argNodes.length >= requiredCount
  })

  // Analyze arguments and check types against overload
  let args = argNodes.map((argNode, idx) => {
    let paramIdx = idx
    if (overload && paramIdx >= overload.params.length) {
      let lastParam = overload.params[overload.params.length - 1]
      if (lastParam?.isVariadic) paramIdx = overload.params.length - 1
    }
    let firstType = overload?.params[paramIdx]?.allowedTypes[0]
    if (firstType?.type == 'sql native' && firstType?.rawType === 'kw') {
      return {sql: txt(argNode), type: scalarType('sql native')}
    }
    let arg = analyzer.analyzeExpr(argNode, scope)
    let allowed = overload?.params[paramIdx]?.allowedTypes.map(t => t.type)
    if (allowed) analyzer.checkTypes(arg, allowed, argNode)
    return arg
  })

  if (!overload) {
    if (overloads.length === 0) return analyzer.diag(node, `Unknown function: ${name}`, {sql: 'NULL', type: scalarType('error')})
    let expected = [...new Set(overloads.map(o => o.params.length))].sort().join(' or ')
    return analyzer.diag(node, `Wrong number of arguments for ${name}: expected ${expected}, got ${argNodes.length}`, {sql: 'NULL', type: scalarType('error')})
  }

  return analyzeResolvedFunction(name, overload, args, argNodes, scope, opts)
}

function analyzeResolvedFunction(name: string, overload: Overload, args: Expr[], argNodes: SyntaxNode[], scope: Scope, opts: {isWindow?: boolean; bare?: boolean} = {}): Expr {
  let returnType: FieldType = overload.returnType.type as FieldType
  if (overload.returnType.type == 'generic') returnType = args[0]?.type || scalarType('string')
  if (overload.returnType.type == 'array') returnType = inferArrayReturnType(args)

  let isAgg = overload.returnType.expressionType == 'aggregate' || args.some(a => a.isAgg)
  let canWindow = overload.returnType.expressionType == 'aggregate' || overload.returnType.expressionType == 'window'
  let fanout = mergeFanoutPaths(args.map(a => a.fanout?.path))
  let fanoutConflict = fanout.conflict || args.some(a => a.fanout?.conflict)
  let fanoutSensitivePaths = mergeSensitiveFanouts(...args.map(a => a.fanout?.sensitivePaths))
  let fanoutSafeAgg = overload.returnType.expressionType == 'aggregate' && overload.fanoutSafe
  if (overload.returnType.expressionType == 'aggregate' && !fanoutSafeAgg) {
    fanoutSensitivePaths = mergeSensitiveFanouts(fanoutSensitivePaths, [fanout.path || extendFanoutPath(scope.fanoutPath)])
  }
  let fnName = opts.bare ? overload.bareSqlName || overload.sqlName || name : overload.sqlName || name
  let sql = opts.bare ? fnName : `${fnName}(${args.map(a => a.sql).join(',')})`
  let metadata = inferFunctionFieldMetadata(name, overload, args, argNodes)
  return {
    sql,
    type: returnType,
    metadata,
    isAgg,
    canWindow,
    fanout: normalizeExprFanout({path: isAgg ? undefined : fanout.path, sensitivePaths: fanoutSensitivePaths, conflict: fanoutConflict}),
  }
}

function analyzePercentile(analyzer: Analyzer, node: SyntaxNode, args: Expr[], digits: string, scope: Scope, opts: {isWindow?: boolean} = {}): Expr {
  let frac = Number(`0.${digits}`)
  if (Number(digits) == 100) return analyzer.diag(node, 'p100 is not allowed', {sql: 'NULL', type: scalarType('error')})
  if (Number(digits) == 0) return analyzer.diag(node, 'p0 is not allowed', {sql: 'NULL', type: scalarType('error')})
  if (analyzer.config.dialect == 'bigquery' && frac > 0.99) return analyzer.diag(node, 'BigQuery only supports up to p99', {sql: 'NULL', type: scalarType('error')})

  let inner = args[0]?.sql || 'NULL'
  let sql: string
  switch (analyzer.config.dialect) {
    case 'duckdb':
      sql = `quantile_cont(${inner}, ${frac})`
      break
    case 'bigquery':
      if (opts.isWindow) {
        sql = `PERCENTILE_CONT(${inner}, ${frac})`
      } else {
        sql = `approx_quantiles(${inner}, 100)[OFFSET(${Math.round(frac * 100)})]`
      }
      break
    case 'clickhouse':
      sql = `quantile(${frac})(${inner})`
      break
    case 'snowflake':
      sql = `PERCENTILE_CONT(${frac}) WITHIN GROUP (ORDER BY ${inner})`
      break
    default:
      return analyzer.diag(node, `Percentile not supported for ${analyzer.config.dialect}`, {sql: 'NULL', type: scalarType('error')})
  }
  return {
    sql,
    type: scalarType('number'),
    isAgg: true,
    canWindow: true,
    fanout: normalizeExprFanout({
      sensitivePaths: [args[0]?.fanout?.path || extendFanoutPath(opts.isWindow ? undefined : scope.fanoutPath)],
      conflict: args.some(a => a.fanout?.conflict),
    }),
  }
}

function inferFunctionFieldMetadata(name: string, overload: Overload, args: Expr[], argNodes: SyntaxNode[]): FieldMeta | undefined {
  if (name != 'date_trunc') return

  let partIdx = overload.params.findIndex(param => param.name.includes('part'))
  if (partIdx < 0 || !args[partIdx]) return
  if (!isScalarType(args[partIdx].type, 'string') && !isScalarType(args[partIdx].type, 'sql native')) return

  let timeGrain = inferTemporalMetadata(txt(argNodes[partIdx]))
  if (!timeGrain) return
  return {timeGrain}
}

// date_trunc part syntax varies by dialect:
// - BigQuery commonly uses bare keywords like `month`, plus special values like `isoweek` and `week(monday)`.
// - DuckDB and Snowflake typically pass the part as a string literal like `'month'`.
// We normalize the supported forms into our shared grain enum and intentionally drop any finer detail.
function inferTemporalMetadata(rawPart: string): TimeGrain | undefined {
  let normalized = rawPart
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase()
  if (!normalized) return

  if (/^week(?:\([a-z]+\))?$/.test(normalized) || normalized == 'isoweek') return 'week'
  if (normalized == 'isoyear') return 'year'
  return normalizeTemporalGrain(normalized)
}

function normalizeTemporalGrain(value: string): TimeGrain | undefined {
  let grains: Record<string, TimeGrain> = {
    year: 'year',
    quarter: 'quarter',
    month: 'month',
    day: 'day',
    hour: 'hour',
    minute: 'minute',
    second: 'second',
  }
  return grains[value]
}

function inferArrayReturnType(args: Expr[]): FieldType {
  let arrayArg = args.find(arg => isArrayType(arg.type))
  if (arrayArg && isArrayType(arrayArg.type)) return arrayArg.type

  let scalarArg = args.find(arg => !isScalarType(arg.type, 'sql native') && !isScalarType(arg.type, 'error') && !isScalarType(arg.type, 'null'))
  if (scalarArg) return arrayOf(scalarArg.type)

  return arrayOf(scalarType('sql native'))
}
