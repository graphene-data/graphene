import {type SyntaxNode, type SyntaxNodeRef} from '@lezer/common'
import {type AggregateFunctionType, type AtomicTypeDef, type DefinitionBlueprintMap, type DefinitionBlueprint, type DialectFunctionOverloadDef, type FunctionOverloadDef, GlobalNameSpace, DialectNameSpace, getDialect, registerDialect, StandardSQLDialect, SnowflakeDialect as MalloySnowflakeDialect, DuckDBDialect as MalloyDuckDBDialect, expandBlueprintMap} from '@graphenedata/malloy'
import {config} from './config.ts'
import {txt, walkExpression} from './util.ts'
import type {Expression, Scope, FieldType} from './types.ts'
import {analyzeExpression, checkTypes, diag} from './analyze.ts'
import {bigQueryFunctions} from './bigQueryFunctions.ts'
import {duckDbFunctions} from './duckDbFunctions.ts'
import {snowflakeFunctions} from './snowflakeFunctions.ts'
import type {FunctionDef, ArgDef} from './functionTypes.ts'

export type AnalyzeExpressionFn = (expr: SyntaxNode, scope: Scope) => Expression
export type CheckTypesFn = (expr: Expression, expected: FieldType[], node: SyntaxNode) => void
export type DiagFn = <T>(node: SyntaxNode | SyntaxNodeRef, message: string, defaultReturn?: T) => T

// ============================================================================
// FunctionDef to Malloy Blueprint Conversion
// ============================================================================

// Get arg info from ArgDef
function getArgInfo (arg: ArgDef): {name: string; type: string} {
  if (Array.isArray(arg)) {
    return {name: arg[0], type: arg[1]}
  }
  return {name: arg.name, type: arg.type}
}

// Check if an arg type is optional
function isOptionalArg (typeStr: string): boolean {
  return typeStr.endsWith('?')
}

// Convert our FunctionDef format to Malloy's DefinitionBlueprint format
function convertToMalloyBlueprint (def: FunctionDef): DefinitionBlueprint {
  // Check if we have optional arguments - if so, we need to generate multiple overloads
  let optionalStartIdx = def.args.findIndex(arg => isOptionalArg(getArgInfo(arg).type))

  if (optionalStartIdx >= 0) {
    // Generate overloads: one for each possible number of args from required up to all args
    let overloads: Record<string, any> = {}
    let requiredArgs = def.args.slice(0, optionalStartIdx)
    let optionalArgs = def.args.slice(optionalStartIdx)

    // Generate overload names based on arg count
    for (let i = 0; i <= optionalArgs.length; i++) {
      let argsForOverload = [...requiredArgs, ...optionalArgs.slice(0, i)]
      let overloadName = i === 0 ? 'no_opt' : `opt_${i}`
      overloads[overloadName] = buildSingleOverload(def, argsForOverload)
    }

    return overloads as any
  }

  // No optional args - single overload
  return buildSingleOverload(def, def.args)
}

// Build a single overload blueprint from a function def and its args
function buildSingleOverload (def: FunctionDef, args: ArgDef[]): any {
  let takes: Record<string, any> = {}
  let hasGeneric = false

  for (let arg of args) {
    let {name, type: typeStr} = getArgInfo(arg)
    // Strip the optional marker for the actual type
    typeStr = typeStr.replace('?', '')
    let type: any = parseArgType(typeStr, def.aggregate)
    if (typeStr.includes('T')) {
      hasGeneric = true
    }
    takes[name] = type
  }

  let returns: any = def.returns
  if (def.returns === 'T') {
    returns = {generic: 'T'}
  }
  if (def.aggregate) {
    returns = {measure: returns}
  }

  // Determine the implementation
  let impl: any
  let sqlName = def.sqlName || def.name.toUpperCase()
  if (def.sqlTemplate) {
    impl = {sql: def.sqlTemplate}
  } else {
    impl = {function: sqlName}
  }

  let blueprint: any = {
    takes,
    returns,
    impl,
  }

  if (hasGeneric) {
    blueprint.generic = {T: ['any']}
  }

  return blueprint
}

