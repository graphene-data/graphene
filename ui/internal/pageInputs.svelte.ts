import {createContext} from 'svelte'

type ParamScalar = string | number | boolean
export type ParamValue = ParamScalar | null | ParamScalar[]
export type ParamSnapshot = Record<string, ParamValue>
export type ParamEvent = {changed: Set<string>}
export type ParamSubscriber = (params: ParamSnapshot, event: ParamEvent) => void

interface ReadResult<T> {
  present: boolean
  value: T
}

interface ParamCodec<T> {
  keys(name: string): string[]
  empty(): T
  read(params: ParamSnapshot, name: string): ReadResult<T>
  write(name: string, value: T): ParamSnapshot
  normalize?(params: ParamSnapshot, name: string): void
}

type UpdateSource = 'init' | 'local' | 'external'

class BoundField<T> {
  value: T
  hasExternalValue: boolean

  constructor(
    private controller: PageInputs,
    private name: string,
    private codec: ParamCodec<T>,
  ) {
    this.value = $state(codec.empty())
    this.hasExternalValue = $state(false)
    this.controller.registerField(this)
    this.sync(this.controller.getParams(), 'init')
  }

  keys() {
    return this.codec.keys(this.name)
  }

  sync(params: ParamSnapshot, source: UpdateSource) {
    let next = this.codec.read(params, this.name)
    this.value = next.value
    if (source === 'init') this.hasExternalValue = next.present
    else if (source === 'external') this.hasExternalValue = true
  }

  normalize(params: ParamSnapshot) {
    this.codec.normalize?.(params, this.name)
  }

  set(next: T) {
    let nextParams = this.codec.write(this.name, next)
    if (typeof window !== 'undefined' && window.$GRAPHENE?.updateParams) window.$GRAPHENE.updateParams(nextParams)
    else this.controller.updateParams(nextParams)
  }

  destroy() {
    this.controller.unregisterField(this)
  }
}

const textCodec: ParamCodec<string> = {
  keys: name => [name],
  empty: () => '',
  read(params, name) {
    let raw = params[name]
    if (raw === undefined || raw === null) return {present: false, value: ''}
    if (Array.isArray(raw)) return {present: raw.length > 0, value: raw.length ? String(raw[0] ?? '') : ''}
    return {present: true, value: String(raw)}
  },
  write(name, value) {
    return {[name]: value === '' ? null : value}
  },
}

const dropdownSingleCodec: ParamCodec<any[]> = {
  keys: name => [name],
  empty: () => [],
  read(params, name) {
    let raw = params[name]
    if (raw === undefined || raw === null) return {present: false, value: []}
    if (Array.isArray(raw)) return {present: raw.length > 0, value: raw.length ? [raw[0]] : []}
    return {present: true, value: [raw]}
  },
  write(name, value) {
    return {[name]: value.length ? value[0] : null}
  },
}

const dropdownMultiCodec: ParamCodec<any[]> = {
  keys: name => [name],
  empty: () => [],
  read(params, name) {
    let raw = params[name]
    if (raw === undefined || raw === null) return {present: false, value: []}
    if (Array.isArray(raw)) return {present: raw.length > 0, value: [...raw]}
    return {present: true, value: [raw]}
  },
  write(name, value) {
    return {[name]: value.length ? [...value] : null}
  },
  normalize(params, name) {
    let raw = params[name]
    if (raw === undefined || raw === null || Array.isArray(raw)) return
    params[name] = [raw]
  },
}

const dateRangeCodec: ParamCodec<{start: string | null; end: string | null}> = {
  keys: name => [`${name}_start`, `${name}_end`],
  empty: () => ({start: null, end: null}),
  read(params, name) {
    let startRaw = params[`${name}_start`]
    let endRaw = params[`${name}_end`]
    let start = readScalar(startRaw)
    let end = readScalar(endRaw)
    return {present: start !== null || end !== null, value: {start, end}}
  },
  write(name, value) {
    return {
      [`${name}_start`]: value.start,
      [`${name}_end`]: value.end,
    }
  },
}

function readScalar(value: ParamValue | undefined) {
  if (value === undefined || value === null) return null
  if (Array.isArray(value)) return value.length ? String(value[0] ?? '') : null
  return String(value)
}

function cloneParamValue(value: ParamValue): ParamValue {
  if (Array.isArray(value)) return [...value]
  return value
}

function cloneParams(params: ParamSnapshot) {
  return Object.fromEntries(Object.entries(params).map(([name, value]) => [name, cloneParamValue(value)])) as ParamSnapshot
}

function paramValueEqual(left: ParamValue | undefined, right: ParamValue | undefined) {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false
    if (left.length !== right.length) return false
    return left.every((value, index) => value === right[index])
  }
  return left === right
}

function getChangedKeys(left: ParamSnapshot, right: ParamSnapshot) {
  let changed = new Set<string>()
  let keys = new Set([...Object.keys(left), ...Object.keys(right)])
  keys.forEach(key => {
    if (!paramValueEqual(left[key], right[key])) changed.add(key)
  })
  return changed
}

export class PageInputs {
  private params: ParamSnapshot
  private subscribers: Set<ParamSubscriber>
  private fieldsByKey: Map<string, Set<BoundField<any>>>
  private onPopState?: () => void

  constructor() {
    this.params = $state.raw({}) as ParamSnapshot
    this.subscribers = new Set()
    this.fieldsByKey = new Map()
    this.params = cloneParams(this.readFromUrl())
    if (typeof window !== 'undefined') {
      this.onPopState = () => this.syncFromUrl()
      window.addEventListener('popstate', this.onPopState)
    }
  }

