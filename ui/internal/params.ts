// Keeps input values synchronized between the URL, rendered components, and query requests.
// List params use the smaller included/excluded set in one escaped URL value.
import {replaceState} from './router.ts'

let paramValues: Record<string, any> = readUrlParams()
let subscribers: Record<string, {type: ParamType; defaultValue: any; cb: ParamCallback}> = {}

window.addEventListener('popstate', () => applyParams(readUrlParams(), false))

type ParamType = 'scalar' | 'array' | 'list'
type ParamCallback = (value: any) => void

// A list describes a selected set using either its included values or its excluded complement.
interface ListParam {
  mode: 'include' | 'exclude'
  values: any[]
}

export function getParams() {
  return structuredClone(paramValues)
}

// Reset params from the URL when the host loads a new page without reloading its own runtime.
export function resetParams() {
  paramValues = readUrlParams()
}

// Subscribe to a param, providing a type and default (can be null). cb is called immediately with the current value, and when it changes.
export function param(name: string, type: ParamType, defaultValue: any, cb: ParamCallback) {
  if (subscribers[name]) throw new Error(`Param named ${name} already in use`)
  subscribers[name] = {type, defaultValue, cb}
  paramValues[name] = normalizeParamValue(type, paramValues[name] ?? defaultValue ?? null)
  cb(paramValues[name])
  return () => delete subscribers[name]
}

export function updateParam(name: string, value: any) {
  if (sameValue(paramValues[name], value)) return
  let next = structuredClone(paramValues)
  next[name] = value
  applyParams(next, true)
}

// Update values, notify input components, optionally rewrite the URL, and rerun dependent queries.
function applyParams(next: any, updateUrl = false) {
  Object.entries(subscribers).forEach(([name, sub]) => {
    next[name] = normalizeParamValue(sub.type, next[name] ?? sub.defaultValue ?? null)
  })
  let changes = changedKeys(paramValues, next)
  paramValues = next
  changes.forEach(name => subscribers[name]?.cb(next[name]))

  if (updateUrl) writeUrlParams()
  window.$GRAPHENE.rerunQueries()
}

// Read repeated legacy params as arrays; typed array subscribers also understand compact lists.
function readUrlParams() {
  let next = {}
  for (let [name, value] of new URLSearchParams(window.location.search).entries()) {
    let existing = next[name]
    if (existing === undefined) next[name] = value
    else if (Array.isArray(existing)) existing.push(value)
    else next[name] = [String(existing), value]
  }
  return next
}

// Serialize list mode and values together so a shared URL preserves which side of the set was stored.
function writeUrlParams() {
  let search = new URLSearchParams()
  Object.entries(paramValues).forEach(([name, value]) => {
    let subscriber = subscribers[name]
    if (subscriber?.defaultValue && sameValue(value, subscriber.defaultValue)) return
    if (value == null || value == '') return
    if (subscriber?.type == 'list') {
      search.append(name, `${value.mode == 'exclude' ? 'e' : 'i'}:${serializeList(value.values)}`)
    } else if (Array.isArray(value)) {
      if (value.length) search.append(name, serializeList(value))
    } else search.append(name, String(value))
  })

  let nextSearch = search.toString()
  let currentSearch = window.location.search.replace(/^\?/, '')
  if (nextSearch === currentSearch) return
  replaceState(window.location.pathname + (nextSearch ? `?${nextSearch}` : '') + window.location.hash)
}

// Normalize legacy arrays as include lists; explicit i:/e: URLs preserve adaptive list mode.
function normalizeParamValue(type: ParamType, value: any) {
  if (type == 'list') {
    if (value && !Array.isArray(value) && typeof value == 'object') return {mode: value.mode == 'exclude' ? 'exclude' : 'include', values: value.values} as ListParam
    if (Array.isArray(value)) return {mode: 'include', values: value}
    let encoded = String(value ?? '')
    let hasMode = encoded.startsWith('i:') || encoded.startsWith('e:')
    return {mode: encoded.startsWith('e:') ? 'exclude' : 'include', values: parseList(hasMode ? encoded.slice(2) : encoded).filter(item => item !== '')}
  }
  if (type == 'array') {
    if (value === undefined || value === null) return []
    if (Array.isArray(value)) return value
    return parseList(String(value))
  }
  if (Array.isArray(value)) return value.length ? value[0] : null
  return value === undefined ? null : value
}

// Lists use commas for readability and backslashes to preserve commas or backslashes inside values.
function serializeList(values: any[]) {
  return values.map(value => String(value).replaceAll('\\', '\\\\').replaceAll(',', '\\,')).join(',')
}

function parseList(value: string) {
  let values: string[] = []
  let current = ''
  let escaped = false
  for (let char of value) {
    if (escaped) {
      current += char
      escaped = false
    } else if (char === '\\') escaped = true
    else if (char === ',') {
      values.push(current)
      current = ''
    } else current += char
  }
  if (escaped) current += '\\'
  values.push(current)
  return values
}

function changedKeys(before, after) {
  let changed = new Set<string>()
  let keys = new Set([...Object.keys(before), ...Object.keys(after)])
  keys.forEach(key => {
    if (!sameValue(before[key], after[key])) changed.add(key)
  })
  return changed
}

function sameValue(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index])
  if (left && right && typeof left == 'object' && typeof right == 'object') return left.mode == right.mode && sameValue(left.values, right.values)
  return left === right
}

Object.assign(window.$GRAPHENE, {param, updateParam, resetParams})