// Parse argument type string into Malloy type format
function parseArgType (typeStr: string, isAggregate?: boolean): any {
  let isVariadic = typeStr.endsWith('...')
  let baseType = typeStr.replace(/[?.]*/g, '')

  // Handle 'kw' type for SQL keywords
  if (baseType === 'kw') {
    return {sql_native: 'kw'}
  }

  // Handle generic types
  if (baseType === 'T') {
    let type: any = {generic: 'T'}
    if (isAggregate) type = {dimension: type}
    if (isVariadic) type = {variadic: type}
    return type
  }

  // Handle basic types
  let type: any = baseType
  if (isAggregate && !isVariadic) {
    type = {dimension: baseType}
  }
  if (isVariadic) {
    type = {variadic: baseType}
  }

  return type
}

// Build function map from FunctionDef array
function buildFunctionMap (functions: FunctionDef[]): DefinitionBlueprintMap {
  return Object.fromEntries(
    functions.map(fn => [fn.name, convertToMalloyBlueprint(fn)]),
  )
}

// ============================================================================
// Dialect Function Maps
// ============================================================================

export let BIGQUERY_DIALECT_FUNCTIONS: DefinitionBlueprintMap = buildFunctionMap(bigQueryFunctions)
export let DUCKDB_DIALECT_FUNCTIONS: DefinitionBlueprintMap = buildFunctionMap(duckDbFunctions)
export let SNOWFLAKE_DIALECT_FUNCTIONS: DefinitionBlueprintMap = buildFunctionMap(snowflakeFunctions)

// ============================================================================
// Dialect Registration
// ============================================================================

// Malloy doesn't provide a dialect for BigQuery, so create one.
class BigQueryDialect extends StandardSQLDialect {
  constructor () {
    super()
    this.name = 'bigquery'
  }

  getDialectFunctions (): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(BIGQUERY_DIALECT_FUNCTIONS)
  }
}

// Extend Malloy's DuckDBDialect with our function definitions (replacing Malloy's built-ins)
class DuckDBDialect extends MalloyDuckDBDialect {
  getDialectFunctions (): {[name: string]: DialectFunctionOverloadDef[]} {
    // Use our functions exclusively, not merging with Malloy's
    return expandBlueprintMap(DUCKDB_DIALECT_FUNCTIONS)
  }
}

// Extend Malloy's SnowflakeDialect with our function definitions
class SnowflakeDialect extends MalloySnowflakeDialect {
  getDialectFunctions (): {[name: string]: DialectFunctionOverloadDef[]} {
    // Use our functions exclusively, not merging with Malloy's
    return expandBlueprintMap(SNOWFLAKE_DIALECT_FUNCTIONS)
  }
}

registerDialect(new BigQueryDialect()) // This must happen before we create the GlobalNameSpace
registerDialect(new DuckDBDialect())
registerDialect(new SnowflakeDialect())
let globalNamespace = new GlobalNameSpace()
let dialectNamespaces = new Map<string, DialectNameSpace>()

export function findOverloads (name: string, dialect: string): FunctionOverloadDef[] {
  if (!dialectNamespaces.has(dialect)) {
    dialectNamespaces.set(dialect, new DialectNameSpace(getDialect(dialect)))
  }
  let res = dialectNamespaces.get(dialect)!.getEntry(name) || globalNamespace.getEntry(name)
  return res?.entry ? (res.entry as any).overloads : []
}

// ============================================================================
// Function Call Analysis
// ============================================================================

let errExpr = {node: 'error', type: 'error'} as Expression

