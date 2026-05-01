import {onDestroy} from 'svelte'

import type {GrapheneError} from '../../lang/index.d.ts'

// In local development, the same page could have components hot reload many times.
// A flat list of errors would start to accumulate duplicates, and calling `graphene run` would report many (possibly stale) errors.
// The current solution is to key errors by their componentId, and remove them when the component is destroyed.
// This mostly works, but it has the downside that you can only show a single error per component, and does not help with `staticErrors`.
// The other possible solution is that any error should prevent HMR and force a full refresh.

window.$GRAPHENE ||= {}
window.$GRAPHENE.getErrors = getErrors

let staticErrors: GrapheneError[] = []
let componentErrors = new Map<string, GrapheneError>()

window.addEventListener('error', event => {
  if ((event.error?.message || '').match(/Failed to fetch dynamically imported module.*\.md\?import/)) return
  logError(event.error)
})
window.addEventListener('unhandledrejection', event => logError(event.reason))

// Logs errors that for whatever reason cannot be attached to a component
export function logError(error: unknown) {
  let err = error instanceof Error ? error : new Error(String(error))
  staticErrors.push({message: err.message, stack: err.stack})
}

export function setErrorFor(key: string, error: GrapheneError | null) {
  if (error) componentErrors.set(key, error)
  else componentErrors.delete(key)
}

// Creates a logger for one component instance. Each component keeps its latest error
// across rerenders, and we clear it when the component is destroyed during HMR/navigation.
export function componentLogger(componentName: string, identifiers: Record<string, unknown> = {}) {
  let id = computeComponentId(componentName, identifiers)
  onDestroy(() => componentErrors.delete(id))

  return {
    id,
    error(error: unknown, ctx: Partial<GrapheneError> = {}) {
      if (!error) return componentErrors.delete(id)
      let err = error instanceof Error ? error : new Error(String(error))
      componentErrors.set(id, {message: err.message, stack: err.stack, componentId: id, ...ctx})
    },
  }
}

// Shared helper for logging when a svelte component is given props it did not expect.
export function logExtraProps(logger: ReturnType<typeof componentLogger>, componentName: string, props: Record<string, unknown>) {
  let unsupported = Object.keys(props).filter(prop => !['children', '$$slots', '$$events', '$$legacy'].includes(prop))
  if (unsupported.length) logger.error(unsupported.map(prop => `Unsupported prop "${prop}" on ${componentName}.`).join(' '))
}

export function getErrors(): GrapheneError[] {
  return staticErrors.concat(Array.from(componentErrors.values()))
}

export function computeComponentId(componentName: string, identifiers: Record<string, unknown> = {}) {
  let attrs = Object.entries(identifiers).flatMap(([name, value]) =>
    value === undefined || value === null || value === '' || (typeof value === 'object' && !Array.isArray(value)) ? [] : [`${name}="${Array.isArray(value) ? value.join(', ') : value}"`],
  )
  return `${componentName}${attrs.length ? ` (${attrs.join(' ')})` : ''}`
}
