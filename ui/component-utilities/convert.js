export const toBoolean = (value) => {
  if (typeof value === 'undefined' || value === null) return undefined
  if (typeof value === 'string') {
    let normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return Boolean(value)
}

export const toNumber = (value) => {
  if (typeof value === 'undefined' || value === null) return undefined
  let num = Number(value)
  return Number.isNaN(num) ? undefined : num
}