export function analyzeFunctionCall (expr: SyntaxNode, scope: Scope): Expression {
  let rawName = txt(expr.getChild('Identifier')).toLowerCase()
  let argNodes = expr.getChildren('Expression')

  let name = rawName as AggregateFunctionType

  // get the right overload for the args. Also check out malloy's `findOverload` for picking the right one
  let overload = findOverloads(name, config.dialect).find(o => {
    return o.params.length == argNodes.length || !!o.params.find(p => p.isVariadic)
  })

  // analyze each of the function arguments, ensuring its the right type
  let args = argNodes.map((node, idx) => {
    let firstType = overload?.params[idx]?.allowedTypes[0]
    if (firstType?.type === 'sql native' && firstType?.rawType === 'kw') {
      // some dialects allow special keywords as args in certain functions, like bigquery's `date_trunc(some_col, week)`
      return {node: 'genericSQLExpr' as const, kids: {args: []}, type: 'sql native', src: [txt(node)], isAgg: false}
    } else {
      let argExpr = analyzeExpression(node, scope)
      let allowed = overload?.params[idx]?.allowedTypes.map(at => at.type) as any
      if (allowed) checkTypes(argExpr, allowed, node)
      return argExpr
    }
  })

  let type = overload?.returnType.type
  if (type == 'generic') type = args[0]?.type as any || 'string'
  if (type && !isSupportedType(type)) {
    return diag(expr, `Unsupported function return type ${type} from function ${name}`, errExpr)
  }

  // Aggregates need a `structPath`, which in malloy is the `orders.users` in `orders.users.avg(age)`.
  // We'd rather you write `avg(orders.users.age)`, so we need to extract that path from the arguments.
  // These paths can be buried in complex expressions, so go find all of them.
  let structPaths = new Set<string>()
  args.forEach(a => walkExpression(a, e => {
    if (e.node != 'field') return
    structPaths.add(e.path.slice(0, -1).join('.') || scope.table.name)
  }))

  let ret: Expression
  let percentileMatch = /^p(\d+)$/.exec(rawName)

  if (['count', 'min', 'max', 'avg', 'sum'].includes(name.toLowerCase())) {
    let type: FieldType = 'number', typeDef: AtomicTypeDef | undefined
    if (['min', 'max', 'avg'].includes(name.toLowerCase())) {
      type = args[0].type as FieldType
      typeDef = (args[0] as any).typeDef
    }
    // malloy has a special node type for built-in aggregates
    ret = {node: 'aggregate', function: name, e: args[0], type, typeDef, isAgg: true}
  } else if (percentileMatch) {
    ret = analyzePercentile(expr, scope, percentileMatch[1], argNodes)
  } else if (overload && type) {
    // if we have an overload, it's a function call
    ret = {
      node: 'function_call', type, name, overload,
      expressionType: overload.returnType.expressionType || 'scalar',
      kids: {args: args as any},
      isAgg: overload.returnType.expressionType == 'aggregate' || args.some(a => a.isAgg),
    }
  } else {
    return diag(expr, `Unknown function: ${name}`, errExpr)
  }

  // Right now, we only support a single structPath in aggregate functions
  if (structPaths.size > 1 && (ret.node == 'aggregate' || (ret as any).expressionType == 'aggregate')) {
    return diag(expr, 'Graphene only supports a single table within aggregates. This one has: ' + Array.from(structPaths).join(', '), errExpr)
  }

  // Malloy is unhappy if structPath is undefined or empty, so only set it if we have one. Malloy also doesn't consider the base table as a structPath.
  let foriegnPaths = Array.from(structPaths).filter(p => p != scope.table.name)
  if (foriegnPaths.length > 0) ret.structPath = foriegnPaths[0].split('.')

  return ret
}

function isSupportedType (value: string): value is FieldType {
  let supported = ['string', 'number', 'boolean', 'date', 'timestamp', 'json', 'sql native', 'error', 'array', 'record', 'null', 'generic', 'interval']
  return supported.includes(value)
}

function analyzePercentile (callNode: SyntaxNode, scope: Scope, digits: string, argNodes: SyntaxNode[]): Expression {
  let frac = Number(`0.${digits}`)
  if (Number(digits) == 100) return diag(callNode, 'p100 is not allowed', errExpr)
  if (Number(digits) == 0) return diag(callNode, 'p0 is not allowed', errExpr)
  if (config.dialect == 'bigquery' && frac > 0.99) return diag(callNode, 'BigQuery only supports up to p99', errExpr)

  let valueExpr = analyzeExpression(argNodes[0], scope)
  checkTypes(valueExpr, ['number'], argNodes[0])

  let src: string[]
  switch (config.dialect) {
    case 'duckdb':
      src = ['quantile_cont(', `, ${frac})`]
      break
    case 'bigquery': {
      src = ['approx_quantiles(', `, 100)[OFFSET(${Math.round(frac * 10)})]`]
      break
    }
    case 'snowflake':
      src = [`PERCENTILE_CONT(${frac}) WITHIN GROUP (ORDER BY `, ')']
      break
    default:
      return diag(callNode, `Percentile functions are not supported for dialect ${config.dialect}`, errExpr)
  }

  return {
    node: 'genericSQLExpr',
    kids: {args: [valueExpr]},
    src,
    type: 'number',
    isAgg: true,
  }
}
