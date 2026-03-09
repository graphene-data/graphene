export function toBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    let trimmed = value.trim().toLowerCase()
    if (trimmed === 'true' || trimmed === 'yes' || trimmed === '1') return true
    if (trimmed === 'false' || trimmed === 'no' || trimmed === '0' || trimmed === '') return false
  }
  return Boolean(value)
}

export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null) return []
  return [value]
}

export function serializeValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  let str = String(value)
  return `'${str.replace(/'/g, "''")}'`
}

// Parse a comma-separated list into an array of trimmed strings.
// - Strings are split on commas; whitespace trimmed; empty entries removed.
// - Arrays are normalized by trimming string items and String()-ing non-strings.
// - null/undefined -> []
export function parseCommaList(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) return value.map(v => (typeof v === 'string' ? v.trim() : String(v))).filter(v => v.length > 0)
  if (typeof value === 'string')
    return value
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0)
  return [String(value).trim()].filter(v => v.length > 0)
}
