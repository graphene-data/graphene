// API for keeping inputs in sync with url params, and query parameters

// the current values of all params, with defaults applied
let paramValues: Record<string, any> = readUrlParams()

// all listeners who have declared a param, and are awaiting new values
let subscribers: Record<string, {type: ParamType; defaultValue: any; cb: ParamCallback}> = {}

window.addEventListener('popstate', () => applyParams(readUrlParams(), false))

type ParamType = 'scalar' | 'array'
type ParamCallback = (value: any) => void

export function getParams() {
  return structuredClone(paramValues)
}

// Subscribe to a param, providing a type and default (can be null). cb is called immediately with the current value, and when it changes
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

// Updates the values, notifies listeners, and (optionally) writes this back to the url
function applyParams(next: any, updateUrl = false) {
  Object.entries(subscribers).forEach(([name, sub]) => {
    next[name] = normalizeParamValue(sub.type, next[name])
  })
  let changes = changedKeys(paramValues, next)
  paramValues = next
  changes.forEach(name => subscribers[name]?.cb(next[name]))

  if (updateUrl) writeUrlParams()
  window.$GRAPHENE.rerunQueries()
}

// read the raw query params, and turn it into our params object
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

function writeUrlParams() {
  let search = new URLSearchParams()
  Object.entries(paramValues).forEach(([name, value]) => {
    let def = subscribers[name]?.defaultValue
    if (def && sameValue(value, def)) return // if a value is the default, don't write it to the url
    if (value == null || value == undefined || value == '') return // dont write out empty/null values (though false is ok)
    if (Array.isArray(value)) value.forEach(item => search.append(name, String(item)))
    else search.append(name, String(value))
  })

  let nextSearch = search.toString()
  let currentSearch = window.location.search.replace(/^\?/, '')
  if (nextSearch === currentSearch) return
  window.history.replaceState(window.history.state, '', window.location.pathname + (nextSearch ? `?${nextSearch}` : '') + window.location.hash)
}

function normalizeParamValue(type: ParamType, value: any) {
  if (type == 'array') {
    if (value === undefined || value === null) return null
    return Array.isArray(value) ? value : [value]
  }
  if (Array.isArray(value)) return value.length ? value[0] : null
  return value === undefined ? null : value
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
  return left === right
}

Object.assign(window.$GRAPHENE, {param, updateParam})
