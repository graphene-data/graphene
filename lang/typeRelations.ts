import {coarseTemporalType, isTemporalType} from './temporal.ts'
import {type FieldType} from './types.ts'

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
