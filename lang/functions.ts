import {type SyntaxNode} from '@lezer/common'

import type {FunctionDef, ArgDef} from './functionTypes.ts'

import {diag, checkTypes} from './analyze.ts'
import {bigQueryFunctions} from './bigQueryFunctions.ts'
import {config} from './config.ts'
import {duckDbFunctions} from './duckDbFunctions.ts'
import {extendFanoutPath, mergeFanoutPaths, mergeSensitiveFanouts, normalizeExprFanout} from './fanout.ts'
import {snowflakeFunctions} from './snowflakeFunctions.ts'
import {parseTemporalGrain, temporalType} from './temporal.ts'
import {isTemporalType, mergeTypes} from './typeRelations.ts'
import {type Expr, type FieldType, type FieldTypeBase, type Scope} from './types.ts'
import {txt} from './util.ts'

// The shape that analyzeFunction works with. Converted from FunctionDef at startup.
interface Overload {
  params: {name: string; allowedTypes: {type: FieldType | 'sql native'; rawType?: string}[]; isVariadic?: boolean}[]
  returnType: {type: FieldType | 'generic'; expressionType?: 'aggregate' | 'scalar' | 'window'}
  fanoutSafe?: boolean
  sqlName?: string
}

// Convert a FunctionDef arg type string (e.g. 'number', 'T', 'string...', 'kw') to allowedTypes
function parseArgType(typeStr: string): {type: FieldType | 'sql native'; rawType?: string}[] {
  let base = typeStr.replace(/[?.]/g, '')
  if (base === 'kw') return [{type: 'sql native', rawType: 'kw'}]
  if (base === 'T' || base === 'any') return ['string', 'number', 'boolean', 'date', 'timestamp', 'json'].map(base => ({type: {base: base as FieldTypeBase}}))
  return [{type: {base: base as FieldTypeBase}}]
}

function getArgInfo(arg: ArgDef): {name: string; type: string} {
  let [name, type] = Array.isArray(arg) ? [arg[0], arg[1]] : [arg.name, arg.type]
  return {name, type: Array.isArray(type) ? type[0] : type}
}

function parseArgTypes(arg: ArgDef): {type: FieldType | 'sql native'; rawType?: string}[] {
  let type = Array.isArray(arg) ? arg[1] : arg.type
  if (Array.isArray(type)) return type.map(t => ({type: {base: t as FieldTypeBase}}))
  return parseArgType(type)
}

// Convert a FunctionDef into one or more Overloads (optional args expand into multiple overloads)
function convertDef(def: FunctionDef): Overload[] {
  let expressionType: 'aggregate' | 'window' | 'scalar' = 'scalar'
  if (def.aggregate) expressionType = 'aggregate'
  else if (def.window) expressionType = 'window'
  let returnType = def.returns === 'T' ? ('generic' as const) : {base: def.returns as FieldTypeBase}

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
  }))
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

type AnalyzeExprFn = (node: SyntaxNode, scope: Scope) => Expr
type AnalyzedArg = Expr | {sql: string; type: 'sql native'}

