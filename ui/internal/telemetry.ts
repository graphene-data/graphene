import type {GrapheneError} from '../../lang/index.d.ts'

type ErrorProvider = () => GrapheneError[]

window.$GRAPHENE ||= {}
window.$GRAPHENE.getErrors = getErrors

let staticErrors: GrapheneError[] = []
let errorProviders: Record<string, ErrorProvider> = {}

window.addEventListener('error', event => {
  if ((event.error?.message || '').match(/Failed to fetch dynamically imported module.*\.md\?import/)) return
  let err = event.error instanceof Error ? event.error : new Error(String(event.error))
  staticErrors.push({message: err.message, stack: err.stack})
})
window.addEventListener('unhandledrejection', event => {
  let err = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
  staticErrors.push({message: err.message, stack: err.stack})
})

export function logError(error: unknown, ctx?: Partial<GrapheneError>) {
  let err = error instanceof Error ? error : new Error(String(error))
  staticErrors.push({message: err.message, stack: err.stack, ...ctx})
}

export function errorProvider(key: string, fn: ErrorProvider) {
  errorProviders[key] = fn
}

export function getErrors(): GrapheneError[] {
  let provided = Object.values(errorProviders).flatMap(p => p())
  return staticErrors.concat(provided)
}
