import {type GrapheneError} from '../../lang/index.js'
import {GrapheneFrameParent, type GrapheneFrameChild} from './frameBridge.ts'
import {PageInputs, activatePageInputs, releasePageInputs} from './pageInputs.svelte.ts'
import {refreshQueries, resetParentQueries, runParentQuery, setQueryFetcher} from './queryEngine.ts'
import {getErrors} from './telemetry.ts'

type BridgeHandler = (payload: any) => any

type ParentFrameOptions = {
  frame: HTMLIFrameElement
  pageInputs: PageInputs
  getCompileError?: () => GrapheneError | null
  onMeta?: (meta: any) => void
  onError?: (error: GrapheneError | null) => void
  onReady?: () => void
  handlers?: Record<string, BridgeHandler>
  hooks?: (runtime: ParentFrameRuntime) => Record<string, any>
}

export type ParentFrameRuntime = {
  bridge: GrapheneFrameParent
  requestFrame: (type: string, payload?: any, timeout?: number) => Promise<any>
  destroy: () => void
}

export function createParentFrameRuntime(options: ParentFrameOptions): ParentFrameRuntime {
  resetParentQueries()

  let bridge = new GrapheneFrameParent(options.frame)
  let runtime = {
    bridge,
    requestFrame: (type: string, payload?: any, timeout?: number) => bridge.request(type, payload, timeout),
    destroy: () => {},
  }

  bridge.on('query.run', payload => runParentQuery(payload.req, payload.options))
  bridge.on('params.get', () => options.pageInputs.getParams())
  bridge.on('params.update', payload => {
    options.pageInputs.updateParams(payload.params || {})
    return options.pageInputs.getParams()
  })
  bridge.on('page.meta', payload => options.onMeta?.(payload || {}))
  bridge.on('page.error', payload => options.onError?.(payload || null))
  bridge.on('render.ready', () => options.onReady?.())

  for (let [type, handler] of Object.entries(options.handlers || {})) bridge.on(type, handler)

  let unsubscribeParams = options.pageInputs.subscribeParams(params => {
    bridge.notify('params.changed', {params})
  })
  let restoreHooks = installParentFrameHooks(runtime, options.getCompileError || (() => null), options.hooks?.(runtime) || {})

  runtime.destroy = () => {
    unsubscribeParams()
    bridge.destroy()
    restoreHooks()
  }
  return runtime
}

function installParentFrameHooks(runtime: ParentFrameRuntime, getCompileError: () => GrapheneError | null, extraHooks: Record<string, any>) {
  let graphene = (window.$GRAPHENE ||= {})
  let hooks = {
    frameWaitForLoad: (timeout = 20_000) => (getCompileError() ? true : runtime.requestFrame('render.waitForLoad', {timeout}, timeout + 1000)),
    rerunQueries: () => runtime.requestFrame('queries.rerun'),
    refreshQueries: () => runtime.requestFrame('queries.refresh'),
    getErrors: async () => {
      let compileError = getCompileError()
      return compileError ? [compileError] : (await runtime.requestFrame('errors.list')) || []
    },
    ...extraHooks,
  }
  let previousHooks = Object.fromEntries(Object.keys(hooks).map(key => [key, graphene[key]]))
  Object.assign(graphene, hooks)

  return () => {
    for (let [key, previous] of Object.entries(previousHooks)) {
      if (graphene[key] !== hooks[key]) continue
      if (previous === undefined) delete graphene[key]
      else graphene[key] = previous
    }
  }
}

type ChildFrameOptions = {
  bridge: GrapheneFrameChild
  waitForLoad?: (timeout: number) => any
  getQueryResults?: () => any
  handlers?: Record<string, BridgeHandler>
}

export function createChildFrameRuntime({bridge, waitForLoad, getQueryResults, handlers}: ChildFrameOptions) {
  let pageInputs = activatePageInputs(
    new PageInputs({
      syncUrl: false,
      delegateUpdate: nextParams => void bridge.request('params.update', {params: nextParams}),
    }),
  )

  setQueryFetcher((req, options) => bridge.request('query.run', {req, options}))
  bridge.on('params.changed', payload => pageInputs.applyExternalParams(payload.params || {}))
  bridge.on('render.waitForLoad', payload => (waitForLoad || window.$GRAPHENE.waitForLoad)(payload?.timeout || 20_000))
  bridge.on('queries.rerun', () => window.$GRAPHENE.rerunQueries())
  bridge.on('queries.refresh', () => refreshQueries())
  bridge.on('errors.list', () => getErrors())
  if (getQueryResults) bridge.on('query.results', () => getQueryResults())
  for (let [type, handler] of Object.entries(handlers || {})) bridge.on(type, handler)

  return {
    pageInputs,
    destroy: () => releasePageInputs(pageInputs),
  }
}
