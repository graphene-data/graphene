import {coarseTemporalType, isTemporalType} from './temporal.ts'
import {type Expr, type FieldType, type TemporalBaseType} from './types.ts'

export function isSubtype(actual: FieldType, expected: FieldType) {
  if (actual == expected) return true
  if (isTemporalType(actual) && (expected == 'date' || expected == 'timestamp')) return true
  return false
}

export function commonType(left: FieldType | null, right: FieldType | null): FieldType | null {
  if (!left || left == 'null' || left == 'error') return right
  if (!right || right == 'null' || right == 'error') return left
  if (left == right) return left
  if (isTemporalType(left) && isTemporalType(right)) return coarseTemporalType(left)
  return right
}

export function mergeTypes(types: (FieldType | null | undefined)[]) {
  return types.reduce<FieldType | null>((merged, type) => commonType(merged, type || null), null)
}

export function temporalBaseType(expr: Pick<Expr, 'type' | 'baseType'> | {type: FieldType; baseType?: TemporalBaseType}): TemporalBaseType | undefined {
  if (!isTemporalType(expr.type)) return undefined
  return expr.baseType || coarseTemporalType(expr.type)
}

export function commonBaseType(exprs: {type: FieldType; baseType?: TemporalBaseType}[]) {
  let temporalExprs = exprs.filter(expr => isTemporalType(expr.type))
  if (temporalExprs.length == 0) return undefined
  let baseTypes = [...new Set(temporalExprs.map(temporalBaseType).filter((type): type is TemporalBaseType => !!type))]
  if (baseTypes.length == 0) return undefined
  if (baseTypes.length == 1) return baseTypes[0]
  return 'timestamp'
}
