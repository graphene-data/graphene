import {type TimestampUnit} from './temporal.ts'
import {type FieldType} from './types.ts'

const TEMPORAL_BASES = ['date', 'timestamp'] as const
type TemporalBase = (typeof TEMPORAL_BASES)[number]

export function displayType(type: FieldType) {
  if (!type.params || Object.keys(type.params).length == 0) return type.base
  let entries = Object.entries(type.params)
  if (entries.length == 1 && entries[0][0] == 'grain') return `${type.base}<${entries[0][1]}>`
  return `${type.base}<${entries.map(([key, value]) => `${key}=${value}`).join(', ')}>`
}

export function isTemporalType(type: FieldType): type is FieldType & {base: TemporalBase} {
  return (TEMPORAL_BASES as readonly string[]).includes(type.base)
}

export function temporalGrain(type: FieldType): TimestampUnit | undefined {
  let grain = type.params?.grain
  return typeof grain == 'string' ? (grain as TimestampUnit) : undefined
}

export function isSubtype(actual: FieldType, expected: FieldType) {
  if (actual.base != expected.base) return false
  if (!expected.params || Object.keys(expected.params).length == 0) return true
  if (!actual.params) return false
  return Object.entries(expected.params).every(([key, value]) => actual.params?.[key] == value)
}

export function commonType(left: FieldType | null, right: FieldType | null): FieldType | null {
  if (!left || left.base == 'null' || left.base == 'error') return right
  if (!right || right.base == 'null' || right.base == 'error') return left

  if (left.base == right.base) {
    if (sameParams(left.params, right.params)) return cloneType(left)
    return {base: left.base}
  }

  if (isTemporalType(left) && isTemporalType(right)) return {base: 'timestamp'}
  return cloneType(right)
}

export function mergeTypes(types: (FieldType | null | undefined)[]) {
  return types.reduce<FieldType | null>((merged, type) => commonType(merged, type || null), null)
}

export function cloneType(type: FieldType) {
  return type.params ? {base: type.base, params: {...type.params}} : {base: type.base}
}

function sameParams(left?: Record<string, string>, right?: Record<string, string>) {
  let leftKeys = Object.keys(left || {})
  let rightKeys = Object.keys(right || {})
  if (leftKeys.length != rightKeys.length) return false
  return leftKeys.every(key => left?.[key] == right?.[key])
}