export function analyzeFunction(node: SyntaxNode, scope: Scope, analyzeExpr: AnalyzeExprFn, opts: {isWindow?: boolean} = {}): Expr {
  let name = txt(node.getChild('Identifier')).toLowerCase()
  let argNodes = node.getChildren('Expression')

  // Check for percentile functions (p50, p90, etc.) before overload lookup
  let percentileMatch = /^p(\d+)$/.exec(name)
  if (percentileMatch) {
    let args = argNodes.map(n => analyzeExpr(n, scope))
    if (args[0]) checkTypes(args[0], [{base: 'number'}], argNodes[0])
    return analyzePercentile(node, args, percentileMatch[1], scope, opts)
  }

  // Find matching overload
  let overloads = findOverloads(name, config.dialect)
  let overload = overloads.find(o => {
    if (o.params.length == argNodes.length) return true
    if (!o.params.some(p => p.isVariadic)) return false
    let requiredCount = o.params.filter(p => !p.isVariadic).length || 1
    return argNodes.length >= requiredCount
  })

  // Analyze arguments and check types against overload
  let args = argNodes.map((argNode, idx): AnalyzedArg => {
    let paramIdx = idx
    if (overload && paramIdx >= overload.params.length) {
      let lastParam = overload.params[overload.params.length - 1]
      if (lastParam?.isVariadic) paramIdx = overload.params.length - 1
    }
    let firstType = overload?.params[paramIdx]?.allowedTypes[0]
    if (firstType?.type === 'sql native' && firstType?.rawType === 'kw') {
      return {sql: txt(argNode), type: 'sql native'}
    }
    let arg = analyzeExpr(argNode, scope)
    let allowed = overload?.params[paramIdx]?.allowedTypes.flatMap(t => (t.type === 'sql native' ? [] : [t.type]))
    if (allowed) checkTypes(arg, allowed, argNode)
    return arg
  })

  if (!overload) {
    if (overloads.length === 0) return diag(node, `Unknown function: ${name}`, {sql: 'NULL', type: {base: 'error'}})
    let expected = [...new Set(overloads.map(o => o.params.length))].sort().join(' or ')
    return diag(node, `Wrong number of arguments for ${name}: expected ${expected}, got ${argNodes.length}`, {sql: 'NULL', type: {base: 'error'}})
  }

  let returnType: FieldType = overload.returnType.type as FieldType
  if (overload.returnType.type == 'generic') returnType = firstValueArg(args)?.type || {base: 'string'}
  returnType = inferFunctionReturnType(name, args, returnType)

  let valueArgs = args.filter(isValueArg)
  let isAgg = overload.returnType.expressionType == 'aggregate' || valueArgs.some(a => a.isAgg)
  let canWindow = overload.returnType.expressionType == 'aggregate' || overload.returnType.expressionType == 'window'
  let fanout = mergeFanoutPaths(valueArgs.map(a => a.fanout?.path))
  let fanoutConflict = fanout.conflict || valueArgs.some(a => a.fanout?.conflict)
  let fanoutSensitivePaths = mergeSensitiveFanouts(...valueArgs.map(a => a.fanout?.sensitivePaths))
  let fanoutSafeAgg = overload.returnType.expressionType == 'aggregate' && overload.fanoutSafe
  if (overload.returnType.expressionType == 'aggregate' && !fanoutSafeAgg) {
    fanoutSensitivePaths = mergeSensitiveFanouts(fanoutSensitivePaths, [fanout.path || extendFanoutPath(scope.fanoutPath)])
  }
  let fnName = overload.sqlName || name
  let sql = `${fnName}(${args.map(a => a.sql).join(',')})`
  return {
    sql,
    type: returnType,
    isAgg,
    canWindow,
    fanout: normalizeExprFanout({path: isAgg ? undefined : fanout.path, sensitivePaths: fanoutSensitivePaths, conflict: fanoutConflict}),
  }
}

function inferFunctionReturnType(name: string, args: AnalyzedArg[], returnType: FieldType): FieldType {
  let valueArgs = args.filter(isValueArg)
  if (['coalesce', 'ifnull', 'least', 'greatest'].includes(name)) return mergeTypes(valueArgs.map(arg => arg.type)) || returnType
  if (['if', 'iff'].includes(name)) return mergeTypes(valueArgs.slice(1).map(arg => arg.type)) || returnType
  if (name != 'date_trunc') return returnType
  let unitArg = args.find(arg => arg.type == 'sql native') || valueArgs.find(arg => arg.type.base == 'string' && /^['"].*['"]$/.test(arg.sql))
  if (!unitArg) return returnType
  let grain = parseTemporalGrain(unitArg.sql.replace(/^['"]|['"]$/g, ''))
  let source = valueArgs.find(arg => isTemporalType(arg.type))
  if (!grain || !source) return returnType
  return temporalType(source.type.base as 'date' | 'timestamp', grain)
}

function isValueArg(arg: AnalyzedArg): arg is Expr {
  return arg.type !== 'sql native'
}

function firstValueArg(args: AnalyzedArg[]) {
  return args.find(isValueArg)
}

function analyzePercentile(node: SyntaxNode, args: Expr[], digits: string, scope: Scope, opts: {isWindow?: boolean} = {}): Expr {
  let frac = Number(`0.${digits}`)
  if (Number(digits) == 100) return diag(node, 'p100 is not allowed', {sql: 'NULL', type: {base: 'error'}})
  if (Number(digits) == 0) return diag(node, 'p0 is not allowed', {sql: 'NULL', type: {base: 'error'}})
  if (config.dialect == 'bigquery' && frac > 0.99) return diag(node, 'BigQuery only supports up to p99', {sql: 'NULL', type: {base: 'error'}})

  let inner = args[0]?.sql || 'NULL'
  let sql: string
  switch (config.dialect) {
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
    case 'snowflake':
      sql = `PERCENTILE_CONT(${frac}) WITHIN GROUP (ORDER BY ${inner})`
      break
    default:
      return diag(node, `Percentile not supported for ${config.dialect}`, {sql: 'NULL', type: {base: 'error'}})
  }
  return {
    sql,
    type: {base: 'number'},
    isAgg: true,
    canWindow: true,
    fanout: normalizeExprFanout({
      sensitivePaths: [args[0]?.fanout?.path || extendFanoutPath(opts.isWindow ? undefined : scope.fanoutPath)],
      conflict: args.some(a => a.fanout?.conflict),
    }),
  }
}