  destroy() {
    if (this.onPopState) window.removeEventListener('popstate', this.onPopState)
    this.subscribers.clear()
    this.fieldsByKey.clear()
  }

  registerField(field: BoundField<any>) {
    field.keys().forEach(key => {
      let fields = this.fieldsByKey.get(key)
      if (!fields) {
        fields = new Set()
        this.fieldsByKey.set(key, fields)
      }
      fields.add(field)
    })
  }

  unregisterField(field: BoundField<any>) {
    field.keys().forEach(key => {
      let fields = this.fieldsByKey.get(key)
      if (!fields) return
      fields.delete(field)
      if (fields.size === 0) this.fieldsByKey.delete(key)
    })
  }

  text(name: string) {
    return new BoundField(this, name, textCodec)
  }

  dropdown(name: string, multiple: boolean) {
    return new BoundField(this, name, multiple ? dropdownMultiCodec : dropdownSingleCodec)
  }

  dateRange(name: string) {
    return new BoundField(this, name, dateRangeCodec)
  }

  getParam(name: string) {
    return this.params[name]
  }

  getParams() {
    return cloneParams(this.params)
  }

  subscribeParams(subscriber: ParamSubscriber) {
    this.subscribers.add(subscriber)
    return () => this.subscribers.delete(subscriber)
  }

  updateParam(name: string, value: ParamValue) {
    this.updateParams({[name]: value})
  }

  updateParams(nextParams: Record<string, any>) {
    let merged = {...this.params} as ParamSnapshot
    Object.entries(nextParams).forEach(([name, value]) => {
      merged[name] = Array.isArray(value) ? [...value] : value
    })
    this.applySnapshot(merged, 'local')
  }

  reset() {
    let changed = new Set(Object.keys(this.params))
    if (changed.size === 0) return
    this.params = {}
    this.syncUrl()
    this.syncFields(changed, 'local')
    let snapshot = this.getParams()
    this.subscribers.forEach(subscriber => subscriber(snapshot, {changed}))
  }

  syncFromUrl() {
    this.applySnapshot(this.readFromUrl(), 'external')
  }

  private applySnapshot(nextParams: ParamSnapshot, source: UpdateSource) {
    // Central reconciliation point for persisted inputs: update the snapshot, sync affected
    // fields, notify compatibility subscribers, and rerun queries from the final param state.
    let cloned = cloneParams(nextParams)
    this.normalizeSnapshot(cloned)
    let changed = getChangedKeys(this.params, cloned)
    if (changed.size === 0) return
    this.params = cloned
    if (source !== 'external') this.syncUrl()
    this.syncFields(changed, source)
    let snapshot = this.getParams()
    this.subscribers.forEach(subscriber => subscriber(snapshot, {changed}))
    window.$GRAPHENE?.rerunQueries?.()
  }

  private syncFields(changed: Set<string>, source: UpdateSource) {
    let fields = new Set<BoundField<any>>()
    changed.forEach(key => {
      this.fieldsByKey.get(key)?.forEach(field => fields.add(field))
    })
    fields.forEach(field => field.sync(this.params, source))
  }

  private normalizeSnapshot(params: ParamSnapshot) {
    let fields = new Set<BoundField<any>>()
    this.fieldsByKey.forEach(keyFields => {
      keyFields.forEach(field => fields.add(field))
    })
    fields.forEach(field => field.normalize(params))
  }

  private syncUrl() {
    if (typeof window === 'undefined') return
    let search = new URLSearchParams()
    Object.entries(this.params).forEach(([name, value]) => {
      if (Array.isArray(value)) {
        value.forEach(item => search.append(name, String(item)))
        return
      }
      if (value === null || value === undefined || value === '') return
      search.append(name, String(value))
    })
    let nextSearch = search.toString()
    let currentSearch = window.location.search.replace(/^\?/, '')
    if (nextSearch === currentSearch) return
    let nextUrl = window.location.pathname + (nextSearch ? `?${nextSearch}` : '') + window.location.hash
    window.history.replaceState(window.history.state, '', nextUrl)
  }

  private readFromUrl() {
    if (typeof window === 'undefined') return {} as ParamSnapshot
    let next = {} as ParamSnapshot
    for (let [name, value] of new URLSearchParams(window.location.search).entries()) {
      let existing = next[name]
      if (existing === undefined) next[name] = value
      else if (Array.isArray(existing)) existing.push(value)
      else next[name] = [String(existing), value]
    }
    return next
  }
}

const [getPageInputsContext, setPageInputsContext] = createContext<PageInputs>()

let activePageInputs: PageInputs | null = null

export function activatePageInputs(pageInputs: PageInputs) {
  if (activePageInputs && activePageInputs !== pageInputs) activePageInputs.destroy()
  activePageInputs = pageInputs
  return pageInputs
}

export function getActivePageInputs() {
  if (!activePageInputs) activePageInputs = new PageInputs()
  return activePageInputs
}

export function releasePageInputs(pageInputs: PageInputs) {
  if (activePageInputs !== pageInputs) return
  pageInputs.destroy()
  activePageInputs = null
}

export function getPageInputs() {
  try {
    return getPageInputsContext()
  } catch {
    return getActivePageInputs()
  }
}

// Top-level initializers that read props capture only the initial prop value. Wrapping the
// read in a callback makes that one-time capture explicit for cases like field setup, where
// the prop is treated as immutable component identity rather than reactive input.
export function captureInitial<T>(factory: () => T) {
  return factory()
}

export {setPageInputsContext}
