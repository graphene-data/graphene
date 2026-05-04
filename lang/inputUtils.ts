export function toBoolean(value: any): boolean | undefined {
  if (value === undefined || value === null) return undefined
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
// - Strings are split on top-level commas, ignoring commas inside calls and quoted strings.
// - Arrays are normalized by trimming string items and String()-ing non-strings.
// - null/undefined -> []
export function parseCommaList(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) return value.map(v => (typeof v === 'string' ? v.trim() : String(v))).filter(v => v.length > 0)
  if (typeof value !== 'string') return [String(value).trim()].filter(v => v.length > 0)

  let parts: string[] = []
  let current = ''
  let quote: string | undefined
  let depth = 0

  for (let i = 0; i < value.length; i++) {
    let char = value[i]

    if (quote) {
      current += char
      if (char === quote) {
        if (quote === "'" && value[i + 1] === "'") current += value[++i]
        else quote = undefined
      }
      continue
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char
      current += char
      continue
    }

    if (char === '(' || char === '[' || char === '{') depth++
    if ((char === ')' || char === ']' || char === '}') && depth > 0) depth--

    if (char === ',' && depth === 0) {
      let trimmed = current.trim()
      if (trimmed) parts.push(trimmed)
      current = ''
      continue
    }

    current += char
  }

  let trimmed = current.trim()
  if (trimmed) parts.push(trimmed)
  return parts
}
